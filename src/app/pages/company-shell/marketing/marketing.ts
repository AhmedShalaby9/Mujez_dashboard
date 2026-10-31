import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { CompanyGrowthApi, type Campaign } from '../../../company-growth-api.service';
import { AuthService } from '../../../auth.service';
import { SOURCE_NAMES, minorAmount, majorAmount } from '../../../sales-api.service';
import { CompanyInsightsApi } from '../../../company-insights-api.service';
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  kpis: { spend: string; leads: string; cpl: string; deals: string; revenue: string };
  thCampaign: string;
  thSource: string;
  thSpend: string;
  thLeads: string;
  thCpl: string;
  thDeals: string;
  thRevenue: string;
  statusNames: Record<'draft' | 'active' | 'ended', string>;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Growth',
    title: 'Marketing',
    sub: 'Spend, leads, cost per lead and closed deals by campaign and source.',
    kpis: {
      spend: 'Recorded spend',
      leads: 'Leads',
      cpl: 'Blended CPL',
      deals: 'Deals closed',
      revenue: 'Signed sale value',
    },
    thCampaign: 'Campaign',
    thSource: 'Source',
    thSpend: 'Spend',
    thLeads: 'Leads',
    thCpl: 'CPL',
    thDeals: 'Deals',
    thRevenue: 'Signed sale value',
    statusNames: { draft: 'Draft', active: 'Active', ended: 'Ended' },
  },
  ar: {
    eyebrow: 'النمو',
    title: 'التسويق',
    sub: 'الإنفاق والعملاء وتكلفة العميل والصفقات المغلقة لكل حملة ومصدر.',
    kpis: {
      spend: 'إجمالي الإنفاق',
      leads: 'العملاء',
      cpl: 'تكلفة العميل',
      deals: 'الصفقات المغلقة',
      revenue: 'قيمة المبيعات الموقعة',
    },
    thCampaign: 'الحملة',
    thSource: 'المصدر',
    thSpend: 'الإنفاق',
    thLeads: 'العملاء',
    thCpl: 'تكلفة العميل',
    thDeals: 'الصفقات',
    thRevenue: 'قيمة المبيعات الموقعة',
    statusNames: { draft: 'مسودة', active: 'نشطة', ended: 'منتهية' },
  },
};

