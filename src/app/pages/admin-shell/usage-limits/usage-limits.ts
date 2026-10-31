import { FeaturesApi } from '../../../features-api.service';
import { Router } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type ResourceKey = 'users' | 'listings' | 'storage';
type PlanKey = string;

interface Resource {
  used: number | null;
  limit: number | null;
  measured: boolean;
  overrideExpires: string | null;
}

interface UsageRow {
  version: number;
  accessible: boolean;
  id: string;
  nameEn: string;
  nameAr: string;
  plan: PlanKey;
  users: Resource;
  listings: Resource;
  storage: Resource;
}

type Threshold = 'all' | 80 | 90 | 100;

interface Copy {
  eyebrow: string;
  title: string;
  kpis: { total: string; atRisk: string; atLimit: string; avg: string };
  colCompany: string;
  colPlan: string;
  colUsers: string;
  colListings: string;
  colStorage: string;
  colAction: string;
  filterAll: string;
  filter80: string;
  filter90: string;
  filter100: string;
  override: string;
  overrideTitle: (company: string, resource: string) => string;
  overrideBody: (current: number, next: number) => string;
  resourceLabel: Record<ResourceKey, string>;
  reasonLabel: string;
  reasonError: string;
  cancel: string;
  confirm: string;
  overrideToast: (company: string, resource: string) => string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Platform',
    title: 'Usage & limits',
    kpis: {
      total: 'Companies tracked',
      atRisk: 'At 80%+',
      atLimit: 'At limit',
      avg: 'Avg. utilization',
    },
    colCompany: 'Company',
    colPlan: 'Plan',
    colUsers: 'Users',
    colListings: 'Listings',
    colStorage: 'Storage',
    colAction: '',
    filterAll: 'All companies',
    filter80: '≥ 80%',
    filter90: '≥ 90%',
    filter100: 'At 100%',
    override: 'Override limit',
    overrideTitle: (company, resource) => `Override ${resource} limit — ${company}`,
    overrideBody: (current, next) =>
      `Raises the limit from ${current} to ${next} (+20%) for 30 days.`,
    resourceLabel: { users: 'users', listings: 'listings', storage: 'storage' },
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    cancel: 'Cancel',
    confirm: 'Apply override',
    overrideToast: (company, resource) => `${resource} limit for ${company} raised for 30 days.`,
    emptyTitle: 'No companies match this filter',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'الاستخدام والحدود',
    kpis: { total: 'شركات مرصودة', atRisk: '80%+', atLimit: 'عند الحد', avg: 'متوسط الاستخدام' },
    colCompany: 'الشركة',
    colPlan: 'الباقة',
    colUsers: 'المستخدمون',
    colListings: 'الوحدات',
    colStorage: 'التخزين',
    colAction: '',
    filterAll: 'كل الشركات',
    filter80: '٨٠٪ فأكثر',
    filter90: '٩٠٪ فأكثر',
    filter100: 'عند الحد',
    override: 'تجاوز الحد',
    overrideTitle: (company, resource) => `تجاوز حد ${resource} — ${company}`,
    overrideBody: (current, next) => `يرفع الحد من ${current} إلى ${next} (+20%) لمدة 30 يومًا.`,
    resourceLabel: { users: 'المستخدمين', listings: 'الوحدات', storage: 'التخزين' },
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirm: 'تطبيق التجاوز',
    overrideToast: (company, resource) => `تم رفع حد ${resource} لـ ${company} لمدة 30 يومًا.`,
    emptyTitle: 'لا توجد شركات مطابقة لهذا الفلتر',
  },
};

