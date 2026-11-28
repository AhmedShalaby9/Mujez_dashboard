import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, type User } from '../../../auth.service';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { salesMoney } from '../../../sales-api.service';
import {
  BrokerageDealsApi,
  type Deal,
  type DealDocument,
  type DealOptions,
} from '../../../brokerage-deals-api.service';
import { CompanyUiState } from '../company-ui-state';

const LIMIT = 30;
const KINDS: Record<string, [string, string]> = {
  eoi: ['EOI', 'إبداء اهتمام'],
  reservation: ['Reservation', 'حجز'],
  contract: ['Contract', 'عقد'],
  id_copy: ['ID copy', 'صورة البطاقة'],
  other: ['Other', 'أخرى'],
};
const emptyFilters = () => ({ search: '', agentId: '', leadId: '', from: '', to: '' });

/** A brokerage's contracts are the deals approved as contracted, with their documents. */
@Component({
  selector: 'app-brokerage-contracts',
  imports: [FormsModule],
  templateUrl: './brokerage-contracts.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './brokerage-contracts.scss',
  ],
})
export class BrokerageContracts {
  private readonly api = inject(BrokerageDealsApi);
  private readonly auth = inject(AuthService);
  private readonly config = inject(RUNTIME_CONFIG);
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  /** Own-scope sales users only ever see their own contracts. */
  readonly ownScope = computed(
    () => (this.auth.user() as (User & { scope?: string }) | null)?.scope === 'own',
  );
  readonly money = salesMoney;

  filters = emptyFilters();
  leadSearch = '';
  readonly rows = signal<Deal[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly agents = signal<DealOptions['agents']>([]);
  readonly leads = signal<DealOptions['leads']>([]);
  readonly selected = signal<Deal | null>(null);
  private serial = 0;
  private leadSerial = 0;
  private detailSerial = 0;

  constructor() {
    void this.loadOptions();
    void this.reload();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  kind(k: string) {
    const label = KINDS[k];
    return label ? this.t(label[0], label[1]) : k;
  }
  date(v: string | null | undefined, withTime = false) {
    if (!v) return '—';
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
      timeZone: 'Africa/Cairo',
    }).format(new Date(v));
  }
  /** Set when the deal no longer matches an approved contract. */
  state(c: Deal) {
    if (c.status === 'cancelled') return this.t('Cancelled', 'ملغاة');
    if (c.approvalStatus === 'pending')
      return this.t('Changes pending approval', 'تعديلات بانتظار الموافقة');
    if (c.approvalStatus === 'rejected') return this.t('Changes rejected', 'التعديلات مرفوضة');
    if (c.status !== 'contracted') return this.t('No longer contracted', 'لم تعد في حالة تعاقد');
    return '';
  }
  async loadOptions() {
    try {
      const o = await this.api.options();
      this.agents.set(o.agents);
      this.leads.set(o.leads);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async searchLeads() {
    const n = ++this.leadSerial;
    try {
      const found = await this.api.leads(this.leadSearch.trim());
      if (n !== this.leadSerial) return;
      // Keep the chosen lead selectable while searching for another.
      const chosen = this.leads().find((l) => l.id === this.filters.leadId);
      this.leads.set(chosen && !found.some((l) => l.id === chosen.id) ? [chosen, ...found] : found);
    } catch (e) {
      if (n === this.leadSerial) this.error.set((e as Error).message);
    }
  }
  async reload() {
    const n = ++this.serial;
    this.error.set('');
    const f = this.filters;
    if (f.from && f.to && f.from > f.to) {
      this.rows.set([]);
      this.total.set(0);
      this.loading.set(false);
      this.error.set(
        this.t('The start date is after the end date.', 'تاريخ البداية بعد تاريخ النهاية.'),
      );
      return;
    }
    this.loading.set(true);
    const q: Record<string, string> = {
      contracts: 'true',
      page: String(this.page()),
      limit: String(LIMIT),
    };
    if (f.search.trim()) q['search'] = f.search.trim();
    if (f.agentId) q['agentId'] = f.agentId;
    if (f.leadId) q['leadId'] = f.leadId;
    if (f.from) q['contractedFrom'] = f.from;
    if (f.to) q['contractedTo'] = f.to;
    try {
      const r = await this.api.list(q);
      if (n !== this.serial) return;
      this.rows.set(r.items);
      this.total.set(r.total);
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  apply() {
    this.page.set(1);
    void this.reload();
  }
  clear() {
    this.filters = emptyFilters();
    this.leadSearch = '';
    void this.searchLeads();
    this.apply();
  }
  paginate(delta: number) {
    this.page.set(Math.max(1, this.page() + delta));
    void this.reload();
  }
  async open(id: string) {
    const n = ++this.detailSerial;
    this.error.set('');
    try {
      const d = await this.api.detail(id);
      if (n === this.detailSerial) this.selected.set(d);
    } catch (e) {
      if (n === this.detailSerial) this.error.set((e as Error).message);
    }
  }
  close() {
    this.detailSerial++;
    this.selected.set(null);
  }
  async download(dealId: string, doc: DealDocument) {
    this.error.set('');
    try {
      const response = await fetch(
        this.config.apiUrl + '/api/v1/brokerage/deals/' + dealId + '/documents/' + doc.id,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error(this.t('Document download failed.', 'تعذر تنزيل المستند.'));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
