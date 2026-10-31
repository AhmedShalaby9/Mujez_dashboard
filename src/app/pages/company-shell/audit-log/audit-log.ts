import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState, type Lang } from '../company-ui-state';
import {
  CompanyInsightsApi,
  type AuditEntry,
  type AuditPage,
} from '../../../company-insights-api.service';
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  searchPh: string;
  userAll: string;
  thAction: string;
  thResource: string;
  thActor: string;
  thAt: string;
  drawerBefore: string;
  drawerAfter: string;
  close: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Audit Log',
    sub: 'Who changed what and when. Append-only.',
    searchPh: 'Search action or resource…',
    userAll: 'All users',
    thAction: 'Action',
    thResource: 'Resource',
    thActor: 'User',
    thAt: 'When',
    drawerBefore: 'Before',
    drawerAfter: 'After',
    close: 'Close',
    emptyTitle: 'No entries match this filter.',
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'سجل التدقيق',
    sub: 'من غيّر ماذا ومتى. سجل غير قابل للتعديل.',
    searchPh: 'ابحث عن إجراء أو سجل…',
    userAll: 'كل المستخدمين',
    thAction: 'الإجراء',
    thResource: 'السجل',
    thActor: 'المستخدم',
    thAt: 'الوقت',
    drawerBefore: 'قبل',
    drawerAfter: 'بعد',
    close: 'إغلاق',
    emptyTitle: 'لا توجد سجلات مطابقة.',
  },
};

@Component({
  selector: 'app-audit-log',
  imports: [FormsModule],
  templateUrl: './audit-log.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './audit-log.scss',
  ],
})
export class AuditLog {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly ar = computed(() => this.lang() === 'ar');
  readonly L = computed(() => COPY[this.lang()]);
  readonly entries = signal<AuditEntry[]>([]);
  readonly selected = signal<AuditEntry | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly options = signal<{
    actors: { id: string | null; name: string | null }[];
    actions: string[];
  }>({ actors: [], actions: [] });
  readonly total = signal(0);
  readonly nextCursor = signal<string | null>(null);
  readonly asOf = signal('');
  search = '';
  userFilter = '';
  actionFilter = '';
  from = '';
  to = '';
  private generation = 0;
  constructor() {
    void this.load();
    void this.loadOptions();
  }
  async loadOptions() {
    try {
      this.options.set(await this.api.get('/company-audit/options'));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async load(more = false) {
    if (more && this.busy()) return;
    const n = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    if (!more) {
      this.entries.set([]);
      this.nextCursor.set(null);
    }
    const q: Record<string, string> = { limit: '50' };
    if (this.search.trim()) q['q'] = this.search.trim();
    if (this.userFilter) q['actor'] = this.userFilter;
    if (this.actionFilter) q['action'] = this.actionFilter;
    if (this.from) q['from'] = this.from;
    if (this.to) q['to'] = this.to;
    if (more && this.nextCursor()) q['cursor'] = this.nextCursor()!;
    try {
      const d = await this.api.get<AuditPage>('/company-audit', q);
      if (n !== this.generation) return;
      this.entries.update((old) => (more ? [...old, ...d.items] : d.items));
      this.total.set(d.total);
      this.nextCursor.set(d.nextCursor);
      this.asOf.set(d.asOf);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly toast = signal('');
  soon(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3500);
  }
  showFilters = false;
  /** Design categories, matched on resource type (the API has no resource-type filter). */
  readonly categories = [
    { key: 'all', en: 'All', ar: 'الكل', types: [] as string[] },
    {
      key: 'leads',
      en: 'Leads',
      ar: 'العملاء',
      types: ['lead', 'contact', 'task', 'event', 'note'],
    },
    {
      key: 'deals',
      en: 'Deals',
      ar: 'الصفقات',
      types: ['contract', 'commission', 'reservation', 'deal'],
    },
    {
      key: 'inventory',
      en: 'Inventory',
      ar: 'المخزون',
      types: ['unit', 'project', 'phase', 'building'],
    },
    { key: 'docs', en: 'Documents', ar: 'المستندات', types: ['document'] },
    {
      key: 'settings',
      en: 'Settings',
      ar: 'الإعدادات',
      types: ['user', 'role', 'routing', 'campaign', 'company', 'setting', 'report', 'marketing'],
    },
  ];
  readonly category = signal('all');
  private catOf(e: AuditEntry) {
    const rt = (e.resourceType || '').toLowerCase();
    return (
      this.categories.find((c) => c.types.some((t) => rt === t || rt.startsWith(t)))?.key ?? 'other'
    );
  }
  readonly visible = computed(() => {
    const c = this.category();
    return c === 'all' ? this.entries() : this.entries().filter((e) => this.catOf(e) === c);
  });
  /** Verb of "lead.stage_changed" → "stage_changed", humanised. */
  verb(e: AuditEntry) {
    const v = e.action.split('.').slice(1).join('.') || e.action;
    return v.replace(/[._]/g, ' ');
  }
  verbColor(e: AuditEntry) {
    const a = e.action.toLowerCase();
    if (/delete|cancel|void|archive|reject|expired|suspend/.test(a)) return '#B4442F';
    if (/export|price|reserve|merge|paid|payable/.test(a)) return '#B7791F';
    if (/create|upload|assign|note|approve/.test(a)) return '#8BB33A';
    if (/login|session/.test(a)) return '#C4C4BE';
    return '#111113';
  }
  sensitive(e: AuditEntry) {
    return /delete|export|void|archive/.test(e.action.toLowerCase());
  }
  initials(e: AuditEntry) {
    if (!e.actor) return 'SYS';
    return (this.actor(e) || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  private fmt(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o['en'] === 'string') return String(o[this.lang()] ?? o['en']);
      return JSON.stringify(v).slice(0, 40);
    }
    return String(v).slice(0, 60);
  }
  /** Short "field: old → new" summary from before / after. */
  change(e: AuditEntry) {
    const b = (e.before && typeof e.before === 'object' ? e.before : {}) as Record<string, unknown>;
    const a = (e.after && typeof e.after === 'object' ? e.after : {}) as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
      (k) =>
        !['version', 'updatedAt', 'updated_at', 'id'].includes(k) &&
        JSON.stringify(b[k]) !== JSON.stringify(a[k]),
    );
    if (!keys.length) return e.before || e.after ? '' : '—';
    const parts = keys
      .slice(0, 3)
      .map((k) =>
        k in b && k in a
          ? `${k}: ${this.fmt(b[k])} → ${this.fmt(a[k])}`
          : k in a
            ? `${k}: ${this.fmt(a[k])}`
            : `${k} ${this.t('removed', 'حُذف')}`,
      );
    return parts.join(' · ') + (keys.length > 3 ? ` · +${keys.length - 3}` : '');
  }
  when(v: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Cairo',
    }).format(new Date(v));
  }
  actor(e: AuditEntry) {
    return e.actor ? (e.actor.name ?? e.actor.id) : this.ar() ? 'النظام' : 'System';
  }
  action(e: AuditEntry) {
    return e.action;
  }
  date(v: string) {
    return new Date(v).toLocaleString(this.ar() ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' });
  }
  json(v: unknown) {
    return JSON.stringify(v, null, 2) ?? '—';
  }
  async open(e: AuditEntry) {
    this.selected.set(null);
    try {
      this.selected.set(await this.api.get('/company-audit/' + e.id));
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }
  close() {
    this.selected.set(null);
  }
}
