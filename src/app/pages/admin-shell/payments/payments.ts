import { BillingApi, toMinor } from '../../../billing-api.service';
import { Router } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PaymentMethod = 'card' | 'bank' | 'instapay';
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';
type Reconciliation = 'matched' | 'unmatched' | 'pending';
type SortKey = 'txId' | 'company' | 'amount' | 'date' | 'status';

interface Payment {
  refunds?: Array<{ number: string; amountMinor: string; reason: string; createdAt: string }>;
  version: number;
  amountMinor: string;
  refundedMinor: string;
  netMinor: string;
  txId: string;
  companyId: string;
  companyEn: string;
  companyAr: string;
  invoiceNumber: string;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  status: PaymentStatus;
  gatewayRef: string;
  reconciliation: Reconciliation;
}

const METHOD_LABEL: Record<Lang, Record<PaymentMethod, string>> = {
  en: { card: 'Card', bank: 'Bank transfer', instapay: 'InstaPay' },
  ar: { card: 'بطاقة', bank: 'تحويل بنكي', instapay: 'إنستاباي' },
};

const STATUS_LABEL: Record<Lang, Record<PaymentStatus, string>> = {
  en: {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded',
    partial_refund: 'Partially refunded',
  },
  ar: {
    pending: 'معلّقة',
    completed: 'مكتملة',
    failed: 'فاشلة',
    refunded: 'مستردة',
    partial_refund: 'مستردة جزئيًا',
  },
};

