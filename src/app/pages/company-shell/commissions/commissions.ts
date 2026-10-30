import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CompanyCommissionsApi,
  type CompanyCommission,
} from '../../../company-commissions-api.service';
import type { CompanyContract, CompanyDocument } from '../../../company-finance-api.service';
import { minorAmount } from '../../../sales-api.service';
type CommStatus = CompanyCommission['status'];
type Commission = CompanyCommission;
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  statusAll: string;
  statusNames: Record<CommStatus, string>;
  nextAction: Record<CommStatus, string>;
  thDeal: string;
  thGross: string;
  thStatus: string;
  thAction: string;
  linesTitle: string;
  close: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Finance',
    title: 'Commissions',
    sub: 'Calculated from agreed contract values. Unsigned agreements are labeled forecasts.',
    statusAll: 'All',
    statusNames: {
      calculated: 'Calculated',
      approved: 'Approved',
      payable: 'Payable',
      paid: 'Paid (recorded)',
      canceled: 'Canceled',
    },
    nextAction: {
      calculated: 'Approve',
      approved: 'Mark payable',
      payable: 'Record external payment',
      paid: '—',
      canceled: '—',
    },
    thDeal: 'Deal',
    thGross: 'Gross',
    thStatus: 'Status',
    thAction: 'Action',
    linesTitle: 'Split',
    close: 'Close',
    emptyTitle: 'No commissions match this filter.',
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'العمولات',
    sub: 'تُحسب من القيم المتفق عليها. الاتفاقيات غير الموقعة تقديرات فقط.',
    statusAll: 'الكل',
    statusNames: {
      calculated: 'محسوبة',
      approved: 'معتمدة',
      payable: 'جاهزة للصرف',
      paid: 'صرف مسجل',
      canceled: 'ملغاة',
    },
    nextAction: {
      calculated: 'اعتماد',
      approved: 'جاهزة للصرف',
      payable: 'تسجيل صرف خارجي',
      paid: '—',
      canceled: '—',
    },
    thDeal: 'الصفقة',
    thGross: 'الإجمالي',
    thStatus: 'الحالة',
    thAction: 'إجراء',
    linesTitle: 'التقسيم',
    close: 'إغلاق',
    emptyTitle: 'لا توجد عمولات مطابقة.',
  },
};