@Component({
  selector: 'app-marketing',
  imports: [FormsModule, RouterLink],
  templateUrl: './marketing.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './marketing.scss',
  ],
})
export class Marketing implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyGrowthApi);
  readonly auth = inject(AuthService);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('marketing.manage') ?? false,
  );
  readonly canProjects = computed(
    () => this.auth.user()?.permissions.includes('projects.read') ?? false,
  );
  readonly canLeads = computed(() => this.auth.user()?.permissions.includes('leads.read') ?? false);
  readonly canReports = computed(
    () => this.auth.user()?.permissions.includes('reports.read') ?? false,
  );
  readonly insights = inject(CompanyInsightsApi);
  /** Lead sources for this quarter's lead cohort (from the Reports API). */
  sourceRows = signal<
    Array<{ key: string; leads: number; won: number; conversion: number | null }>
  >([]);
  readonly toast = signal('');
  campaigns = signal<Campaign[]>([]);
  totals = signal<any>(null);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  page = signal(1);
  total = signal(0);
  search = '';
  statusFilter = '';
  archived = false;
  formOpen = signal(false);
  editing = signal<Campaign | null>(null);
  projects = signal<any[]>([]);
  projectPage = 0;
  projectTotal = signal(0);
  projectQuery = '';
  sources = Object.keys(SOURCE_NAMES);
  form = { name: '', nameAr: '', source: 'website', projectId: '', status: 'draft', spend: '0' };
  requestId = crypto.randomUUID();
  private serial = 0;
  private projectSerial = 0;
  constructor() {
    void this.reload();
    void this.loadSources();
  }
  async loadSources() {
    if (!this.canReports()) return;
    try {
      const r = await this.insights.get<any>('/reports', { period: 'quarter' });
      this.sourceRows.set(
        [...(r.sources ?? [])]
          .filter((s: any) => s.leads > 0)
          .sort((a: any, b: any) => b.leads - a.leads),
      );
    } catch {
      this.sourceRows.set([]);
    }
  }
  readonly statusDot: Record<Campaign['status'], string> = {
    active: '#8BB33A',
    draft: '#C4C4BE',
    ended: '#8A8A90',
  };
  /** Signed sale value ÷ recorded spend, as a multiple. */
  multiple(sale: string | null, spend: string | null) {
    const sp = Number(spend ?? 0);
    if (!sp) return '—';
    return (Number(sale ?? 0) / sp).toFixed(1) + '×';
  }
  readonly kpis = computed(() => {
    const k = this.totals();
    if (!k) return [];
    const perDeal = k.deals ? (BigInt(k.spendMinor) / BigInt(k.deals)).toString() : null;
    return [
      {
        label: this.t('Recorded spend', 'الإنفاق المسجل'),
        value: this.money(k.spendMinor),
        sub: this.t('campaigns in this view', 'الحملات المعروضة'),
      },
      {
        label: this.t('Attributed leads', 'العملاء المنسوبون'),
        value: Number(k.leads).toLocaleString('en-US'),
        sub: this.t('CPL ', 'تكلفة العميل ') + this.money(k.cplMinor),
      },
      {
        label: this.t('Attributed deals', 'صفقات منسوبة'),
        value: String(k.deals),
        sub: perDeal ? this.t('cost per deal ', 'تكلفة الصفقة ') + this.money(perDeal) : '—',
      },
      {
        label: this.t('Sale value on spend', 'المبيعات مقابل الإنفاق'),
        value: this.multiple(k.saleValueMinor, k.spendMinor),
        sub: this.t('signed sale value ÷ spend', 'قيمة المبيعات الموقعة ÷ الإنفاق'),
      },
    ];
  });
  /** Draft → Active → Ended through the normal update endpoint. */
  async setStatus(c: Campaign, status: Campaign['status']) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('marketing/' + c.id + '/update', {
        requestId: crypto.randomUUID(),
        version: c.version,
        name: c.name.en,
        nameAr: c.name.ar || undefined,
        source: c.source,
        projectId: c.projectId,
        status,
        spendMinor: c.spendMinor,
      });
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  ngOnDestroy() {
    this.serial++;
    this.projectSerial++;
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  name(c: Campaign) {
    return c.name[this.lang()];
  }
  source(c: Campaign) {
    return this.sourceName(c.source);
  }
  sourceName(key: string) {
    return SOURCE_NAMES[key]?.[this.ar() ? 1 : 0] ?? key;
  }
  project(c: Campaign) {
    return c.project?.[this.lang()] ?? this.t('General campaign', 'حملة عامة');
  }
  money(v: string | null) {
    return this.api.money(v);
  }
  changed() {
    this.requestId = crypto.randomUUID();
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    const q: Record<string, string> = {
      q: this.search,
      page: String(this.page()),
      limit: '30',
      archived: this.archived ? 'all' : 'active',
    };
    if (this.statusFilter) q['status'] = this.statusFilter;
    try {
      const r = await this.api.get<any>('marketing', q);
      if (n !== this.serial) return;
      this.campaigns.set(r.items);
      this.total.set(r.total);
      this.totals.set(r.totals);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter() {
    this.page.set(1);
    void this.reload();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  edit(c: Campaign | null = null) {
    this.changed();
    this.error.set('');
    this.editing.set(c);
    this.form = c
      ? {
          name: c.name.en,
          nameAr: c.name.ar,
          source: c.source,
          projectId: c.projectId ?? '',
          status: c.status,
          spend: majorAmount(c.spendMinor),
        }
      : { name: '', nameAr: '', source: 'website', projectId: '', status: 'draft', spend: '0' };
    this.formOpen.set(true);
    if (this.canProjects()) void this.loadProjects(true);
  }
  async loadProjects(reset: boolean) {
    const n = ++this.projectSerial,
      page = reset ? 1 : this.projectPage + 1;
    try {
      const r = await this.api.get<any>('projects', {
        q: this.projectQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.projectSerial) return;
      let items = reset ? r.items : [...this.projects(), ...r.items];
      if (this.form.projectId && !items.some((p: any) => p.id === this.form.projectId)) {
        const p = await this.api.get<any>('projects/' + this.form.projectId);
        if (n !== this.projectSerial) return;
        items = [p, ...items];
      }
      this.projects.set(items);
      this.projectTotal.set(r.total);
      this.projectPage = page;
    } catch (e: any) {
      if (n === this.projectSerial) this.error.set(e.message);
    }
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const c = this.editing();
      await this.api.write('marketing' + (c ? '/' + c.id + '/update' : ''), {
        requestId: this.requestId,
        name: this.form.name,
        nameAr: this.form.nameAr || undefined,
        source: this.form.source,
        projectId: this.form.projectId || null,
        status: this.form.status,
        spendMinor: minorAmount(this.form.spend),
        ...(c ? { version: c.version } : {}),
      });
      this.formOpen.set(false);
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  async archive(c: Campaign) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('marketing/' + c.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: c.version,
        action: c.archivedAt ? 'restore' : 'archive',
      });
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