const STATUS_COLOR: Record<PaymentStatus, { bg: string; fg: string; dot: string }> = {
  pending: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
  completed: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
  failed: { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' },
  refunded: { bg: '#F1F1ED', fg: '#6E6E73', dot: '#B4B4AE' },
  partial_refund: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
};
type Tab = 'all' | 'completed' | 'pending' | 'refunded' | 'partial_refund';
const LOGO: Array<[string, string]> = [
  ['#EEF5D6', '#3F5A0E'],
  ['#E6EEFB', '#274A93'],
  ['#F6E8DE', '#8A4A1E'],
  ['#EDE7F8', '#55349A'],
  ['#E3F2EF', '#1D6458'],
  ['#F7E4E7', '#933045'],
];

const RECON_LABEL: Record<Lang, Record<Reconciliation, string>> = {
  en: { matched: 'Matched', unmatched: 'Unmatched', pending: 'Pending' },
  ar: { matched: 'مطابقة', unmatched: 'غير مطابقة', pending: 'قيد المطابقة' },
};

const RECON_COLOR: Record<Reconciliation, { bg: string; fg: string }> = {
  matched: { bg: '#e7f5ec', fg: '#1e6b3e' },
  unmatched: { bg: '#fbe7e3', fg: '#a23624' },
  pending: { bg: '#eeeeea', fg: '#6e6e73' },
};

interface Copy {
  eyebrow: string;
  title: string;
  searchPh: string;
  statusAll: string;
  methodAll: string;
  kpis: { collected: string; completed: string; failed: string; refunded: string };
  columns: {
    txId: string;
    company: string;
    invoice: string;
    method: string;
    amount: string;
    date: string;
    status: string;
    reconciliation: string;
  };
  actions: { view: string; refund: string };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: {
    txId: string;
    company: string;
    invoice: string;
    method: string;
    amount: string;
    date: string;
    status: string;
    gatewayRef: string;
    reconciliation: string;
  };
  refundTitle: string;
  refundSub: (txId: string) => string;
  refundFull: string;
  refundPartial: string;
  refundAmount: string;
  refundReasonPh: string;
  refundTotp: string;
  refundTotpPh: string;
  cancel: string;
  confirmGo: string;
  reasonErr: string;
  totpErr: string;
  toastRefunded: (txId: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Billing',
    title: 'Payments',
    searchPh: 'Search transaction, company, invoice…',
    statusAll: 'All statuses',
    methodAll: 'All methods',
    kpis: {
      collected: 'Collected',
      completed: 'Completed',
      failed: 'Failed',
      refunded: 'Refunded',
    },
    columns: {
      txId: 'Transaction',
      company: 'Company',
      invoice: 'Invoice',
      method: 'Method',
      amount: 'Amount',
      date: 'Date',
      status: 'Status',
      reconciliation: 'Reconciliation',
    },
    actions: { view: 'View', refund: 'Record refund' },
    pager: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    prev: 'Previous',
    next: 'Next',
    emptyTitle: 'No payments match your filters',
    emptySub: 'Try clearing the search or filters.',
    drawerClose: 'Close',
    drawerFields: {
      txId: 'Transaction',
      company: 'Company',
      invoice: 'Invoice',
      method: 'Method',
      amount: 'Amount',
      date: 'Date',
      status: 'Status',
      gatewayRef: 'Gateway response',
      reconciliation: 'Reconciliation match',
    },
    refundTitle: 'Record external refund',
    refundSub: (txId) =>
      `${txId} · record an already completed external refund. No money is transferred.`,
    refundFull: 'Full refund',
    refundPartial: 'Partial refund',
    refundAmount: 'Refund amount (EGP)',
    refundReasonPh: 'Reason for the refund',
    refundTotp: 'Confirm your password',
    refundTotpPh: 'Your current password',
    cancel: 'Cancel',
    confirmGo: 'Record refund',
    reasonErr: 'A reason is required.',
    totpErr: 'Enter the 6-digit code.',
    toastRefunded: (txId) => `${txId} was refunded.`,
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'المدفوعات',
    searchPh: 'ابحث بالمعاملة أو الشركة أو الفاتورة…',
    statusAll: 'كل الحالات',
    methodAll: 'كل طرق الدفع',
    kpis: { collected: 'المُحصَّل', completed: 'مكتملة', failed: 'فاشلة', refunded: 'مستردة' },
    columns: {
      txId: 'المعاملة',
      company: 'الشركة',
      invoice: 'الفاتورة',
      method: 'طريقة الدفع',
      amount: 'المبلغ',
      date: 'التاريخ',
      status: 'الحالة',
      reconciliation: 'المطابقة',
    },
    actions: { view: 'عرض', refund: 'استرداد' },
    pager: (from, to, total) => `عرض ${from}–${to} من ${total}`,
    prev: 'السابق',
    next: 'التالي',
    emptyTitle: 'لا توجد مدفوعات مطابقة للفلاتر',
    emptySub: 'جرّب مسح البحث أو الفلاتر.',
    drawerClose: 'إغلاق',
    drawerFields: {
      txId: 'المعاملة',
      company: 'الشركة',
      invoice: 'الفاتورة',
      method: 'طريقة الدفع',
      amount: 'المبلغ',
      date: 'التاريخ',
      status: 'الحالة',
      gatewayRef: 'استجابة بوابة الدفع',
      reconciliation: 'مطابقة التسوية',
    },
    refundTitle: 'تسجيل استرداد خارجي',
    refundSub: (txId) => `${txId} · تسجيل استرداد تم خارج المنصة. لا يتم تحويل أموال.`,
    refundFull: 'استرداد كامل',
    refundPartial: 'استرداد جزئي',
    refundAmount: 'مبلغ الاسترداد (ج.م)',
    refundReasonPh: 'سبب الاسترداد',
    refundTotp: 'تأكيد كلمة المرور',
    refundTotpPh: 'كلمة المرور الحالية',
    cancel: 'إلغاء',
    confirmGo: 'تأكيد الاسترداد',
    reasonErr: 'السبب مطلوب.',
    totpErr: 'أدخل الرمز المكوّن من 6 أرقام.',
    toastRefunded: (txId) => `تم استرداد ${txId}.`,
  },
};

const PAGE_SIZE = 10;

@Component({
  selector: 'app-payments',
  templateUrl: './payments.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './payments.scss'],
})
export class Payments {
  readonly NumberValue = Number;
  private readonly api = inject(BillingApi);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  private requestId = crypto.randomUUID();
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.payments.set(
        (await this.api.list<Payment>('payments')).map((p) => ({
          ...p,
          amount: Number(p.amountMinor) / 100,
        })),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load payments');
    } finally {
      this.loading.set(false);
    }
  }
  async reconcile(p: Payment, value: string) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.payment(p.txId, 'reconcile', {
        version: p.version,
        requestId: crypto.randomUUID(),
        reconciliation: value,
      });
      this.viewing.set(null);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update reconciliation');
    } finally {
      this.saving.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: PaymentStatus[] = [
    'pending',
    'completed',
    'failed',
    'refunded',
    'partial_refund',
  ];
  readonly methodTypes: PaymentMethod[] = ['card', 'bank', 'instapay'];

  private readonly payments = signal<Payment[]>([]);

  readonly search = signal('');
  readonly statusFilter = signal<Tab>('all');
  readonly methodFilter = signal<PaymentMethod | 'all'>('all');
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);

  readonly viewing = signal<Payment | null>(null);
  readonly kebabFor = signal<string | null>(null);

  readonly refunding = signal<Payment | null>(null);
  readonly refundMode = signal<'full' | 'partial'>('full');
  readonly refundAmount = signal('');
  readonly refundReason = signal('');
  readonly refundTotp = signal('');
  readonly refundError = signal('');

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly kpis = computed(() => {
    const list = this.payments();
    return {
      collected: list.reduce((s, p) => s + Number(p.netMinor) / 100, 0),
      completed: list.filter((p) => p.status === 'completed').length,
      failed: list.filter((p) => p.status === 'failed').length,
      refunded: list.filter((p) => p.status === 'refunded' || p.status === 'partial_refund').length,
    };
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const method = this.methodFilter();
    return this.payments().filter((p) => {
      if (!this.inTab(p, status)) return false;
      if (method !== 'all' && p.method !== method) return false;
      if (!q) return true;
      return (
        p.txId.toLowerCase().includes(q) ||
        p.companyEn.toLowerCase().includes(q) ||
        p.companyAr.includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q)
      );
    });
  });

  readonly sorted = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const lang = this.lang();
    return [...this.filtered()].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (key) {
        case 'txId':
          av = a.txId;
          bv = b.txId;
          break;
        case 'company':
          av = lang === 'ar' ? a.companyAr : a.companyEn;
          bv = lang === 'ar' ? b.companyAr : b.companyEn;
          break;
        case 'amount':
          av = a.amount;
          bv = b.amount;
          break;
        case 'date':
          av = a.paidAt;
          bv = b.paidAt;
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / PAGE_SIZE)));

  readonly pageRows = computed(() => {
    const p = Math.min(this.page(), this.totalPages());
    const start = (p - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });

  readonly pagerText = computed(() => {
    const total = this.sorted().length;
    if (total === 0) return this.L().pager(0, 0, 0);
    const p = Math.min(this.page(), this.totalPages());
    const from = (p - 1) * PAGE_SIZE + 1;
    const to = Math.min(p * PAGE_SIZE, total);
    return this.L().pager(from, to, total);
  });

  methodLabel(m: PaymentMethod): string {
    return METHOD_LABEL[this.lang()][m];
  }

  statusLabel(s: PaymentStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: PaymentStatus): { bg: string; fg: string; dot: string } {
    return STATUS_COLOR[s];
  }

  reconLabel(r: Reconciliation): string {
    return RECON_LABEL[this.lang()][r];
  }

  reconColor(r: Reconciliation): { bg: string; fg: string } {
    return RECON_COLOR[r];
  }

  companyName(p: Payment): string {
    return this.lang() === 'ar' ? p.companyAr : p.companyEn;
  }

  formatMoney(v: number): string {
    return this.lang() === 'ar'
      ? `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`
      : `EGP ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  canRefund(p: Payment): boolean {
    return p.status === 'completed' || p.status === 'partial_refund';
  }

  private logo(p: Payment): [string, string] {
    const code = p.companyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return LOGO[code % LOGO.length];
  }
  logoBg(p: Payment): string {
    return this.logo(p)[0];
  }
  logoFg(p: Payment): string {
    return this.logo(p)[1];
  }
  /** "Pending" = recorded but not yet matched against the bank statement (reconciliation pending). */
  inTab(p: Payment, t: Tab) {
    return t === 'all' || (t === 'pending' ? p.reconciliation === 'pending' : p.status === t);
  }
  readonly tabs = computed(() => {
    const ar = this.lang() === 'ar';
    const list: Array<[Tab, string, string]> = [
      ['all', 'All', 'الكل'],
      ['completed', 'Completed', 'مكتملة'],
      ['pending', 'Pending reconciliation', 'بانتظار المطابقة'],
      ['refunded', 'Refunded', 'مستردة'],
      ['partial_refund', 'Partially refunded', 'مستردة جزئيًا'],
    ];
    return list.map(([k, en, a]) => ({
      k,
      label: ar ? a : en,
      n: this.payments().filter((p) => this.inTab(p, k)).length,
    }));
  });
  readonly hasFilters = computed(
    () => !!this.search().trim() || this.statusFilter() !== 'all' || this.methodFilter() !== 'all',
  );
  clearFilters() {
    this.search.set('');
    this.statusFilter.set('all');
    this.methodFilter.set('all');
    this.page.set(1);
  }
  readonly stats = computed(() => {
    const list = this.payments();
    const since = Date.now() - 30 * 86400000;
    const year = String(new Date().getFullYear());
    const recent = list.filter((p) => new Date(p.paidAt).getTime() >= since);
    return {
      collected30: recent.reduce((n, p) => n + Number(p.netMinor) / 100, 0),
      recentN: recent.length,
      pending: list.filter((p) => p.reconciliation === 'pending').length,
      unmatched: list.filter((p) => p.reconciliation === 'unmatched').length,
      refundedYear: list
        .filter((p) => p.paidAt.startsWith(year))
        .reduce((n, p) => n + Number(p.refundedMinor) / 100, 0),
    };
  });
  short(v: number) {
    return 'EGP ' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v).toLocaleString('en-US'));
  }
  minor(v: string) {
    return Number(v) / 100;
  }
  date(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  /** Gateway-only actions; static until a payment gateway / bank import exists (see BACKEND_MISSING.md). */
  notConnected(what: 'bankFile' | 'retry') {
    this.kebabFor.set(null);
    const ar = this.lang() === 'ar';
    this.showToast(
      what === 'bankFile'
        ? ar
          ? 'استيراد ملف البنك غير متصل بعد — لم تتم مطابقة شيء.'
          : "Bank-file import isn't connected yet — nothing was matched."
        : ar
          ? 'إعادة محاولة الدفع تتطلب بوابة الدفع — غير متاحة بعد.'
          : 'Retrying a charge needs the payment gateway — not available yet.',
    );
  }
  goInvoice(p: Payment) {
    void this.router.navigateByUrl('/admin/billing?invoice=' + encodeURIComponent(p.invoiceNumber));
  }

  logoInitials(p: Payment): string {
    return p.companyEn
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  setSearch(v: string): void {
    this.search.set(v);
    this.page.set(1);
  }

  setStatusFilter(v: Tab): void {
    this.statusFilter.set(v);
    this.page.set(1);
  }

  setMethodFilter(v: PaymentMethod | 'all'): void {
    this.methodFilter.set(v);
    this.page.set(1);
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  prevPage(): void {
    this.page.set(Math.max(1, this.page() - 1));
  }

  nextPage(): void {
    this.page.set(Math.min(this.totalPages(), this.page() + 1));
  }

  async openView(p: Payment) {
    this.kebabFor.set(null);
    try {
      const detail = await this.api.details('payments', p.txId);
      this.viewing.set({ ...detail, amount: Number(detail.amountMinor) / 100 });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load payment');
    }
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleKebab(txId: string): void {
    this.kebabFor.set(this.kebabFor() === txId ? null : txId);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  openRefund(p: Payment): void {
    this.requestId = crypto.randomUUID();
    this.refunding.set(p);
    this.refundMode.set('full');
    this.refundAmount.set(String((Number(p.amountMinor) - Number(p.refundedMinor)) / 100));
    this.refundReason.set('');
    this.refundTotp.set('');
    this.refundError.set('');
    this.kebabFor.set(null);
  }

  closeRefund(): void {
    this.refundTotp.set('');
    this.refunding.set(null);
  }

  setRefundMode(mode: 'full' | 'partial'): void {
    this.refundMode.set(mode);
    const p = this.refunding();
    if (!p) return;
    if (mode === 'full')
      this.refundAmount.set(String((Number(p.amountMinor) - Number(p.refundedMinor)) / 100));
  }

  async submitRefund() {
    const p = this.refunding();
    if (!p || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.payment(p.txId, 'refunds', {
        version: p.version,
        requestId: this.requestId,
        amountMinor: toMinor(this.refundAmount()),
        reason: this.refundReason(),
        password: this.refundTotp(),
      });
      this.refundTotp.set('');
      this.closeRefund();
      this.viewing.set(null);
      await this.reload();
      this.showToast(
        this.lang() === 'ar'
          ? `تم تسجيل الاسترداد لـ ${p.txId}.`
          : `Refund recorded for ${p.txId}.`,
      );
    } catch (error) {
      this.refundError.set(error instanceof Error ? error.message : 'Unable to record refund');
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
