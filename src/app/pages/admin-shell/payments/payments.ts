import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PaymentMethod = 'card' | 'bank' | 'instapay';
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';
type Reconciliation = 'matched' | 'unmatched' | 'pending';
type SortKey = 'txId' | 'company' | 'amount' | 'date' | 'status';

interface Payment {
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

const SEED: Payment[] = [
  { txId: 'TX-50001', companyId: 'MJ-1001', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', invoiceNumber: 'INV-2026-0001', method: 'bank', amount: 20976, paidAt: 'Oct 9, 2026', status: 'completed', gatewayRef: 'PGW-88213', reconciliation: 'matched' },
  { txId: 'TX-50002', companyId: 'MJ-1003', companyEn: 'Deira Properties', companyAr: 'ديرة العقارية', invoiceNumber: 'INV-2026-0002', method: 'card', amount: 8208, paidAt: 'Oct 6, 2026', status: 'completed', gatewayRef: 'PGW-88244', reconciliation: 'matched' },
  { txId: 'TX-50003', companyId: 'MJ-1005', companyEn: 'Smart Spaces', companyAr: 'سمارت سبيسز', invoiceNumber: 'INV-2026-0004', method: 'bank', amount: 18012, paidAt: 'Sep 16, 2026', status: 'completed', gatewayRef: 'PGW-87190', reconciliation: 'matched' },
  { txId: 'TX-50004', companyId: 'MJ-1006', companyEn: 'Zamalek Realty Group', companyAr: 'مجموعة الزمالك العقارية', invoiceNumber: 'INV-2026-0005', method: 'card', amount: 5400, paidAt: 'Oct 4, 2026', status: 'failed', gatewayRef: 'PGW-88301', reconciliation: 'unmatched' },
  { txId: 'TX-50005', companyId: 'MJ-1007', companyEn: 'October Living', companyAr: 'أكتوبر ليفينج', invoiceNumber: 'INV-2026-0006', method: 'bank', amount: 61788, paidAt: 'Oct 2, 2026', status: 'completed', gatewayRef: 'PGW-88102', reconciliation: 'matched' },
  { txId: 'TX-50006', companyId: 'MJ-1011', companyEn: 'New Capital Homes', companyAr: 'نيو كابيتال هومز', invoiceNumber: 'INV-2026-0008', method: 'bank', amount: 61500, paidAt: 'Aug 10, 2026', status: 'completed', gatewayRef: 'PGW-82044', reconciliation: 'matched' },
  { txId: 'TX-50007', companyId: 'MJ-1012', companyEn: 'Heliopolis Estates', companyAr: 'مصر الجديدة العقارية', invoiceNumber: 'INV-2026-0009', method: 'card', amount: 4000, paidAt: 'Oct 10, 2026', status: 'completed', gatewayRef: 'PGW-88290', reconciliation: 'pending' },
  { txId: 'TX-50008', companyId: 'MJ-1015', companyEn: 'Smart Homes Egypt', companyAr: 'سمارت هومز إيجيبت', invoiceNumber: 'INV-2026-0012', method: 'card', amount: 10146, paidAt: 'Oct 1, 2026', status: 'completed', gatewayRef: 'PGW-88020', reconciliation: 'matched' },
  { txId: 'TX-50009', companyId: 'MJ-1017', companyEn: 'Capital Gate Developers', companyAr: 'كابيتال جيت للتطوير', invoiceNumber: 'INV-2026-0013', method: 'bank', amount: 27018, paidAt: 'Feb 6, 2026', status: 'completed', gatewayRef: 'PGW-61820', reconciliation: 'matched' },
  { txId: 'TX-50010', companyId: 'MJ-1018', companyEn: 'Blue Lagoon Realty', companyAr: 'بلو لاجون العقارية', invoiceNumber: 'INV-2026-0014', method: 'card', amount: 2394, paidAt: 'Oct 7, 2026', status: 'completed', gatewayRef: 'PGW-88260', reconciliation: 'matched' },
  { txId: 'TX-50011', companyId: 'MJ-1001', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', invoiceNumber: 'INV-2026-0019', method: 'bank', amount: 20976, paidAt: 'Sep 8, 2026', status: 'refunded', gatewayRef: 'PGW-85110', reconciliation: 'matched' },
  { txId: 'TX-50012', companyId: 'MJ-1009', companyEn: 'Golden Sands Developers', companyAr: 'الرمال الذهبية للتطوير', invoiceNumber: 'INV-2026-0020', method: 'instapay', amount: 22344, paidAt: 'Sep 18, 2026', status: 'completed', gatewayRef: 'PGW-85540', reconciliation: 'matched' },
  { txId: 'TX-50013', companyId: 'MJ-1022', companyEn: 'Palm Hills Partners', companyAr: 'بالم هيلز بارتنرز', invoiceNumber: 'INV-2026-0016', method: 'bank', amount: 14300, paidAt: 'Sep 29, 2026', status: 'failed', gatewayRef: 'PGW-86650', reconciliation: 'unmatched' },
  { txId: 'TX-50014', companyId: 'MJ-1014', companyEn: 'Nasr City Realty', companyAr: 'مدينة نصر العقارية', invoiceNumber: 'INV-2026-0011', method: 'instapay', amount: 1500, paidAt: 'Oct 20, 2026', status: 'completed', gatewayRef: 'PGW-88410', reconciliation: 'pending' },
  { txId: 'TX-50015', companyId: 'MJ-1012', companyEn: 'Heliopolis Estates', companyAr: 'مصر الجديدة العقارية', invoiceNumber: 'INV-2026-0009', method: 'card', amount: 3400, paidAt: 'Oct 22, 2026', status: 'partial_refund', gatewayRef: 'PGW-88450', reconciliation: 'matched' },
  { txId: 'TX-50016', companyId: 'MJ-1004', companyEn: 'Coastal Homes', companyAr: 'كوستال هومز', invoiceNumber: 'INV-2026-0003', method: 'card', amount: 2964, paidAt: 'Oct 24, 2026', status: 'pending', gatewayRef: 'PGW-88501', reconciliation: 'pending' },
  { txId: 'TX-50017', companyId: 'MJ-1023', companyEn: 'Metro Realty Group', companyAr: 'مترو العقارية', invoiceNumber: 'INV-2026-0017', method: 'card', amount: 6726, paidAt: 'Oct 25, 2026', status: 'pending', gatewayRef: 'PGW-88520', reconciliation: 'pending' },
  { txId: 'TX-50018', companyId: 'MJ-1009', companyEn: 'Golden Sands Developers', companyAr: 'الرمال الذهبية للتطوير', invoiceNumber: 'INV-2026-0007', method: 'bank', amount: 22344, paidAt: 'Oct 26, 2026', status: 'pending', gatewayRef: 'PGW-88530', reconciliation: 'unmatched' },
];

const METHOD_LABEL: Record<Lang, Record<PaymentMethod, string>> = {
  en: { card: 'Card', bank: 'Bank transfer', instapay: 'InstaPay' },
  ar: { card: 'بطاقة', bank: 'تحويل بنكي', instapay: 'إنستاباي' },
};

const STATUS_LABEL: Record<Lang, Record<PaymentStatus, string>> = {
  en: { pending: 'Pending', completed: 'Completed', failed: 'Failed', refunded: 'Refunded', partial_refund: 'Partially refunded' },
  ar: { pending: 'معلّقة', completed: 'مكتملة', failed: 'فاشلة', refunded: 'مستردة', partial_refund: 'مستردة جزئيًا' },
};

const STATUS_COLOR: Record<PaymentStatus, { bg: string; fg: string }> = {
  pending: { bg: '#E6E8FB', fg: '#2B37A0' },
  completed: { bg: '#DCEEE1', fg: '#2F7A4F' },
  failed: { bg: '#F8E1DC', fg: '#9A3422' },
  refunded: { bg: '#EEEDE8', fg: '#6B6A65' },
  partial_refund: { bg: '#F6E6CB', fg: '#9A6B1E' },
};

const RECON_LABEL: Record<Lang, Record<Reconciliation, string>> = {
  en: { matched: 'Matched', unmatched: 'Unmatched', pending: 'Pending' },
  ar: { matched: 'مطابقة', unmatched: 'غير مطابقة', pending: 'قيد المطابقة' },
};

const RECON_COLOR: Record<Reconciliation, { bg: string; fg: string }> = {
  matched: { bg: '#DCEEE1', fg: '#2F7A4F' },
  unmatched: { bg: '#F8E1DC', fg: '#9A3422' },
  pending: { bg: '#EEEDE8', fg: '#6B6A65' },
};

interface Copy {
  eyebrow: string;
  title: string;
  searchPh: string;
  statusAll: string;
  methodAll: string;
  kpis: { collected: string; completed: string; failed: string; refunded: string };
  columns: { txId: string; company: string; invoice: string; method: string; amount: string; date: string; status: string; reconciliation: string };
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
    kpis: { collected: 'Collected', completed: 'Completed', failed: 'Failed', refunded: 'Refunded' },
    columns: { txId: 'Transaction', company: 'Company', invoice: 'Invoice', method: 'Method', amount: 'Amount', date: 'Date', status: 'Status', reconciliation: 'Reconciliation' },
    actions: { view: 'View', refund: 'Refund' },
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
    refundTitle: 'Refund payment',
    refundSub: (txId) => `${txId} · refunds require a reason and a TOTP code.`,
    refundFull: 'Full refund',
    refundPartial: 'Partial refund',
    refundAmount: 'Refund amount (EGP)',
    refundReasonPh: 'Reason for the refund',
    refundTotp: 'TOTP code',
    refundTotpPh: '6-digit authenticator code',
    cancel: 'Cancel',
    confirmGo: 'Confirm refund',
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
    columns: { txId: 'المعاملة', company: 'الشركة', invoice: 'الفاتورة', method: 'طريقة الدفع', amount: 'المبلغ', date: 'التاريخ', status: 'الحالة', reconciliation: 'المطابقة' },
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
    refundTitle: 'استرداد الدفعة',
    refundSub: (txId) => `${txId} · يتطلب الاسترداد سببًا ورمز TOTP.`,
    refundFull: 'استرداد كامل',
    refundPartial: 'استرداد جزئي',
    refundAmount: 'مبلغ الاسترداد (ج.م)',
    refundReasonPh: 'سبب الاسترداد',
    refundTotp: 'رمز TOTP',
    refundTotpPh: 'رمز المصادقة المكوّن من 6 أرقام',
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
  styleUrl: './payments.scss',
})
export class Payments {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: PaymentStatus[] = ['pending', 'completed', 'failed', 'refunded', 'partial_refund'];
  readonly methodTypes: PaymentMethod[] = ['card', 'bank', 'instapay'];

  private readonly payments = signal<Payment[]>(SEED);

  readonly search = signal('');
  readonly statusFilter = signal<PaymentStatus | 'all'>('all');
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
      collected: list.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
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
      if (status !== 'all' && p.status !== status) return false;
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

  statusColor(s: PaymentStatus): { bg: string; fg: string } {
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
    return this.lang() === 'ar' ? `${v.toLocaleString('en-US')} ج.م` : `EGP ${v.toLocaleString('en-US')}`;
  }

  canRefund(p: Payment): boolean {
    return p.status === 'completed' || p.status === 'partial_refund';
  }

  private readonly logoPalette = ['#3D4FD6', '#7E89E6', '#16182A', '#9A6B1E', '#2F7A4F', '#B4442F'];

  logoBg(p: Payment): string {
    const code = p.companyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return this.logoPalette[code % this.logoPalette.length];
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

  setStatusFilter(v: PaymentStatus | 'all'): void {
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

  openView(p: Payment): void {
    this.viewing.set(p);
    this.kebabFor.set(null);
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
    this.refunding.set(p);
    this.refundMode.set('full');
    this.refundAmount.set(String(p.amount));
    this.refundReason.set('');
    this.refundTotp.set('');
    this.refundError.set('');
    this.kebabFor.set(null);
  }

  closeRefund(): void {
    this.refunding.set(null);
  }

  setRefundMode(mode: 'full' | 'partial'): void {
    this.refundMode.set(mode);
    const p = this.refunding();
    if (!p) return;
    if (mode === 'full') this.refundAmount.set(String(p.amount));
  }

  submitRefund(): void {
    const target = this.refunding();
    if (!target) return;
    if (this.refundReason().trim().length < 5) {
      this.refundError.set(this.L().reasonErr);
      return;
    }
    if (!/^\d{6}$/.test(this.refundTotp().trim())) {
      this.refundError.set(this.L().totpErr);
      return;
    }
    const amount = Number(this.refundAmount()) || 0;
    const status: PaymentStatus = amount >= target.amount ? 'refunded' : 'partial_refund';
    this.payments.update((list) => list.map((p) => (p.txId === target.txId ? { ...p, status } : p)));
    this.closeRefund();
    this.showToast(this.L().toastRefunded(target.txId));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
