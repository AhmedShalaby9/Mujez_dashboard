import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'partial' | 'overdue' | 'void';
type TaxProfile = 'standard' | 'reverse_charge';
type SortKey = 'number' | 'company' | 'issue' | 'due' | 'total' | 'status';

interface Invoice {
  number: string;
  companyId: string;
  companyEn: string;
  companyAr: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxProfile: TaxProfile;
  status: InvoiceStatus;
  paidAmount: number;
}

function withTotal(subtotal: number, taxProfile: TaxProfile): { tax: number; total: number } {
  const tax = taxProfile === 'reverse_charge' ? 0 : Math.round(subtotal * 0.14);
  return { tax, total: subtotal + tax };
}

const SEED: Invoice[] = [
  { number: 'INV-2026-0001', companyId: 'MJ-1001', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', issueDate: 'Oct 1, 2026', dueDate: 'Oct 15, 2026', subtotal: 18400, taxProfile: 'standard', status: 'paid', paidAmount: 20976 },
  { number: 'INV-2026-0002', companyId: 'MJ-1003', companyEn: 'Deira Properties', companyAr: 'ديرة العقارية', issueDate: 'Oct 1, 2026', dueDate: 'Oct 15, 2026', subtotal: 7200, taxProfile: 'standard', status: 'paid', paidAmount: 8208 },
  { number: 'INV-2026-0003', companyId: 'MJ-1004', companyEn: 'Coastal Homes', companyAr: 'كوستال هومز', issueDate: 'Oct 1, 2026', dueDate: 'Oct 15, 2026', subtotal: 2600, taxProfile: 'standard', status: 'open', paidAmount: 0 },
  { number: 'INV-2026-0004', companyId: 'MJ-1005', companyEn: 'Smart Spaces', companyAr: 'سمارت سبيسز', issueDate: 'Sep 11, 2026', dueDate: 'Sep 25, 2026', subtotal: 15800, taxProfile: 'standard', status: 'paid', paidAmount: 18012 },
  { number: 'INV-2026-0005', companyId: 'MJ-1006', companyEn: 'Zamalek Realty Group', companyAr: 'مجموعة الزمالك العقارية', issueDate: 'Sep 20, 2026', dueDate: 'Oct 4, 2026', subtotal: 5400, taxProfile: 'standard', status: 'overdue', paidAmount: 0 },
  { number: 'INV-2026-0006', companyId: 'MJ-1007', companyEn: 'October Living', companyAr: 'أكتوبر ليفينج', issueDate: 'Sep 29, 2026', dueDate: 'Oct 13, 2026', subtotal: 54200, taxProfile: 'standard', status: 'paid', paidAmount: 61788 },
  { number: 'INV-2026-0007', companyId: 'MJ-1009', companyEn: 'Golden Sands Developers', companyAr: 'الرمال الذهبية للتطوير', issueDate: 'Oct 15, 2026', dueDate: 'Oct 29, 2026', subtotal: 19600, taxProfile: 'standard', status: 'open', paidAmount: 0 },
  { number: 'INV-2026-0008', companyId: 'MJ-1011', companyEn: 'New Capital Homes', companyAr: 'نيو كابيتال هومز', issueDate: 'Aug 4, 2026', dueDate: 'Aug 18, 2026', subtotal: 61500, taxProfile: 'reverse_charge', status: 'paid', paidAmount: 61500 },
  { number: 'INV-2026-0009', companyId: 'MJ-1012', companyEn: 'Heliopolis Estates', companyAr: 'مصر الجديدة العقارية', issueDate: 'Oct 1, 2026', dueDate: 'Oct 15, 2026', subtotal: 6800, taxProfile: 'standard', status: 'partial', paidAmount: 4000 },
  { number: 'INV-2026-0010', companyId: 'MJ-1013', companyEn: 'Maadi Properties Group', companyAr: 'مجموعة المعادي العقارية', issueDate: 'Aug 9, 2026', dueDate: 'Aug 23, 2026', subtotal: 3100, taxProfile: 'standard', status: 'void', paidAmount: 0 },
  { number: 'INV-2026-0011', companyId: 'MJ-1014', companyEn: 'Nasr City Realty', companyAr: 'مدينة نصر العقارية', issueDate: 'Oct 17, 2026', dueDate: 'Oct 31, 2026', subtotal: 3100, taxProfile: 'standard', status: 'open', paidAmount: 0 },
  { number: 'INV-2026-0012', companyId: 'MJ-1015', companyEn: 'Smart Homes Egypt', companyAr: 'سمارت هومز إيجيبت', issueDate: 'Sep 28, 2026', dueDate: 'Oct 12, 2026', subtotal: 8900, taxProfile: 'standard', status: 'paid', paidAmount: 10146 },
  { number: 'INV-2026-0013', companyId: 'MJ-1017', companyEn: 'Capital Gate Developers', companyAr: 'كابيتال جيت للتطوير', issueDate: 'Jan 30, 2026', dueDate: 'Feb 13, 2026', subtotal: 23700, taxProfile: 'standard', status: 'paid', paidAmount: 27018 },
  { number: 'INV-2026-0014', companyId: 'MJ-1018', companyEn: 'Blue Lagoon Realty', companyAr: 'بلو لاجون العقارية', issueDate: 'Oct 3, 2026', dueDate: 'Oct 17, 2026', subtotal: 2100, taxProfile: 'standard', status: 'paid', paidAmount: 2394 },
  { number: 'INV-2026-0015', companyId: 'MJ-1020', companyEn: 'Green Valley Homes', companyAr: 'جرين فالي هومز', issueDate: 'Nov 2, 2025', dueDate: 'Nov 16, 2025', subtotal: 6200, taxProfile: 'standard', status: 'void', paidAmount: 0 },
  { number: 'INV-2026-0016', companyId: 'MJ-1022', companyEn: 'Palm Hills Partners', companyAr: 'بالم هيلز بارتنرز', issueDate: 'Sep 15, 2026', dueDate: 'Sep 29, 2026', subtotal: 14300, taxProfile: 'standard', status: 'overdue', paidAmount: 0 },
  { number: 'INV-2026-0017', companyId: 'MJ-1023', companyEn: 'Metro Realty Group', companyAr: 'مترو العقارية', issueDate: 'Oct 19, 2026', dueDate: 'Nov 2, 2026', subtotal: 5900, taxProfile: 'standard', status: 'open', paidAmount: 0 },
  { number: 'INV-2026-0018', companyId: 'MJ-1005', companyEn: 'Smart Spaces', companyAr: 'سمارت سبيسز', issueDate: 'Oct 11, 2026', dueDate: 'Oct 25, 2026', subtotal: 15800, taxProfile: 'standard', status: 'draft', paidAmount: 0 },
  { number: 'INV-2026-0019', companyId: 'MJ-1001', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', issueDate: 'Sep 1, 2026', dueDate: 'Sep 15, 2026', subtotal: 18400, taxProfile: 'standard', status: 'paid', paidAmount: 20976 },
  { number: 'INV-2026-0020', companyId: 'MJ-1009', companyEn: 'Golden Sands Developers', companyAr: 'الرمال الذهبية للتطوير', issueDate: 'Sep 15, 2026', dueDate: 'Sep 29, 2026', subtotal: 19600, taxProfile: 'standard', status: 'paid', paidAmount: 22344 },
];

const STATUS_LABEL: Record<Lang, Record<InvoiceStatus, string>> = {
  en: { draft: 'Draft', open: 'Open', paid: 'Paid', partial: 'Partial', overdue: 'Overdue', void: 'Void' },
  ar: { draft: 'مسودة', open: 'مفتوحة', paid: 'مدفوعة', partial: 'مدفوعة جزئيًا', overdue: 'متأخرة', void: 'ملغاة' },
};

const STATUS_COLOR: Record<InvoiceStatus, { bg: string; fg: string }> = {
  draft: { bg: '#EEEDE8', fg: '#6B6A65' },
  open: { bg: '#E6E8FB', fg: '#2B37A0' },
  paid: { bg: '#DCEEE1', fg: '#2F7A4F' },
  partial: { bg: '#F6E6CB', fg: '#9A6B1E' },
  overdue: { bg: '#F8E1DC', fg: '#9A3422' },
  void: { bg: '#EEEDE8', fg: '#8A8983' },
};

interface Copy {
  eyebrow: string;
  title: string;
  searchPh: string;
  statusAll: string;
  kpis: { billed: string; collected: string; outstanding: string; overdue: string; failed: string };
  columns: { number: string; company: string; issue: string; due: string; total: string; status: string };
  actions: { view: string; recordPayment: string; voidInvoice: string; creditNote: string; send: string; pdf: string };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: { number: string; company: string; issue: string; due: string; subtotal: string; tax: string; reverseCharge: string; total: string; paid: string; status: string };
  recordTitle: string;
  recordSub: (number: string) => string;
  recordFull: string;
  recordPartial: string;
  recordAmount: string;
  recordBankRef: string;
  recordBankRefPh: string;
  voidTitle: string;
  voidBody: (number: string) => string;
  voidReasonPh: string;
  voidWarning: string;
  creditTitle: string;
  creditSub: (number: string) => string;
  creditAmount: string;
  creditReasonPh: string;
  cancel: string;
  confirmGo: string;
  reasonErr: string;
  toastRecorded: (number: string) => string;
  toastVoided: (number: string) => string;
  toastCredited: (number: string) => string;
  toastSent: (number: string) => string;
  toastPdf: (number: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Billing',
    title: 'Billing & invoices',
    searchPh: 'Search invoice number, company, ID…',
    statusAll: 'All statuses',
    kpis: { billed: 'Billed', collected: 'Collected', outstanding: 'Outstanding', overdue: 'Overdue', failed: 'Void' },
    columns: { number: 'Invoice', company: 'Company', issue: 'Issue date', due: 'Due date', total: 'Total', status: 'Status' },
    actions: { view: 'View', recordPayment: 'Record manual payment', voidInvoice: 'Void invoice', creditNote: 'Issue credit note', send: 'Send to customer', pdf: 'Download PDF' },
    pager: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    prev: 'Previous',
    next: 'Next',
    emptyTitle: 'No invoices match your filters',
    emptySub: 'Try clearing the search or filters.',
    drawerClose: 'Close',
    drawerFields: { number: 'Invoice', company: 'Company', issue: 'Issue date', due: 'Due date', subtotal: 'Subtotal', tax: 'VAT (14%)', reverseCharge: 'Reverse charge', total: 'Total', paid: 'Paid so far', status: 'Status' },
    recordTitle: 'Record manual payment',
    recordSub: (number) => `${number} · log a payment received outside the platform.`,
    recordFull: 'Full amount',
    recordPartial: 'Partial amount',
    recordAmount: 'Amount (EGP)',
    recordBankRef: 'Bank reference',
    recordBankRefPh: 'Transfer or reference number',
    voidTitle: 'Void invoice',
    voidBody: (number) => `${number} will be voided. This cannot be reopened.`,
    voidReasonPh: 'Reason for voiding (required)',
    voidWarning: 'This action is permanent.',
    creditTitle: 'Issue credit note',
    creditSub: (number) => `${number} · issue a credit note against this invoice.`,
    creditAmount: 'Credit amount (EGP)',
    creditReasonPh: 'Reason for the credit note',
    cancel: 'Cancel',
    confirmGo: 'Confirm',
    reasonErr: 'A reason is required.',
    toastRecorded: (number) => `Payment recorded for ${number}.`,
    toastVoided: (number) => `${number} was voided.`,
    toastCredited: (number) => `Credit note issued for ${number}.`,
    toastSent: (number) => `${number} was sent to the customer.`,
    toastPdf: (number) => `Static design preview — PDF generation for ${number} isn't connected.`,
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'الفوترة والفواتير',
    searchPh: 'ابحث برقم الفاتورة أو الشركة أو المعرّف…',
    statusAll: 'كل الحالات',
    kpis: { billed: 'المفوتر', collected: 'المُحصَّل', outstanding: 'المستحق', overdue: 'المتأخر', failed: 'الملغاة' },
    columns: { number: 'الفاتورة', company: 'الشركة', issue: 'تاريخ الإصدار', due: 'تاريخ الاستحقاق', total: 'الإجمالي', status: 'الحالة' },
    actions: { view: 'عرض', recordPayment: 'تسجيل دفعة يدوية', voidInvoice: 'إلغاء الفاتورة', creditNote: 'إصدار إشعار دائن', send: 'إرسال للعميل', pdf: 'تنزيل PDF' },
    pager: (from, to, total) => `عرض ${from}–${to} من ${total}`,
    prev: 'السابق',
    next: 'التالي',
    emptyTitle: 'لا توجد فواتير مطابقة للفلاتر',
    emptySub: 'جرّب مسح البحث أو الفلاتر.',
    drawerClose: 'إغلاق',
    drawerFields: { number: 'الفاتورة', company: 'الشركة', issue: 'تاريخ الإصدار', due: 'تاريخ الاستحقاق', subtotal: 'المجموع الفرعي', tax: 'ضريبة القيمة المضافة (14%)', reverseCharge: 'آلية التحويل العكسي', total: 'الإجمالي', paid: 'المدفوع حتى الآن', status: 'الحالة' },
    recordTitle: 'تسجيل دفعة يدوية',
    recordSub: (number) => `${number} · تسجيل دفعة تمت خارج المنصة.`,
    recordFull: 'المبلغ كاملاً',
    recordPartial: 'مبلغ جزئي',
    recordAmount: 'المبلغ (ج.م)',
    recordBankRef: 'مرجع بنكي',
    recordBankRefPh: 'رقم التحويل أو المرجع',
    voidTitle: 'إلغاء الفاتورة',
    voidBody: (number) => `سيتم إلغاء ${number}. لا يمكن التراجع عن هذا.`,
    voidReasonPh: 'سبب الإلغاء (مطلوب)',
    voidWarning: 'هذا الإجراء نهائي.',
    creditTitle: 'إصدار إشعار دائن',
    creditSub: (number) => `${number} · إصدار إشعار دائن مقابل هذه الفاتورة.`,
    creditAmount: 'مبلغ الإشعار (ج.م)',
    creditReasonPh: 'سبب إشعار الدائن',
    cancel: 'إلغاء',
    confirmGo: 'تأكيد',
    reasonErr: 'السبب مطلوب.',
    toastRecorded: (number) => `تم تسجيل الدفعة لـ ${number}.`,
    toastVoided: (number) => `تم إلغاء ${number}.`,
    toastCredited: (number) => `تم إصدار إشعار دائن لـ ${number}.`,
    toastSent: (number) => `تم إرسال ${number} إلى العميل.`,
    toastPdf: (number) => `معاينة تصميم ثابتة — إنشاء PDF لـ ${number} غير متصل.`,
  },
};

const PAGE_SIZE = 10;

@Component({
  selector: 'app-billing',
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: InvoiceStatus[] = ['draft', 'open', 'paid', 'partial', 'overdue', 'void'];

  private readonly invoices = signal<Invoice[]>(SEED);

  readonly search = signal('');
  readonly statusFilter = signal<InvoiceStatus | 'all'>('all');
  readonly sortKey = signal<SortKey>('issue');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);

  readonly viewing = signal<Invoice | null>(null);
  readonly kebabFor = signal<string | null>(null);

  readonly recording = signal<Invoice | null>(null);
  readonly recordMode = signal<'full' | 'partial'>('full');
  readonly recordAmount = signal('');
  readonly recordBankRef = signal('');

  readonly voiding = signal<Invoice | null>(null);
  readonly voidReason = signal('');
  readonly voidError = signal('');

  readonly crediting = signal<Invoice | null>(null);
  readonly creditAmount = signal('');
  readonly creditReason = signal('');
  readonly creditError = signal('');

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly kpis = computed(() => {
    const list = this.invoices();
    const sum = (f: (i: Invoice) => boolean) =>
      list.filter(f).reduce((s, i) => s + this.total(i), 0);
    return {
      billed: sum(() => true),
      collected: list.reduce((s, i) => s + i.paidAmount, 0),
      outstanding: sum((i) => i.status === 'open' || i.status === 'partial' || i.status === 'overdue'),
      overdue: sum((i) => i.status === 'overdue'),
      failed: list.filter((i) => i.status === 'void').length,
    };
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.invoices().filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (!q) return true;
      return (
        i.number.toLowerCase().includes(q) ||
        i.companyEn.toLowerCase().includes(q) ||
        i.companyAr.includes(q) ||
        i.companyId.toLowerCase().includes(q)
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
        case 'number':
          av = a.number;
          bv = b.number;
          break;
        case 'company':
          av = lang === 'ar' ? a.companyAr : a.companyEn;
          bv = lang === 'ar' ? b.companyAr : b.companyEn;
          break;
        case 'issue':
          av = a.issueDate;
          bv = b.issueDate;
          break;
        case 'due':
          av = a.dueDate;
          bv = b.dueDate;
          break;
        case 'total':
          av = this.total(a);
          bv = this.total(b);
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

  tax(i: Invoice): number {
    return withTotal(i.subtotal, i.taxProfile).tax;
  }

  total(i: Invoice): number {
    return withTotal(i.subtotal, i.taxProfile).total;
  }

  statusLabel(s: InvoiceStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: InvoiceStatus): { bg: string; fg: string } {
    return STATUS_COLOR[s];
  }

  companyName(i: Invoice): string {
    return this.lang() === 'ar' ? i.companyAr : i.companyEn;
  }

  formatMoney(v: number): string {
    return this.lang() === 'ar' ? `${v.toLocaleString('en-US')} ج.م` : `EGP ${v.toLocaleString('en-US')}`;
  }

  private readonly logoPalette = ['#3D4FD6', '#7E89E6', '#16182A', '#9A6B1E', '#2F7A4F', '#B4442F'];

  logoBg(i: Invoice): string {
    const code = i.companyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return this.logoPalette[code % this.logoPalette.length];
  }

  logoInitials(i: Invoice): string {
    return i.companyEn
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

  setStatusFilter(v: InvoiceStatus | 'all'): void {
    this.statusFilter.set(v);
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

  openView(i: Invoice): void {
    this.viewing.set(i);
    this.kebabFor.set(null);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleKebab(number: string): void {
    this.kebabFor.set(this.kebabFor() === number ? null : number);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  openRecord(i: Invoice): void {
    this.recording.set(i);
    this.recordMode.set('full');
    this.recordAmount.set(String(this.total(i) - i.paidAmount));
    this.recordBankRef.set('');
    this.kebabFor.set(null);
  }

  closeRecord(): void {
    this.recording.set(null);
  }

  setRecordMode(mode: 'full' | 'partial'): void {
    this.recordMode.set(mode);
    const i = this.recording();
    if (!i) return;
    if (mode === 'full') this.recordAmount.set(String(this.total(i) - i.paidAmount));
  }

  submitRecord(): void {
    const target = this.recording();
    if (!target) return;
    const amount = Number(this.recordAmount()) || 0;
    this.invoices.update((list) =>
      list.map((i) => {
        if (i.number !== target.number) return i;
        const paidAmount = i.paidAmount + amount;
        const status: InvoiceStatus = paidAmount >= this.total(i) ? 'paid' : 'partial';
        return { ...i, paidAmount, status };
      }),
    );
    this.closeRecord();
    this.showToast(this.L().toastRecorded(target.number));
  }

  openVoid(i: Invoice): void {
    this.voiding.set(i);
    this.voidReason.set('');
    this.voidError.set('');
    this.kebabFor.set(null);
  }

  closeVoidDialog(): void {
    this.voiding.set(null);
  }

  submitVoid(): void {
    const target = this.voiding();
    if (!target) return;
    if (this.voidReason().trim().length < 5) {
      this.voidError.set(this.L().reasonErr);
      return;
    }
    this.invoices.update((list) => list.map((i) => (i.number === target.number ? { ...i, status: 'void' } : i)));
    this.closeVoidDialog();
    this.showToast(this.L().toastVoided(target.number));
  }

  openCredit(i: Invoice): void {
    this.crediting.set(i);
    this.creditAmount.set(String(this.total(i)));
    this.creditReason.set('');
    this.creditError.set('');
    this.kebabFor.set(null);
  }

  closeCredit(): void {
    this.crediting.set(null);
  }

  submitCredit(): void {
    const target = this.crediting();
    if (!target) return;
    if (this.creditReason().trim().length < 5) {
      this.creditError.set(this.L().reasonErr);
      return;
    }
    this.closeCredit();
    this.showToast(this.L().toastCredited(target.number));
  }

  sendInvoice(i: Invoice): void {
    this.kebabFor.set(null);
    this.showToast(this.L().toastSent(i.number));
  }

  downloadPdf(i: Invoice): void {
    this.kebabFor.set(null);
    this.showToast(this.L().toastPdf(i.number));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
