import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { BillingApi, toMinor } from '../../../billing-api.service';
import { CompaniesApi } from '../../../companies-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'partial' | 'overdue' | 'void';
type TaxProfile = 'standard' | 'reverse_charge';
type SortKey = 'number' | 'company' | 'issue' | 'due' | 'total' | 'status';

interface Invoice {
  creditNotes?: Array<{ number: string; amountMinor: string; reason: string; createdAt: string }>;
  version: number;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  paidMinor: string;
  creditedMinor: string;
  balanceMinor: string;
  taxBps: number;
  description: string;
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

const STATUS_LABEL: Record<Lang, Record<InvoiceStatus, string>> = {
  en: {
    draft: 'Draft',
    open: 'Open',
    paid: 'Paid / settled',
    partial: 'Partial',
    overdue: 'Overdue',
    void: 'Void',
  },
  ar: {
    draft: 'مسودة',
    open: 'مفتوحة',
    paid: 'مدفوعة / مسوّاة',
    partial: 'مدفوعة جزئيًا',
    overdue: 'متأخرة',
    void: 'ملغاة',
  },
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
  columns: {
    number: string;
    company: string;
    issue: string;
    due: string;
    total: string;
    status: string;
  };
  actions: {
    view: string;
    recordPayment: string;
    voidInvoice: string;
    creditNote: string;
    send: string;
    pdf: string;
  };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: {
    number: string;
    company: string;
    issue: string;
    due: string;
    subtotal: string;
    tax: string;
    reverseCharge: string;
    total: string;
    paid: string;
    status: string;
  };
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
    kpis: {
      billed: 'Billed',
      collected: 'Collected',
      outstanding: 'Outstanding',
      overdue: 'Overdue',
      failed: 'Void',
    },
    columns: {
      number: 'Invoice',
      company: 'Company',
      issue: 'Issue date',
      due: 'Due date',
      total: 'Total',
      status: 'Status',
    },
    actions: {
      view: 'View',
      recordPayment: 'Record manual payment',
      voidInvoice: 'Void invoice',
      creditNote: 'Issue credit note',
      send: 'Send to customer',
      pdf: 'Download PDF',
    },
    pager: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    prev: 'Previous',
    next: 'Next',
    emptyTitle: 'No invoices match your filters',
    emptySub: 'Try clearing the search or filters.',
    drawerClose: 'Close',
    drawerFields: {
      number: 'Invoice',
      company: 'Company',
      issue: 'Issue date',
      due: 'Due date',
      subtotal: 'Subtotal',
      tax: 'Tax (entered rate)',
      reverseCharge: 'No tax recorded',
      total: 'Total',
      paid: 'Paid so far',
      status: 'Status',
    },
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
    kpis: {
      billed: 'المفوتر',
      collected: 'المُحصَّل',
      outstanding: 'المستحق',
      overdue: 'المتأخر',
      failed: 'الملغاة',
    },
    columns: {
      number: 'الفاتورة',
      company: 'الشركة',
      issue: 'تاريخ الإصدار',
      due: 'تاريخ الاستحقاق',
      total: 'الإجمالي',
      status: 'الحالة',
    },
    actions: {
      view: 'عرض',
      recordPayment: 'تسجيل دفعة يدوية',
      voidInvoice: 'إلغاء الفاتورة',
      creditNote: 'إصدار إشعار دائن',
      send: 'إرسال للعميل',
      pdf: 'تنزيل PDF',
    },
    pager: (from, to, total) => `عرض ${from}–${to} من ${total}`,
    prev: 'السابق',
    next: 'التالي',
    emptyTitle: 'لا توجد فواتير مطابقة للفلاتر',
    emptySub: 'جرّب مسح البحث أو الفلاتر.',
    drawerClose: 'إغلاق',
    drawerFields: {
      number: 'الفاتورة',
      company: 'الشركة',
      issue: 'تاريخ الإصدار',
      due: 'تاريخ الاستحقاق',
      subtotal: 'المجموع الفرعي',
      tax: 'الضريبة (النسبة المسجلة)',
      reverseCharge: 'بدون ضريبة مسجلة',
      total: 'الإجمالي',
      paid: 'المدفوع حتى الآن',
      status: 'الحالة',
    },
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
  imports: [FormsModule],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing {
  private readonly auth = inject(AuthService);
  readonly NumberValue = Number;
  private readonly api = inject(BillingApi);
  private readonly companiesApi = inject(CompaniesApi);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly password = signal('');
  readonly creating = signal(false);
  readonly companies = signal<Array<{ id: string; nameEn: string }>>([]);
  draft = {
    companyId: '',
    description: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    subtotal: '',
    taxPercent: '0',
    subscriptionId: '',
  };
  private requestId = crypto.randomUUID();
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      const records = await this.api.list<Invoice>('invoices');
      this.invoices.set(
        records.map((i) => ({
          ...i,
          subtotal: Number(i.subtotalMinor) / 100,
          paidAmount: Number(i.paidMinor) / 100,
          taxProfile: i.taxBps === 0 ? 'reverse_charge' : 'standard',
        })),
      );
      this.companies.set(await this.companiesApi.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load invoices');
    } finally {
      this.loading.set(false);
    }
  }
  async openCreate() {
    try {
      const d = await this.auth.request('/admin/api/v1/platform-defaults');
      this.draft.issueDate = new Date().toISOString().slice(0, 10);
      this.draft.taxPercent = String(d.taxRate);
      this.draft.dueDate = new Date(Date.now() + d.paymentTerms * 86400000)
        .toISOString()
        .slice(0, 10);
    } catch {}
    this.requestId = crypto.randomUUID();
    this.creating.set(true);
    this.error.set('');
  }
  async createInvoice() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const tax = Number(this.draft.taxPercent);
      if (!/^\d+(\.\d{1,2})?$/.test(this.draft.taxPercent) || tax > 100)
        throw new Error('Enter a tax percentage from 0 to 100 with at most two decimals');
      await this.api.create({
        requestId: this.requestId,
        companyId: this.draft.companyId,
        description: this.draft.description,
        issueDate: this.draft.issueDate,
        dueDate: this.draft.dueDate,
        subtotalMinor: toMinor(this.draft.subtotal),
        taxBps: Math.round(tax * 100),
        ...(this.draft.subscriptionId ? { subscriptionId: this.draft.subscriptionId } : {}),
      });
      this.creating.set(false);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to create invoice');
    } finally {
      this.saving.set(false);
    }
  }
  async issue(i: Invoice) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.invoice(i.number, 'issue', {
        version: i.version,
        requestId: crypto.randomUUID(),
      });
      this.viewing.set(null);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to issue invoice');
    } finally {
      this.saving.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: InvoiceStatus[] = ['draft', 'open', 'paid', 'partial', 'overdue', 'void'];

  private readonly invoices = signal<Invoice[]>([]);

  readonly search = signal('');
  readonly statusFilter = signal<InvoiceStatus | 'all'>('all');
  readonly sortKey = signal<SortKey>('issue');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);

  readonly viewing = signal<Invoice | null>(null);
  readonly kebabFor = signal<string | null>(null);

  readonly recording = signal<Invoice | null>(null);
  readonly recordMethod = signal('bank');
  readonly recordPaidAt = signal('');
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
    const sum = (fn: (i: Invoice) => number) => list.reduce((n, i) => n + fn(i), 0);
    return {
      billed: sum((i) =>
        ['draft', 'void'].includes(i.status) ? 0 : this.total(i) - Number(i.creditedMinor) / 100,
      ),
      collected: sum((i) => i.paidAmount),
      outstanding: sum((i) =>
        ['draft', 'void'].includes(i.status) ? 0 : Number(i.balanceMinor) / 100,
      ),
      overdue: sum((i) =>
        ['draft', 'void'].includes(i.status) || i.dueDate >= new Date().toISOString().slice(0, 10)
          ? 0
          : Number(i.balanceMinor) / 100,
      ),
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
    return Number(i.taxMinor) / 100;
  }

  total(i: Invoice): number {
    return Number(i.totalMinor) / 100;
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
    return this.lang() === 'ar'
      ? `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`
      : `EGP ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  async openView(i: Invoice) {
    this.kebabFor.set(null);
    try {
      const detail = await this.api.details('invoices', i.number);
      this.viewing.set({
        ...detail,
        subtotal: Number(detail.subtotalMinor) / 100,
        paidAmount: Number(detail.paidMinor) / 100,
        taxProfile: detail.taxBps === 0 ? 'reverse_charge' : 'standard',
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load invoice');
    }
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

  canRecord(i: Invoice) {
    return !['draft', 'void'].includes(i.status) && BigInt(i.balanceMinor) > 0n;
  }
  canCredit(i: Invoice) {
    return this.canRecord(i);
  }
  canVoid(i: Invoice) {
    return i.status !== 'void' && i.paidMinor === '0' && i.creditedMinor === '0';
  }
  openRecord(i: Invoice): void {
    this.requestId = crypto.randomUUID();
    this.error.set('');
    this.recording.set(i);
    this.recordMethod.set('bank');
    this.recordPaidAt.set(
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    );
    this.recordMode.set('full');
    this.recordAmount.set(String(Number(i.balanceMinor) / 100));
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
    if (mode === 'full') this.recordAmount.set(String(Number(i.balanceMinor) / 100));
  }

  async submitRecord() {
    const i = this.recording();
    if (!i || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.invoice(i.number, 'payments', {
        requestId: this.requestId,
        version: i.version,
        amountMinor: toMinor(this.recordAmount()),
        method: this.recordMethod(),
        reference: this.recordBankRef(),
        paidAt: new Date(this.recordPaidAt()).toISOString(),
      });
      this.closeRecord();
      this.viewing.set(null);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to record payment');
    } finally {
      this.saving.set(false);
    }
  }

  openVoid(i: Invoice): void {
    this.requestId = crypto.randomUUID();
    this.password.set('');
    this.voiding.set(i);
    this.voidReason.set('');
    this.voidError.set('');
    this.kebabFor.set(null);
  }

  closeVoidDialog(): void {
    this.password.set('');
    this.voiding.set(null);
  }

  async submitVoid() {
    const i = this.voiding();
    if (!i || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.invoice(i.number, 'void', {
        requestId: this.requestId,
        version: i.version,
        reason: this.voidReason(),
        password: this.password(),
      });
      this.password.set('');
      this.closeVoidDialog();
      this.viewing.set(null);
      await this.reload();
    } catch (error) {
      this.voidError.set(error instanceof Error ? error.message : 'Unable to void invoice');
    } finally {
      this.saving.set(false);
    }
  }

  openCredit(i: Invoice): void {
    this.requestId = crypto.randomUUID();
    this.password.set('');
    this.crediting.set(i);
    this.creditAmount.set(String(Number(i.balanceMinor) / 100));
    this.creditReason.set('');
    this.creditError.set('');
    this.kebabFor.set(null);
  }

  closeCredit(): void {
    this.password.set('');
    this.crediting.set(null);
  }

  async submitCredit() {
    const i = this.crediting();
    if (!i || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.invoice(i.number, 'credits', {
        requestId: this.requestId,
        version: i.version,
        amountMinor: toMinor(this.creditAmount()),
        reason: this.creditReason(),
        password: this.password(),
      });
      this.password.set('');
      this.closeCredit();
      this.viewing.set(null);
      await this.reload();
    } catch (error) {
      this.creditError.set(error instanceof Error ? error.message : 'Unable to issue credit');
    } finally {
      this.saving.set(false);
    }
  }
  sendInvoice(i: Invoice) {
    this.error.set('Email delivery is not configured.');
  }
  downloadPdf(i: Invoice) {
    this.error.set('PDF export is not configured.');
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