@Component({
  selector: 'app-commissions',
  imports: [FormsModule, RouterLink],
  templateUrl: './commissions.html',
  styleUrl: './commissions.scss',
})
export class Commissions implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyCommissionsApi);
  readonly auth = inject(AuthService);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('commissions.manage') ?? false,
  );
  readonly canContracts = computed(
    () => this.auth.user()?.permissions.includes('contracts.read') ?? false,
  );
  readonly canDocs = computed(
    () => this.auth.user()?.permissions.includes('documents.read') ?? false,
  );
  readonly canUpload = computed(
    () => this.auth.user()?.permissions.includes('documents.manage') ?? false,
  );
  commissions = signal<Commission[]>([]);
  statusFilter = signal<CommStatus | 'all'>('all');
  statuses: CommStatus[] = ['calculated', 'approved', 'payable', 'paid', 'canceled'];
  summary = signal<Record<string, string>>({});
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  page = signal(1);
  total = signal(0);
  search = '';
  selected = signal<Commission | null>(null);
  formOpen = signal(false);
  editing = signal<Commission | null>(null);
  contractOptions = signal<CompanyContract[]>([]);
  contractTotal = signal(0);
  contractPage = 0;
  contractQuery = '';
  selectedContract = signal<CompanyContract | null>(null);
  contractId = '';
  rate = '2.5';
  splits: Array<{ payeeId: string; pct: string }> = [{ payeeId: '', pct: '100' }];
  payees = signal<any[]>([]);
  actionTarget = signal<Commission | null>(null);
  action = '';
  reason = '';
  receiptId = '';
  paidDate = '';
  reference = '';
  receipts = signal<CompanyDocument[]>([]);
  receiptQuery = '';
  receiptPage = 0;
  receiptTotal = signal(0);
  requestId = crypto.randomUUID();
  private serial = 0;
  private detailSerial = 0;
  private contractSerial = 0;
  private selectionSerial = 0;
  private receiptSerial = 0;
  constructor() {
    void this.reload();
  }
  ngOnDestroy() {
    this.serial++;
    this.detailSerial++;
    this.contractSerial++;
    this.selectionSerial++;
    this.receiptSerial++;
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  contact(c: Commission) {
    return c.contact[this.lang()];
  }
  money(v: string) {
    return this.api.money(v);
  }
  date(v: string | null) {
    return v
      ? new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
          dateStyle: 'medium',
          timeZone: 'Africa/Cairo',
        }).format(new Date(v.length === 10 ? v + 'T12:00Z' : v))
      : '—';
  }
  changed() {
    this.requestId = crypto.randomUUID();
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    const q: Record<string, string> = { q: this.search, page: String(this.page()), limit: '30' };
    if (this.statusFilter() !== 'all') q['status'] = this.statusFilter();
    try {
      const r = await this.api.get<{
        items: Commission[];
        total: number;
        summary: Record<string, string>;
      }>('commissions', q);
      if (n !== this.serial) return;
      this.commissions.set(r.items);
      this.total.set(r.total);
      this.summary.set(r.summary);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter(s: CommStatus | 'all' = this.statusFilter()) {
    this.statusFilter.set(s);
    this.page.set(1);
    void this.reload();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  async open(id: string) {
    const n = ++this.detailSerial;
    try {
      const c = await this.api.get<Commission>('commissions/' + id);
      if (n === this.detailSerial) this.selected.set(c);
    } catch (e: any) {
      if (n === this.detailSerial) this.error.set(e.message);
    }
  }
  close() {
    this.detailSerial++;
    this.selected.set(null);
  }
  async calculate(c: Commission | null = null) {
    this.editing.set(c);
    this.formOpen.set(true);
    this.error.set('');
    this.changed();
    this.contractId = c?.contractId ?? '';
    this.rate = c ? String(c.rateBps / 100) : '2.5';
    this.splits = c
      ? c.lines.map((l) => ({ payeeId: l.payeeId ?? '', pct: String(l.shareBps / 100) }))
      : [{ payeeId: '', pct: '100' }];
    this.selectedContract.set(null);
    try {
      const o = await this.api.get<any>('commissions/options');
      if (!this.formOpen()) return;
      this.payees.set(o.payees);
      await this.loadContracts(true);
      if (c) await this.chooseContract();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }
  async loadContracts(reset: boolean) {
    const n = ++this.contractSerial,
      page = reset ? 1 : this.contractPage + 1;
    try {
      const r = await this.api.get<any>('contracts', {
        q: this.contractQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.contractSerial) return;
      let items = reset ? r.items : [...this.contractOptions(), ...r.items];
      if (this.contractId && !items.some((c: any) => c.id === this.contractId)) {
        const c = await this.api.get<CompanyContract>('contracts/' + this.contractId);
        if (n !== this.contractSerial) return;
        items = [c, ...items];
      }
      this.contractOptions.set(items);
      this.contractTotal.set(r.total);
      this.contractPage = page;
    } catch (e: any) {
      if (n === this.contractSerial) this.error.set(e.message);
    }
  }
  async chooseContract() {
    const n = ++this.selectionSerial;
    this.changed();
    this.selectedContract.set(null);
    if (!this.contractId) return;
    try {
      const c = await this.api.get<CompanyContract>('contracts/' + this.contractId);
      if (n === this.selectionSerial) this.selectedContract.set(c);
    } catch (e: any) {
      if (n === this.selectionSerial) this.error.set(e.message);
    }
  }
  async save() {
    const c = this.selectedContract();
    if (!c || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const old = this.editing(),
        b: Record<string, unknown> = {
          requestId: this.requestId,
          contractId: c.id,
          contractVersion: c.version,
          rateBps: Number(minorAmount(this.rate)),
          splits: this.splits.map((s) => ({
            payeeId: s.payeeId || null,
            shareBps: Number(minorAmount(s.pct)),
          })),
          ...(old ? { version: old.version } : {}),
        };
      const m = await this.api.write<Commission>(
        'commissions' + (old ? '/' + old.id + '/recalculate' : ''),
        b,
      );
      this.formOpen.set(false);
      await this.reload();
      await this.open(m.id);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  advance(c: Commission, action = '') {
    this.changed();
    this.actionTarget.set(c);
    this.action =
      action ||
      {
        calculated: 'approve',
        approved: 'mark_payable',
        payable: 'record_paid',
        paid: '',
        canceled: '',
      }[c.status];
    this.reason = '';
    this.receiptId = '';
    this.paidDate = '';
    this.reference = '';
    this.error.set('');
    this.receipts.set([]);
    if (['mark_payable', 'record_paid'].includes(this.action) && this.canDocs())
      void this.loadReceipts(true);
  }
  async loadReceipts(reset: boolean) {
    const c = this.actionTarget();
    if (!c) return;
    const n = ++this.receiptSerial,
      page = reset ? 1 : this.receiptPage + 1;
    try {
      const r = await this.api.get<any>('documents', {
        kind: 'receipt',
        contractId: c.contractId,
        q: this.receiptQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.receiptSerial) return;
      const items = r.items.filter((d: CompanyDocument) => !d.expired && !d.archivedAt);
      this.receipts.set(reset ? items : [...this.receipts(), ...items]);
      this.receiptTotal.set(r.total);
      this.receiptPage = page;
    } catch (e: any) {
      if (n === this.receiptSerial) this.error.set(e.message);
    }
  }
  async apply() {
    const c = this.actionTarget();
    if (!c || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const b: Record<string, unknown> = {
        requestId: this.requestId,
        version: c.version,
        action: this.action,
        reason: this.reason,
      };
      if (['mark_payable', 'record_paid'].includes(this.action)) b['documentId'] = this.receiptId;
      if (this.action === 'record_paid') {
        b['reference'] = this.reference;
        b['paidDate'] = this.paidDate;
      }
      await this.api.write('commissions/' + c.id + '/action', b);
      this.actionTarget.set(null);
      await this.reload();
      if (this.selected()?.id === c.id) await this.open(c.id);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