@Component({
  selector: 'app-usage-limits',
  imports: [FormsModule],
  templateUrl: './usage-limits.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './usage-limits.scss'],
})
export class UsageLimits {
  private readonly api = inject(FeaturesApi);
  private readonly router = inject(Router);
  readonly kebabFor = signal<string | null>(null);
  readonly overrideResource = signal<ResourceKey>('users');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.rows.set(await this.api.usage());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load usage');
    } finally {
      this.loading.set(false);
    }
  }
  async removeOverride(r: UsageRow, resource: ResourceKey) {
    this.kebabFor.set(null);
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.limit(r.id, 'remove', {
        version: r.version,
        resource,
        reason: 'Temporary quota override removed by administrator',
      });
      await this.reload();
      this.showToast(this.lang() === 'ar' ? 'تمت إزالة الاستثناء.' : 'Override removed.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to remove override');
    } finally {
      this.saving.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly resourceKeys: ResourceKey[] = ['users', 'listings', 'storage'];

  readonly rows = signal<UsageRow[]>([]);
  readonly filter = signal<Threshold>('all');

  readonly overriding = signal<{ row: UsageRow; resource: ResourceKey } | null>(null);
  readonly overrideReason = signal('');
  readonly overrideError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(r: UsageRow): string {
    return this.lang() === 'ar' ? r.nameAr : r.nameEn;
  }

  planName(p: PlanKey): string {
    return p === 'none' ? (this.lang() === 'ar' ? 'بدون اشتراك' : 'No current subscription') : p;
  }

  pct(res: Resource): number {
    if (!res.measured || res.used === null || res.limit === null) return 0;
    return res.limit === 0 ? 100 : Math.round((res.used / res.limit) * 100);
  }

  highestPct(r: UsageRow): number {
    return Math.max(this.pct(r.users), this.pct(r.listings), this.pct(r.storage));
  }

  barClass(pct: number): string {
    if (pct >= 100) return 'bar__fill--danger';
    if (pct >= 80) return 'bar__fill--warn';
    return 'bar__fill--ok';
  }

  limitLabel(n: number | null) {
    return n === null ? (this.lang() === 'ar' ? 'بلا حد' : 'Unlimited') : this.format(n);
  }
  format(n: number | null): string {
    if (n === null) return this.lang() === 'ar' ? 'غير مقاس' : 'Not measured';
    return n % 1 === 0 ? n.toLocaleString('en-US') : n.toFixed(1);
  }

  readonly kpis = computed(() => {
    const list = this.rows();
    const atRisk = list.filter((r) => this.highestPct(r) >= 80).length;
    const atLimit = list.filter((r) => this.highestPct(r) >= 100).length;
    const avg = list.length
      ? Math.round(list.reduce((sum, r) => sum + this.highestPct(r), 0) / list.length)
      : 0;
    return { total: list.length, atRisk, atLimit, avg: `${avg}%` };
  });

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.rows().filter((r) => {
      if (f === 'all') return true;
      return this.highestPct(r) >= f;
    });
  });

  setFilter(f: Threshold): void {
    this.filter.set(f);
  }

  askOverride(row: UsageRow, resource: ResourceKey): void {
    this.kebabFor.set(null);
    this.overrideResource.set(resource);
    this.overriding.set({ row, resource });
    this.overrideReason.set('');
    this.overrideError.set(false);
  }

  setOverrideResource(r: ResourceKey) {
    const t = this.overriding();
    if (t) this.overriding.set({ ...t, resource: r });
    this.overrideResource.set(r);
  }
  /** A +20% override needs a current subscription and a positive finite base limit. */
  canOverride(r: UsageRow, k: ResourceKey) {
    const res = r[k];
    return r.plan !== 'none' && res.limit !== null && res.limit > 0 && !res.overrideExpires;
  }
  activeOverrides(r: UsageRow) {
    return this.resourceKeys.filter((k) => !!r[k].overrideExpires);
  }
  readonly tabs = computed(() => {
    const ar = this.lang() === 'ar';
    const list: Array<[Threshold, string]> = [
      ['all', ar ? 'الكل' : 'All'],
      [80, '≥ 80%'],
      [90, '≥ 90%'],
      [100, '≥ 100%'],
    ];
    return list.map(([k, label]) => ({
      k,
      label,
      n:
        k === 'all'
          ? this.rows().length
          : this.rows().filter((r) => this.highestPct(r) >= k).length,
    }));
  });
  readonly totals = computed(() => {
    const rows = this.rows();
    const sum = (k: ResourceKey, f: 'used' | 'limit') =>
      rows.reduce((n, r) => n + (r[k].measured && r[k][f] !== null ? Number(r[k][f]) : 0), 0);
    const anyMeasured = (k: ResourceKey) => rows.some((r) => r[k].measured && r[k].used !== null);
    return {
      users: sum('users', 'used'),
      seats: rows.reduce((n, r) => n + (r.users.limit ?? 0), 0),
      unlimitedSeats: rows.some((r) => r.users.limit === null && r.plan !== 'none'),
      listings: anyMeasured('listings') ? sum('listings', 'used') : null,
      storage: anyMeasured('storage') ? sum('storage', 'used') : null,
      storageCap: sum('storage', 'limit'),
    };
  });
  cell(res: Resource, unit = '') {
    const ar = this.lang() === 'ar';
    if (!res.measured || res.used === null)
      return {
        t: ar ? 'غير مقاس' : 'Not measured',
        sub:
          res.limit === null
            ? ar
              ? 'بلا حد'
              : 'unlimited'
            : (ar ? 'الحد ' : 'limit ') + this.format(res.limit) + unit,
        cls: 'dim',
      };
    const p = this.pct(res);
    return {
      t:
        this.format(res.used) +
        unit +
        ' / ' +
        (res.limit === null ? '∞' : this.format(res.limit) + unit),
      sub: res.limit === null ? (ar ? 'بلا حد' : 'unlimited') : p + '%',
      cls: p >= 90 ? 'bad' : p >= 80 ? 'warn' : '',
    };
  }
  status(r: UsageRow) {
    const ar = this.lang() === 'ar';
    const p = this.highestPct(r);
    if (r.plan === 'none')
      return {
        t: ar ? 'بدون اشتراك' : 'No subscription',
        bg: '#F1F1ED',
        fg: '#6E6E73',
        dot: '#B4B4AE',
      };
    if (p >= 100)
      return { t: ar ? 'تجاوز الحد' : 'Over limit', bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' };
    if (p >= 90)
      return {
        t: (ar ? 'حرج · ' : 'Critical · ') + p + '%',
        bg: '#FBE7E3',
        fg: '#A23624',
        dot: '#E2553B',
      };
    if (p >= 80)
      return {
        t: (ar ? 'تحذير · ' : 'Warning · ') + p + '%',
        bg: '#FCF2DE',
        fg: '#83570C',
        dot: '#D99A28',
      };
    return { t: ar ? 'سليم' : 'OK', bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' };
  }
  openCompany(r: UsageRow) {
    void this.router.navigateByUrl('/admin/companies?company=' + encodeURIComponent(r.id));
  }
  notifySoon() {
    this.kebabFor.set(null);
    this.showToast(
      this.lang() === 'ar'
        ? 'تنبيهات الاستخدام بالبريد غير متصلة بعد — لم يُرسل شيء.'
        : "Usage alert emails aren't connected yet — nothing was sent.",
    );
  }
  exportCsv() {
    const head = [
      'Company ID',
      'Company',
      'Plan',
      'Users used',
      'Users limit',
      'Listings used',
      'Listings limit',
      'Storage GB used',
      'Storage GB limit',
      'Highest %',
    ];
    const v = (n: number | null) => (n === null ? '' : String(n));
    const rows = this.filtered().map((r) =>
      [
        r.id,
        r.nameEn,
        r.plan,
        v(r.users.used),
        v(r.users.limit),
        v(r.listings.used),
        v(r.listings.limit),
        v(r.storage.used),
        v(r.storage.limit),
        String(this.highestPct(r)),
      ]
        .map(
          (x) =>
            '"' +
            String(x)
              .replace(/^[=+@-]/, "'$&")
              .replace(/"/g, '""') +
            '"',
        )
        .join(','),
    );
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + [head.join(','), ...rows].join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mujez-usage.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  cancelOverride(): void {
    this.overriding.set(null);
  }

  nextLimit(): number {
    const target = this.overriding();
    if (!target) return 0;
    const current = target.row[target.resource].limit ?? 0;
    return Math.ceil(current * 1.2);
  }

  async confirmOverride() {
    const t = this.overriding();
    if (!t || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.limit(t.row.id, 'override', {
        version: t.row.version,
        resource: t.resource,
        reason: this.overrideReason(),
      });
      this.overriding.set(null);
      await this.reload();
      this.showToast(this.L().overrideToast(this.name(t.row), this.L().resourceLabel[t.resource]));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to override limit');
    } finally {
      this.saving.set(false);
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
