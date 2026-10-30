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
  styleUrl: './audit-log.scss',
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
