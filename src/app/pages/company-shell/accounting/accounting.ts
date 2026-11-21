import { Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { CompactAmountDirective } from '../../../compact-amount.directive';
import { compactMoney, compactAmountInput, parseCompactAmount } from '../../../compact-numbers';
import { CompanyUiState } from '../company-ui-state';
type Field = {
  key: string;
  en: string;
  ar: string;
  type?: 'text' | 'amount' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};
type Column = {
  key: string;
  en: string;
  ar: string;
  type?: 'money' | 'status' | 'date' | 'percent' | 'boolean';
};
@Component({
  selector: 'app-accounting',
  imports: [FormsModule, RouterLink, CompactAmountDirective],
  templateUrl: './accounting.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../hr/hr.scss',
    '../attendance/attendance.scss',
    './accounting.scss',
  ],
})
export class Accounting {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly route = inject(ActivatedRoute);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly config = inject(RUNTIME_CONFIG);
  readonly mode = this.route.snapshot.data['accountingView'] as string;
  readonly base = '/api/v1/accounting/';
  readonly context = signal<any>(null);
  readonly options = signal<any>({
    accounts: [],
    parties: [],
    dimensions: [],
    treasuries: [],
    employees: [],
    users: [],
  });
  readonly data = signal<any>({ items: [], summary: {}, total: 0 });
  readonly invoices = signal<any[]>([]);
  readonly agreements = signal<any[]>([]);
  readonly advances = signal<any>({ items: [], payments: [] });
  readonly files = signal<any[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly formError = signal('');
  readonly dialog = signal('');
  readonly selected = signal<any>(null);
  readonly page = signal(1);
  readonly tab = signal('');
  readonly bankLines = signal<any>(null);
  readonly selectedLines = signal<string[]>([]);
  readonly isSelf = this.mode === 'self';
  form: any = {};
  lines: any[] = [];
  tiers: any[] = [];
  action = '';
  search = '';
  status = '';
  from = '';
  to = '';
  reportKind = 'trial_balance';
  accountId = '';
  partyId = '';
  branchId = '';
  costCentreId = '';
  projectId = '';
  teamId = '';
  selfTeam = false;
  private serial = 0;
  private previousFocus: HTMLElement | null = null;
  readonly tabs = computed(() =>
    this.mode === 'obligations'
      ? ['obligations', 'installment-plans']
      : this.mode === 'settings'
        ? ['settings', 'accounts', 'dimensions', 'parties', 'periods', 'collection-targets']
        : this.mode === 'treasury'
          ? ['treasuries', 'transactions', 'cheques', 'reconciliations']
          : this.mode === 'commissions'
            ? ['deals', 'agreements', 'commission-policies', 'automation-rules', 'staff-statements']
            : this.mode === 'expenses'
              ? ['expenses', 'custodies', 'hr-advances']
              : this.mode === 'payroll'
                ? ['payroll-runs', 'salary-profiles']
                : [],
  );
  readonly title = computed(() => this.label(this.mode));
  readonly money = compactMoney;
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  readonly names: Record<string, [string, string]> = {
    payroll: ['Payroll', 'الرواتب'],
    'payroll-runs': ['Payroll runs', 'مسيرات الرواتب'],
    'salary-profiles': ['Salary profiles', 'إعدادات رواتب الموظفين'],
    'commission-policies': ['Commission policies', 'سياسات عمولات الموظفين'],
    'automation-rules': ['CRM automation', 'أتمتة صفقات CRM'],
    'staff-statements': ['Employee statements', 'كشوف حساب الموظفين'],
    policy: ['Commission policy', 'سياسة عمولة'],
    automation: ['Automation rule', 'قاعدة أتمتة'],
    salary: ['Salary profile', 'إعداد راتب'],
    payrollrun: ['Payroll run', 'مسير رواتب'],
    submitted: ['Awaiting review', 'بانتظار المراجعة'],
    reversed: ['Reversed', 'معكوس'],
    salary_payable: ['Net salary payable', 'صافي راتب مستحق'],
    agent: ['Sales agent', 'مندوب مبيعات'],
    team_lead: ['Team lead', 'قائد فريق'],
    broker_agreement: ['Brokerage agreement', 'اتفاق وساطة'],
    sale: ['Sale', 'بيع'],
    reservation: ['Reservation', 'حجز'],
    lease: ['Lease', 'إيجار'],
    listing: ['Listing', 'عرض'],
    account: ['Account', 'حساب'],
    dimension: ['Branch / cost centre', 'فرع أو مركز تكلفة'],
    party: ['Party', 'طرف'],
    period: ['Period', 'فترة مالية'],
    transaction: ['Voucher', 'سند'],
    obligation: ['Financial document', 'مستند مالي'],
    journal: ['Journal', 'قيد'],
    agreement: ['Agreement', 'اتفاقية'],
    cheque: ['Cheque', 'شيك'],
    custody: ['Cash custody', 'عهدة نقدية'],
    reconcile: ['Bank reconciliation', 'مطابقة بنكية'],
    target: ['Collection target', 'مستهدف تحصيل'],
    'collection-targets': ['Collection targets', 'مستهدفات التحصيل'],
    collections: ['Collections & targets', 'التحصيلات والمستهدفات'],
    sales_performance: ['Sales performance', 'أداء المبيعات'],
    expenses_by_centre: ['Expenses by cost centre', 'المصروفات حسب مركز التكلفة'],
    tax: ['Tax account balances', 'أرصدة الحسابات الضريبية'],
    installment: ['Installment plan', 'خطة أقساط'],
    'installment-plans': ['Customer installment plans', 'خطط أقساط العملاء'],
    reverse_payout_link: ['Reverse payout accounting link', 'عكس ربط صرف السلفة'],
    reverse_repayment_link: ['Reverse repayment accounting link', 'عكس ربط السداد'],
    reverse_offset: ['Reverse commission advance offset', 'عكس تسوية السلفة من العمولة'],
    paid: ['Repaid in full', 'مسدد بالكامل'],
    overview: ['Finance overview', 'نظرة مالية عامة'],
    settings: ['Finance settings', 'إعدادات الحسابات'],
    accounts: ['Chart of accounts', 'دليل الحسابات'],
    dimensions: ['Branches & cost centres', 'الفروع ومراكز التكلفة'],
    parties: ['Customers, developers & suppliers', 'العملاء والمطورون والموردون'],
    periods: ['Financial periods', 'الفترات المالية'],
    journals: ['Journal entries', 'القيود اليومية'],
    treasury: ['Cash & banks', 'الخزينة والبنوك'],
    treasuries: ['Cashboxes & bank accounts', 'الخزائن والحسابات البنكية'],
    transactions: ['Receipts, payments & transfers', 'القبض والصرف والتحويلات'],
    obligations: ['Receivables & payables', 'المستحقات والالتزامات'],
    commissions: ['Commission accounting', 'محاسبة العمولات'],
    deals: ['CRM deals', 'صفقات CRM'],
    agreements: ['Developer agreements', 'اتفاقيات المطورين'],
    expenses: ['Expenses', 'المصروفات'],
    custodies: ['Employee cash custody', 'العهد النقدية'],
    'hr-advances': ['Salary advance accounting', 'محاسبة سلف الموظفين'],
    reports: ['Financial reports', 'التقارير المالية'],
    self: ['My financial statement', 'كشف حسابي'],
    available: ['Available', 'متاح'],
    draft: ['Draft', 'مسودة'],
    pending: ['Pending approval', 'بانتظار الموافقة'],
    approved: ['Approved', 'معتمد'],
    posted: ['Posted', 'مرحّل'],
    rejected: ['Rejected', 'مرفوض'],
    cancelled: ['Cancelled', 'ملغي'],
    active: ['Active', 'نشط'],
    closed: ['Settled', 'مسوّى'],
    needs_review: ['Needs review', 'تحتاج مراجعة'],
    needs_adjustment: ['Needs adjustment', 'تحتاج تسوية'],
    booked: ['Booked', 'مسجلة محاسبيًا'],
    held: ['Held', 'بحوزة الشركة'],
    deposited: ['Under collection', 'تحت التحصيل'],
    cleared: ['Cleared', 'تم التحصيل أو الصرف'],
    bounced: ['Bounced', 'مرتد'],
    deferred: ['Deferred', 'مؤجل'],
    completed: ['Completed', 'مكتمل'],
    asset: ['Asset', 'أصل'],
    liability: ['Liability', 'التزام'],
    equity: ['Equity', 'حقوق ملكية'],
    revenue: ['Revenue', 'إيراد'],
    expense: ['Expense', 'مصروف'],
    branch: ['Branch', 'فرع'],
    cost_centre: ['Cost centre', 'مركز تكلفة'],
    project: ['Project', 'مشروع'],
    team: ['Sales team', 'فريق مبيعات'],
    customer: ['Customer', 'عميل'],
    developer: ['Developer', 'مطور'],
    supplier: ['Supplier', 'مورد'],
    employee: ['Employee', 'موظف'],
    cash: ['Cashbox', 'خزينة'],
    bank: ['Bank', 'بنك'],
    receipt: ['Receipt', 'سند قبض'],
    payment: ['Payment', 'سند صرف'],
    transfer: ['Transfer', 'تحويل'],
    cash_flow: ['Cash flow', 'التدفقات النقدية'],
    operating: ['Operating', 'تشغيلية'],
    investing: ['Investing', 'استثمارية'],
    financing: ['Financing', 'تمويلية'],
    opening: ['Opening balance', 'رصيد افتتاحي'],
    developer_claim: ['Developer commission claim', 'مطالبة عمولة مطور'],
    supplier_bill: ['Supplier bill', 'فاتورة مورد'],
    commission_payable: ['Employee commission', 'عمولة موظف'],
    customer_funds: ['Developer client installment', 'قسط عميل للمطور'],
    credit_note: ['Credit note', 'إشعار دائن'],
    employee_recovery: ['Commission recovery', 'تسوية عمولة موظف'],
    company: ['Company collects', 'الشركة تحصّل'],
    percent: ['Percentage', 'نسبة'],
    fixed: ['Fixed amount', 'مبلغ ثابت'],
    tiers: ['Property value bands', 'شرائح قيمة العقار'],
    incoming: ['Incoming', 'وارد'],
    outgoing: ['Outgoing', 'صادر'],
    bank_transfer: ['Bank transfer', 'تحويل بنكي'],
    card: ['Card', 'بطاقة'],
    trial_balance: ['Trial balance', 'ميزان المراجعة'],
    general_ledger: ['General ledger', 'دفتر الأستاذ'],
    account_statement: ['Account statement', 'كشف حساب'],
    party_statement: ['Party statement', 'كشف حساب طرف'],
    profit_loss: ['Profit & loss', 'الأرباح والخسائر'],
    balance_sheet: ['Balance sheet', 'الميزانية العمومية'],
    aging: ['Aging report', 'أعمار الديون'],
    post: ['Post', 'ترحيل'],
    reverse: ['Reverse entry', 'قيد عكسي'],
    submit: ['Submit for approval', 'إرسال للموافقة'],
    approve: ['Approve', 'اعتماد'],
    reject: ['Reject', 'رفض'],
    cancel: ['Cancel', 'إلغاء'],
    close: ['Close period', 'إقفال الفترة'],
    reopen: ['Reopen period', 'إعادة فتح الفترة'],
    book: ['Book earned commission', 'تسجيل العمولة المستحقة'],
    adjust: ['Adjust changed/cancelled deal', 'تسوية الصفقة المعدلة أو الملغاة'],
    deposit: ['Deposit cheque', 'إيداع الشيك'],
    clear: ['Record cheque clearance', 'تسجيل تحصيل أو صرف الشيك'],
    bounce: ['Record bounced cheque', 'تسجيل ارتداد الشيك'],
    defer: ['Defer cheque', 'تأجيل الشيك'],
    payout: ['Record custody payout', 'تسجيل صرف العهدة'],
    return: ['Return unused cash', 'رد النقدية المتبقية'],
    reverse_settlement: ['Reverse custody settlement', 'عكس تسوية العهدة'],
    book_payout: ['Link recorded advance payout', 'ربط صرف السلفة المسجل'],
    book_repayment: ['Link recorded advance repayment', 'ربط سداد السلفة المسجل'],
    external_collection: ['Record developer collection', 'تسجيل تحصيل المطور'],
    offset_advance: ['Offset an employee advance', 'تسوية سلفة من العمولة'],
  };
  label(v: string) {
    const x = this.names[v];
    return x ? this.t(x[0], x[1]) : v;
  }
  constructor() {
    this.tab.set(this.tabs()[0] ?? this.mode);
    void this.load();
  }
  current() {
    return this.tab() || this.mode;
  }
  async choose(tab: string) {
    this.tab.set(tab);
    this.status = '';
    this.search = '';
    this.page.set(1);
    await this.load();
  }
  private query() {
    return new URLSearchParams({
      page: String(this.page()),
      limit: '25',
      ...(this.search ? { q: this.search } : {}),
      ...(this.status ? { status: this.status } : {}),
      ...(this.from ? { from: this.from } : {}),
      ...(this.to ? { to: this.to } : {}),
      ...(this.accountId ? { accountId: this.accountId } : {}),
      ...(this.partyId ? { partyId: this.partyId } : {}),
      ...(this.branchId ? { branchId: this.branchId } : {}),
      ...(this.costCentreId ? { costCentreId: this.costCentreId } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
      ...(this.teamId ? { teamId: this.teamId } : {}),
    });
  }
  async load(reset = false) {
    const n = ++this.serial;
    if (reset) this.page.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.isSelf) {
        const data = await this.auth.request(
          this.base +
            'self?' +
            new URLSearchParams({
              page: String(this.page()),
              limit: '25',
              ...(this.selfTeam ? { kind: 'team' } : {}),
              ...(this.from ? { from: this.from } : {}),
              ...(this.to ? { to: this.to } : {}),
            }),
        );
        if (n === this.serial) {
          this.data.set(data);
          this.from ||= data.staff?.from ?? '';
          this.to ||= data.staff?.to ?? '';
        }
        return;
      }
      const [ctx, options] = await Promise.all([
        this.auth.request(this.base + (this.mode === 'payroll' ? 'payroll-context' : 'context')),
        this.auth.request(this.base + (this.mode === 'payroll' ? 'payroll-options' : 'options')),
      ]);
      if (n !== this.serial) return;
      this.context.set(ctx);
      this.options.set({
        accounts: [],
        parties: [],
        dimensions: [],
        treasuries: [],
        users: [],
        teams: [],
        crmProjects: [],
        employees: [],
        ...options,
      });
      this.to ||= ctx.today;
      if (!this.from) {
        const m = options.settings?.fiscal_month ?? 1,
          y = Number(ctx.today.slice(0, 4)) - (Number(ctx.today.slice(5, 7)) < m ? 1 : 0);
        this.from = `${y}-${String(m).padStart(2, '0')}-01`;
      }
      if (!ctx.configured) {
        this.data.set({ items: [], summary: {}, total: 0 });
        return;
      }
      const tab = this.current(),
        q = this.query();
      let result: any;
      if (['settings', 'accounts', 'dimensions', 'parties'].includes(tab))
        result = { items: options[tab] ?? [], total: options[tab]?.length ?? 0 };
      else if (this.mode === 'overview')
        result = await this.auth.request(this.base + 'overview?' + q);
      else if (this.mode === 'reports') {
        q.set('kind', this.reportKind);
        result = await this.auth.request(this.base + 'reports?' + q);
      } else if (tab === 'expenses') {
        q.set('kind', 'expense');
        result = await this.auth.request(this.base + 'obligations?' + q);
      } else
        result = await this.auth.request(
          this.base +
            tab +
            (tab === 'agreements' ||
            tab === 'treasuries' ||
            tab === 'reconciliations' ||
            tab === 'hr-advances' ||
            tab === 'collection-targets'
              ? ''
              : '?' + q),
        );
      if (n !== this.serial) return;
      if (['accounts', 'dimensions', 'parties'].includes(tab)) {
        const all = (result.items ?? []).filter(
          (r: any) =>
            !this.search ||
            [r.name, r.code, r.email, r.kind].some((v) =>
              String(v ?? '')
                .toLowerCase()
                .includes(this.search.toLowerCase()),
            ),
        );
        result = { items: all.slice((this.page() - 1) * 25, this.page() * 25), total: all.length };
      }
      this.data.set(result);
      if (['transactions', 'cheques', 'obligations', 'expenses', 'custodies'].includes(tab)) {
        const opts = await this.auth.request(this.base + 'obligations?status=posted&limit=100');
        if (n === this.serial) this.invoices.set(opts.items);
      }
      if (tab === 'deals' || tab === 'automation-rules') {
        const a = await this.auth.request(this.base + 'agreements');
        if (n === this.serial) this.agreements.set(a.items);
      }
      if (tab === 'hr-advances') this.advances.set(result);
    } catch (e) {
      if (n === this.serial) {
        this.error.set((e as Error).message);
        this.data.set({ items: [], summary: {}, total: 0 });
        this.options.set({
          accounts: [],
          parties: [],
          dimensions: [],
          treasuries: [],
          employees: [],
          users: [],
        });
        this.context.set(null);
      }
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  async paginate(delta: number) {
    this.page.update((n) => n + delta);
    await this.load();
  }
  dims(kind: string) {
    return this.options().dimensions.filter((d: any) => d.kind === kind && d.active);
  }
  opts(rows: any[], name = 'name') {
    return rows.map((r) => ({
      value: r.id,
      label:
        (typeof r[name] === 'object' ? r[name]?.[this.ui.lang()] || r[name]?.en : r[name]) ||
        r.code ||
        r.id,
    }));
  }
  choices(values: string[]) {
    return values.map((v) => ({ value: v, label: this.label(v) }));
  }
  field(
    key: string,
    en: string,
    ar: string,
    type: Field['type'] = 'text',
    required = false,
    options?: Field['options'],
  ): Field {
    return { key, en, ar, type, required, options };
  }
  fields(): Field[] {
    const f = this.field.bind(this),
      tab = this.dialog(),
      op = this.options(),
      party = (kinds: string[]) =>
        this.opts(op.parties.filter((p: any) => p.active && kinds.includes(p.kind))),
      account = (kinds?: string[]) =>
        this.opts(
          op.accounts.filter((a: any) => a.active && (!kinds || kinds.includes(a.kind))),
          'name',
        ),
      treasury = this.opts(op.treasuries.filter((t: any) => t.active)),
      date = f('date', 'Date', 'التاريخ', 'date', true),
      reason = f('reason', 'Reason / notes', 'السبب / ملاحظات', 'textarea', true),
      dims = [
        f('branchId', 'Branch', 'الفرع', 'select', false, this.opts(this.dims('branch'))),
        f(
          'costCentreId',
          'Cost centre',
          'مركز التكلفة',
          'select',
          false,
          this.opts(this.dims('cost_centre')),
        ),
        f('projectId', 'Project', 'المشروع', 'select', false, this.opts(this.dims('project'))),
        f('teamId', 'Sales team', 'فريق المبيعات', 'select', false, this.opts(this.dims('team'))),
      ];
    if (tab === 'policy')
      return [
        f('name', 'Policy name', 'اسم السياسة', 'text', true),
        f(
          'roleKey',
          'Commission role',
          'دور العمولة',
          'select',
          true,
          this.choices(['agent', 'team_lead']),
        ),
        f('userId', 'Employee override', 'سياسة لموظف', 'select', false, this.opts(op.users)),
        f('policyTeamId', 'Team override', 'سياسة لفريق', 'select', false, this.opts(op.teams)),
        f(
          'mode',
          'Calculation',
          'الحساب',
          'select',
          true,
          this.choices(['percent', 'fixed', 'tiers']),
        ),
        ...(this.form.mode === 'fixed'
          ? [f('fixedMinor', 'Fixed commission (EGP)', 'عمولة ثابتة', 'amount', true)]
          : this.form.mode === 'percent'
            ? [
                f(
                  'ratePercent',
                  'Share of brokerage commission %',
                  'نسبة من عمولة الوساطة',
                  'text',
                  true,
                ),
              ]
            : []),
        f('from', 'Effective from', 'تاريخ السريان', 'date', true),
        f('to', 'Effective until (optional)', 'نهاية السريان (اختياري)', 'date'),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'automation')
      return [
        f('name', 'Rule name', 'اسم القاعدة', 'text', true),
        f(
          'contractType',
          'Contract type',
          'نوع العقد',
          'select',
          true,
          this.choices(['sale', 'reservation', 'lease', 'listing', 'broker_agreement']),
        ),
        f(
          'crmProjectId',
          'CRM project (empty means all)',
          'مشروع CRM (فارغ لكل المشاريع)',
          'select',
          false,
          this.opts(op.crmProjects),
        ),
        f(
          'agreementId',
          'Developer agreement',
          'اتفاقية المطور',
          'select',
          true,
          this.opts(this.agreements()),
        ),
        f(
          'autoAdjust',
          'Automatically adjust changes and cancellations',
          'تسوية التغييرات والإلغاءات تلقائيًا',
          'checkbox',
        ),
        f(
          'createInstallments',
          'Create linked customer installments',
          'إنشاء أقساط مرتبطة للعميل',
          'checkbox',
        ),
        ...(this.form.createInstallments
          ? [
              f('installments', 'Installments', 'عدد الأقساط', 'number', true),
              f(
                'intervalMonths',
                'Months between installments',
                'عدد الأشهر بين الأقساط',
                'number',
                true,
              ),
              f(
                'firstDueDays',
                'Days after signing for first due',
                'أيام بعد التوقيع لأول استحقاق',
                'number',
                true,
              ),
              f(
                'collectionOwner',
                'Collection responsibility',
                'مسؤولية التحصيل',
                'select',
                true,
                this.choices(['company', 'developer']),
              ),
            ]
          : []),
        f(
          'active',
          'Enable automatic posting under my authority',
          'تفعيل الترحيل التلقائي بصلاحيتي',
          'checkbox',
        ),
      ];
    if (tab === 'salary')
      return [
        f('employeeId', 'Employee', 'الموظف', 'select', true, this.opts(op.employees)),
        f('baseMinor', 'Monthly base salary (EGP)', 'الراتب الأساسي الشهري', 'amount', true),
        f('allowanceMinor', 'Monthly allowances (EGP)', 'البدلات الشهرية', 'amount', true),
        f(
          'deductionMinor',
          'Approved recurring deduction (EGP)',
          'الخصم الشهري المعتمد',
          'amount',
          true,
        ),
        f('deductionNote', 'Deduction reason', 'سبب الخصم', 'textarea', false),
        f(
          'advanceCapPercent',
          'Maximum advance deduction % of net before advances',
          'الحد الأقصى لخصم السلف من الراتب بعد الخصومات',
          'text',
          true,
        ),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'payrollrun')
      return [f('month', 'Payroll month (YYYY-MM)', 'شهر الرواتب (YYYY-MM)', 'text', true), date];
    if (tab === 'target')
      return [
        f('name', 'Target name', 'اسم المستهدف', 'text', true),
        f('from', 'Period start', 'بداية الفترة', 'date', true),
        f('to', 'Period end', 'نهاية الفترة', 'date', true),
        f(
          'amountMinor',
          'Developer commission collection target (EGP)',
          'مستهدف تحصيل عمولات المطورين (جنيه)',
          'amount',
          true,
        ),
        f('branchId', 'Branch', 'الفرع', 'select', false, this.opts(this.dims('branch'))),
        f(
          'teamId',
          'Team dimension',
          'فريق المبيعات',
          'select',
          false,
          this.opts(this.dims('team')),
        ),
      ];
    if (tab === 'installment')
      return [
        f('customerId', 'Customer', 'العميل', 'select', true, party(['customer'])),
        f('developerId', 'Developer', 'المطور', 'select', true, party(['developer'])),
        date,
        f('firstDue', 'First installment due', 'أول استحقاق', 'date', true),
        f('totalMinor', 'Total installments (EGP)', 'إجمالي الأقساط (جنيه)', 'amount', true),
        {
          ...f('installments', 'Number of installments', 'عدد الأقساط', 'number', true),
          min: 1,
          max: 120,
        },
        {
          ...f(
            'intervalMonths',
            'Months between installments',
            'الأشهر بين الأقساط',
            'number',
            true,
          ),
          min: 1,
          max: 12,
        },
        f('collectionOwner', 'Who collects?', 'من يحصّل؟', 'select', true, [
          { value: 'company', label: this.label('company') },
          {
            value: 'developer',
            label: this.t('Developer collects directly', 'المطور يحصّل مباشرة'),
          },
        ]),
        f('description', 'Description', 'البيان', 'textarea', true),
      ];
    if (tab === 'setup')
      return [
        {
          ...f('year', 'First financial year', 'أول سنة مالية', 'number', true),
          min: 2000,
          max: 2199,
        },
        {
          ...f(
            'fiscalMonth',
            'Financial year start month',
            'شهر بداية السنة المالية',
            'number',
            true,
          ),
          min: 1,
          max: 12,
        },
      ];
    if (tab === 'settings')
      return [
        {
          ...f(
            'fiscalMonth',
            'Financial year start month',
            'شهر بداية السنة المالية',
            'number',
            true,
          ),
          min: 1,
          max: 12,
        },
        f('vatPercent', 'Default tax percentage', 'نسبة الضريبة الافتراضية', 'text', true),
      ];
    if (tab === 'account')
      return [
        f('code', 'Account code', 'رقم الحساب', 'text', true),
        f('name', 'Account name', 'اسم الحساب', 'text', true),
        f(
          'kind',
          'Type',
          'النوع',
          'select',
          true,
          this.choices(['asset', 'liability', 'equity', 'revenue', 'expense']),
        ),
        f(
          'cashFlow',
          'Cash flow classification',
          'تصنيف التدفقات',
          'select',
          true,
          this.choices(['operating', 'investing', 'financing']),
        ),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'dimension')
      return [
        f(
          'kind',
          'Type',
          'النوع',
          'select',
          true,
          this.choices(['branch', 'cost_centre', 'project', 'team']),
        ),
        f('name', 'Name', 'الاسم', 'text', true),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'party')
      return [
        f(
          'kind',
          'Party type',
          'نوع الطرف',
          'select',
          true,
          this.choices(['customer', 'developer', 'supplier', 'employee']),
        ),
        f('name', 'Name', 'الاسم', 'text', true),
        f('email', 'Email', 'البريد الإلكتروني'),
        f('phone', 'Phone', 'الهاتف'),
        f('taxNumber', 'Tax registration number', 'رقم التسجيل الضريبي'),
        ...(this.form.kind === 'employee'
          ? [
              f(
                'referenceId',
                'Linked employee account',
                'حساب الموظف المرتبط',
                'select',
                false,
                this.opts(op.users),
              ),
            ]
          : []),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'period')
      return [
        f('name', 'Period name', 'اسم الفترة', 'text', true),
        f('from', 'Start date', 'من تاريخ', 'date', true),
        f('to', 'End date', 'إلى تاريخ', 'date', true),
      ];
    if (tab === 'treasury')
      return [
        f('name', 'Treasury name', 'اسم الخزينة أو الحساب', 'text', true),
        f('kind', 'Type', 'النوع', 'select', true, this.choices(['cash', 'bank'])),
        f('bankReference', 'Bank account reference', 'مرجع الحساب البنكي'),
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'journal')
      return [
        date,
        f('memo', 'Description', 'البيان', 'textarea', true),
        f(
          'cashFlow',
          'Cash flow classification',
          'تصنيف التدفقات',
          'select',
          true,
          this.choices(['operating', 'investing', 'financing', 'opening']),
        ),
        ...dims,
      ];
    if (tab === 'transaction')
      return [
        f(
          'kind',
          'Transaction type',
          'نوع الحركة',
          'select',
          true,
          this.choices(['receipt', 'payment', 'transfer']),
        ),
        date,
        f(
          'cashFlow',
          'Cash flow classification',
          'تصنيف التدفقات',
          'select',
          true,
          this.choices(['operating', 'investing', 'financing']),
        ),
        f(
          'treasuryId',
          this.form.kind === 'receipt' ? 'Receiving treasury' : 'Paying treasury',
          this.form.kind === 'receipt' ? 'الخزينة المستلمة' : 'الخزينة الصارفة',
          'select',
          true,
          treasury,
        ),
        ...(this.form.kind === 'transfer'
          ? [
              f(
                'toTreasuryId',
                'Destination treasury',
                'الخزينة المستلمة',
                'select',
                true,
                treasury,
              ),
            ]
          : [
              f(
                'obligationId',
                'Related invoice / obligation',
                'الفاتورة أو المستحق المرتبط',
                'select',
                false,
                this.opts(this.invoices(), 'code'),
              ),
              f(
                'partyId',
                'Party',
                'الطرف',
                'select',
                false,
                this.opts(op.parties.filter((p: any) => p.active)),
              ),
              ...(!this.form.obligationId
                ? [
                    f(
                      'counterAccountId',
                      'Counter account',
                      'الحساب المقابل',
                      'select',
                      true,
                      account(),
                    ),
                  ]
                : []),
              f(
                'method',
                'Payment method',
                'وسيلة السداد',
                'select',
                true,
                this.choices(['cash', 'bank_transfer', 'card']),
              ),
            ]),
        f('amountMinor', 'Amount (EGP)', 'المبلغ (جنيه)', 'amount', true),
        f('reference', 'Receipt / transfer reference', 'مرجع الإيصال أو التحويل'),
        f('memo', 'Description', 'البيان', 'textarea', true),
        ...dims,
      ];
    if (tab === 'obligation')
      return [
        f(
          'kind',
          'Document type',
          'نوع المستند',
          'select',
          true,
          this.choices([
            'developer_claim',
            'supplier_bill',
            'expense',
            'customer_funds',
            'credit_note',
          ]),
        ),
        f(
          'partyId',
          'Party',
          'الطرف',
          'select',
          true,
          party(
            this.form.kind === 'developer_claim'
              ? ['developer']
              : this.form.kind === 'credit_note'
                ? ['developer', 'customer']
                : this.form.kind === 'customer_funds'
                  ? ['customer']
                  : this.form.kind === 'expense'
                    ? ['employee', 'supplier']
                    : ['supplier'],
          ),
        ),
        ...(this.form.kind === 'customer_funds'
          ? [
              f('developerId', 'Developer', 'المطور', 'select', true, party(['developer'])),
              f(
                'collectionOwner',
                'Who collects the installment?',
                'من يحصّل القسط؟',
                'select',
                true,
                [
                  { value: 'company', label: this.label('company') },
                  {
                    value: 'developer',
                    label: this.t('Developer collects directly', 'المطور يحصّل مباشرة'),
                  },
                ],
              ),
            ]
          : []),
        ...(this.form.kind === 'credit_note'
          ? [
              f(
                'creditFor',
                'Original developer claim',
                'مطالبة المطور الأصلية',
                'select',
                true,
                this.opts(
                  this.invoices().filter(
                    (x) =>
                      ['developer_claim', 'customer_funds'].includes(x.kind) &&
                      x.collection_owner === 'company',
                  ),
                  'code',
                ),
              ),
            ]
          : []),
        date,
        f('dueDate', 'Due date', 'تاريخ الاستحقاق', 'date', true),
        f('netMinor', 'Net amount (EGP)', 'صافي المبلغ (جنيه)', 'amount', true),
        f('taxPercent', 'Tax percentage', 'نسبة الضريبة', 'text', true),
        ...(['expense', 'supplier_bill'].includes(this.form.kind)
          ? [
              f(
                'accountId',
                'Expense account',
                'حساب المصروف',
                'select',
                false,
                account(['expense']),
              ),
            ]
          : []),
        f('description', 'Description', 'البيان', 'textarea', true),
        ...dims,
      ];
    if (tab === 'agreement')
      return [
        f('name', 'Agreement name', 'اسم الاتفاقية', 'text', true),
        f('developerId', 'Developer', 'المطور', 'select', true, party(['developer'])),
        f(
          'mode',
          'Commission basis',
          'أساس العمولة',
          'select',
          true,
          this.choices(['percent', 'fixed', 'tiers']),
        ),
        ...(this.form.mode === 'percent'
          ? [
              f(
                'ratePercent',
                'Property value commission %',
                'نسبة العمولة من قيمة العقار',
                'text',
                true,
              ),
            ]
          : this.form.mode === 'fixed'
            ? [f('fixedMinor', 'Fixed commission (EGP)', 'العمولة الثابتة (جنيه)', 'amount', true)]
            : []),
        f('agentPercent', 'Agent share of commission %', 'حصة السيلز من العمولة %', 'text', true),
        f(
          'leadPercent',
          'Team lead share of commission %',
          'حصة قائد الفريق من العمولة %',
          'text',
          true,
        ),
        {
          ...f(
            'dueDays',
            'Days until commission is due',
            'عدد الأيام حتى استحقاق العمولة',
            'number',
            true,
          ),
          min: 0,
          max: 730,
        },
        f('active', 'Active', 'نشط', 'checkbox'),
      ];
    if (tab === 'book')
      return [
        date,
        f(
          'agreementId',
          'Approved developer agreement',
          'اتفاقية المطور المعتمدة',
          'select',
          true,
          this.opts(this.agreements().filter((a) => a.active)),
        ),
        f('agentId', 'Sales agent', 'السيلز', 'select', false, this.opts(op.users)),
        f('leadId', 'Team lead', 'قائد الفريق', 'select', false, this.opts(op.users)),
        ...dims,
      ];
    if (tab === 'cheque')
      return [
        f(
          'kind',
          'Cheque direction',
          'اتجاه الشيك',
          'select',
          true,
          this.choices(['incoming', 'outgoing']),
        ),
        f('number', 'Cheque number', 'رقم الشيك', 'text', true),
        f('bank', 'Issuing bank', 'البنك المصدر', 'text', true),
        f(
          'treasuryId',
          'Bank account',
          'الحساب البنكي',
          'select',
          true,
          this.opts(op.treasuries.filter((t: any) => t.active && t.kind === 'bank')),
        ),
        f(
          'partyId',
          'Party',
          'الطرف',
          'select',
          true,
          this.opts(op.parties.filter((p: any) => p.active)),
        ),
        f(
          'obligationId',
          'Related invoice / obligation',
          'الفاتورة أو المستحق المرتبط',
          'select',
          false,
          this.opts(this.invoices(), 'code'),
        ),
        ...(!this.form.obligationId
          ? [f('counterAccountId', 'Counter account', 'الحساب المقابل', 'select', true, account())]
          : []),
        f('amountMinor', 'Amount (EGP)', 'المبلغ (جنيه)', 'amount', true),
        f('dueDate', 'Due date', 'تاريخ الاستحقاق', 'date', true),
        f('notes', 'Notes', 'ملاحظات', 'textarea'),
      ];
    if (tab === 'custody')
      return [
        f('employeeId', 'Employee', 'الموظف', 'select', true, this.opts(op.employees)),
        f('amountMinor', 'Custody amount (EGP)', 'مبلغ العهدة (جنيه)', 'amount', true),
        f('purpose', 'Purpose', 'الغرض', 'textarea', true),
      ];
    if (tab === 'reconcile')
      return [
        f(
          'treasuryId',
          'Bank account',
          'الحساب البنكي',
          'select',
          true,
          this.opts(op.treasuries.filter((t: any) => t.kind === 'bank' && t.active)),
        ),
        date,
        f(
          'statementAmount',
          'Statement closing balance (EGP)',
          'رصيد كشف البنك الختامي (جنيه)',
          'text',
          true,
        ),
        f('notes', 'Notes', 'ملاحظات', 'textarea'),
      ];
    if (tab === 'action') {
      const a = this.action,
        fields: Field[] = [];
      if (
        [
          'reverse',
          'adjust',
          'payout',
          'expense',
          'return',
          'clear',
          'bounce',
          'external_collection',
          'offset_advance',
          'reverse_settlement',
          'reverse_payout_link',
          'reverse_repayment_link',
          'reverse_offset',
        ].includes(a)
      )
        fields.push(date);
      if (
        [
          'reverse',
          'adjust',
          'reject',
          'cancel',
          'close',
          'reopen',
          'expense',
          'return',
          'bounce',
          'clear',
          'deposit',
          'defer',
          'external_collection',
          'offset_advance',
          'reverse_settlement',
          'reverse_payout_link',
          'reverse_repayment_link',
          'reverse_offset',
        ].includes(a)
      )
        fields.push(reason);
      if (['payout', 'return', 'book_payout', 'book_repayment'].includes(a))
        fields.push(
          f('treasuryId', 'Actual treasury', 'الخزينة الفعلية', 'select', true, treasury),
        );
      if (['expense', 'return', 'external_collection', 'offset_advance'].includes(a))
        fields.push(f('amountMinor', 'Amount (EGP)', 'المبلغ (جنيه)', 'amount', true));
      if (a === 'expense')
        fields.push(
          f('accountId', 'Expense account', 'حساب المصروف', 'select', true, account(['expense'])),
          ...dims,
        );
      if (['payout', 'return', 'book_payout', 'book_repayment', 'external_collection'].includes(a))
        fields.push(
          f(
            'reference',
            'Receipt / transfer reference',
            'مرجع الإيصال أو التحويل',
            'text',
            a === 'external_collection',
          ),
        );
      if (a === 'defer')
        fields.push(f('dueDate', 'New due date', 'تاريخ الاستحقاق الجديد', 'date', true));
      if (a === 'cancel' && this.current() === 'installment-plans') fields.push(date);
      if (a === 'reverse_repayment_link')
        fields.push(
          f(
            'paymentId',
            'Repayment accounting link',
            'ربط دفعة السداد',
            'select',
            true,
            this.advances()
              .payments.filter((x: any) => x.advance_id === this.selected()?.id && x.booked)
              .map((x: any) => ({
                value: x.id,
                label: x.paid_date + ' · ' + this.money(x.amount_minor),
              })),
          ),
        );
      if (a === 'reverse_offset')
        fields.push(
          f(
            'settlementId',
            'Commission offset',
            'تسوية العمولة',
            'select',
            true,
            (this.selected()?.offsets ?? [])
              .filter((x: any) => !x.reversed)
              .map((x: any) => ({ value: x.id, label: this.money(x.amount_minor) })),
          ),
        );
      if (a === 'book_repayment')
        fields.push(
          f(
            'paymentId',
            'Recorded HR repayment',
            'دفعة السداد المسجلة في الموارد البشرية',
            'select',
            true,
            this.advances()
              .payments.filter(
                (x: any) => x.advance_id === this.selected()?.id && !x.reversed_reason && !x.booked,
              )
              .map((p: any) => ({
                value: p.id,
                label: p.paid_date + ' · ' + this.money(p.amount_minor),
              })),
          ),
        );
      if (a === 'reverse_settlement')
        fields.push(
          f(
            'settlementId',
            'Custody settlement',
            'تسوية العهدة',
            'select',
            true,
            (this.selected()?.settlements ?? [])
              .filter((s: any) => !s.reversed)
              .map((s: any) => ({
                value: s.id,
                label: this.label(s.kind) + ' · ' + this.money(s.amount_minor),
              })),
          ),
        );
      if (a === 'offset_advance')
        fields.push(
          f(
            'advanceId',
            'Employee advance',
            'سلفة الموظف',
            'select',
            true,
            this.advances()
              .items.filter(
                (x: any) =>
                  x.status === 'active' &&
                  x.payout_booked &&
                  x.user_id ===
                    this.options().parties.find((p: any) => p.id === this.selected()?.party_id)
                      ?.reference_id,
              )
              .map((x: any) => ({
                value: x.id,
                label: x.employee + ' · ' + this.money(x.balance_minor),
              })),
          ),
        );
      return fields;
    }
    return [];
  }
  columns(): Column[] {
    const tab = this.current(),
      c = (key: string, en: string, ar: string, type?: Column['type']) => ({ key, en, ar, type });
    if (this.mode === 'reports') {
      if (this.reportKind === 'collections')
        return [
          c('code', 'Voucher', 'السند'),
          c('entry_date', 'Date', 'التاريخ', 'date'),
          c('party', 'Party', 'الطرف'),
          c('sales_agent', 'Sales agent', 'السيلز'),
          c('method', 'Method', 'الوسيلة', 'status'),
          c('obligation_kind', 'Collection type', 'نوع التحصيل', 'status'),
          c('amount_minor', 'Net amount', 'صافي المبلغ', 'money'),
        ];
      if (this.reportKind === 'sales_performance')
        return [
          c('name', 'Sales agent', 'السيلز'),
          c('deals', 'Signed deals', 'الصفقات الموقعة'),
          c('property_value_minor', 'Property value', 'قيمة العقار', 'money'),
          c('gross_commission_minor', 'Brokerage commission', 'عمولة الوساطة', 'money'),
          c('agent_commission_minor', 'Agent commission', 'عمولة السيلز', 'money'),
        ];
      if (this.reportKind === 'expenses_by_centre')
        return [
          c('account', 'Expense account', 'حساب المصروف'),
          c('branch', 'Branch', 'الفرع'),
          c('cost_centre', 'Cost centre', 'مركز التكلفة'),
          c('amount_minor', 'Net expense', 'صافي المصروف', 'money'),
        ];
      if (this.reportKind === 'tax')
        return [
          c('code', 'Account', 'الحساب'),
          c('name', 'Name', 'الاسم'),
          c('debit_minor', 'Period debit', 'مدين الفترة', 'money'),
          c('credit_minor', 'Period credit', 'دائن الفترة', 'money'),
          c('balance_minor', 'Closing net', 'صافي الرصيد', 'money'),
        ];
      if (['general_ledger', 'account_statement', 'party_statement'].includes(this.reportKind))
        return [
          c('code', 'Journal', 'القيد'),
          c('entry_date', 'Date', 'التاريخ', 'date'),
          c('account', 'Account', 'الحساب'),
          c('party', 'Party', 'الطرف'),
          c('memo', 'Description', 'البيان'),
          c('debit_minor', 'Debit', 'مدين', 'money'),
          c('credit_minor', 'Credit', 'دائن', 'money'),
        ];
      if (this.reportKind === 'aging')
        return [
          c('code', 'Document', 'المستند'),
          c('party', 'Party', 'الطرف'),
          c('direction', 'Direction', 'الاتجاه'),
          c('due_date', 'Due date', 'الاستحقاق', 'date'),
          c('bucket', 'Aging bucket', 'شريحة التأخير'),
          c('remainingMinor', 'Outstanding', 'المستحق', 'money'),
        ];
      if (this.reportKind === 'cash_flow')
        return [
          c('cash_flow', 'Category', 'التصنيف', 'status'),
          c('amount_minor', 'Net cash movement', 'صافي حركة النقدية', 'money'),
        ];
      return [
        c('code', 'Account code', 'رقم الحساب'),
        c('name', 'Account', 'الحساب'),
        c('kind', 'Type', 'النوع', 'status'),
        ...(this.reportKind === 'trial_balance'
          ? [
              c('opening_minor', 'Opening net', 'صافي الافتتاحي', 'money'),
              c('debit_minor', 'Period debit', 'مدين الفترة', 'money'),
              c('credit_minor', 'Period credit', 'دائن الفترة', 'money'),
              c('closingDebitMinor', 'Closing debit', 'مدين ختامي', 'money'),
              c('closingCreditMinor', 'Closing credit', 'دائن ختامي', 'money'),
            ]
          : [c('amountMinor', 'Amount', 'المبلغ', 'money')]),
      ];
    }
    const map: Record<string, Column[]> = {
      'commission-policies': [
        c('name', 'Policy', 'السياسة'),
        c('role_key', 'Role', 'الدور', 'status'),
        c('employee', 'Employee override', 'موظف'),
        c('team', 'Team override', 'فريق'),
        c('mode', 'Calculation', 'الحساب', 'status'),
        c('rate_bps', 'Rate', 'النسبة', 'percent'),
        c('fixed_minor', 'Fixed amount', 'القيمة الثابتة', 'money'),
        c('effective_from', 'From', 'من', 'date'),
        c('active', 'Enabled', 'مفعلة', 'boolean'),
      ],
      'automation-rules': [
        c('name', 'Rule', 'القاعدة'),
        c('contract_type', 'Contract type', 'نوع العقد', 'status'),
        c('project', 'Project scope', 'نطاق المشروع'),
        c('agreement', 'Agreement', 'الاتفاقية'),
        c('authorized_by_name', 'Authorized by', 'المفوّض'),
        c('auto_adjust', 'Auto adjustments', 'تسوية تلقائية', 'boolean'),
        c('create_installments', 'Linked installments', 'أقساط مرتبطة', 'boolean'),
        c('active', 'Enabled', 'مفعلة', 'boolean'),
      ],
      'salary-profiles': [
        c('employee', 'Employee', 'الموظف'),
        c('base_minor', 'Base salary', 'الراتب الأساسي', 'money'),
        c('allowance_minor', 'Allowances', 'البدلات', 'money'),
        c('deduction_minor', 'Deductions', 'الخصومات', 'money'),
        c('advance_cap_bps', 'Advance cap', 'حد السلف', 'percent'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      'payroll-runs': [
        c('code', 'Payroll', 'المسير'),
        c('month', 'Month', 'الشهر', 'date'),
        c('gross_minor', 'Gross salary', 'الإجمالي', 'money'),
        c('deduction_minor', 'Deductions', 'الخصومات', 'money'),
        c('advance_minor', 'Advance deductions', 'خصم السلف', 'money'),
        c('net_minor', 'Net salary', 'الصافي', 'money'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      'staff-statements': this.staffColumns(),
      'collection-targets': [
        c('name', 'Target', 'المستهدف'),
        c('start_date', 'Start', 'البداية', 'date'),
        c('end_date', 'End', 'النهاية', 'date'),
        c('branch', 'Branch', 'الفرع'),
        c('team', 'Team', 'الفريق'),
        c('amount_minor', 'Target amount', 'المبلغ المستهدف', 'money'),
      ],
      'installment-plans': [
        c('code', 'Plan', 'الخطة'),
        c('customer', 'Customer', 'العميل'),
        c('developer', 'Developer', 'المطور'),
        c('total_minor', 'Total', 'الإجمالي', 'money'),
        c('installments', 'Installments', 'الأقساط'),
        c('first_due', 'First due', 'أول استحقاق', 'date'),
        c('collection_owner', 'Collection', 'التحصيل', 'status'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      accounts: [
        c('code', 'Code', 'الرقم'),
        c('name', 'Account', 'الحساب'),
        c('kind', 'Type', 'النوع', 'status'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      dimensions: [
        c('name', 'Name', 'الاسم'),
        c('kind', 'Type', 'النوع', 'status'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      parties: [
        c('name', 'Name', 'الاسم'),
        c('kind', 'Type', 'النوع', 'status'),
        c('email', 'Email', 'البريد'),
        c('tax_number', 'Tax number', 'الرقم الضريبي'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      periods: [
        c('name', 'Period', 'الفترة'),
        c('start_date', 'Start', 'البداية', 'date'),
        c('end_date', 'End', 'النهاية', 'date'),
        c('closed', 'Closed', 'مقفلة', 'boolean'),
      ],
      journals: [
        c('code', 'Journal', 'القيد'),
        c('entry_date', 'Date', 'التاريخ', 'date'),
        c('memo', 'Description', 'البيان'),
        c('total_minor', 'Value', 'القيمة', 'money'),
        c('status', 'Status', 'الحالة', 'status'),
        c('reversed', 'Reversed', 'معكوس', 'boolean'),
      ],
      treasuries: [
        c('name', 'Treasury', 'الخزينة'),
        c('kind', 'Type', 'النوع', 'status'),
        c('bank_reference', 'Reference', 'المرجع'),
        c('balanceMinor', 'Balance', 'الرصيد', 'money'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      transactions: [
        c('code', 'Voucher', 'السند'),
        c('entry_date', 'Date', 'التاريخ', 'date'),
        c('kind', 'Type', 'النوع', 'status'),
        c('treasury', 'Treasury', 'الخزينة'),
        c('party', 'Party', 'الطرف'),
        c('amount_minor', 'Amount', 'المبلغ', 'money'),
        c('reversed', 'Reversed', 'معكوس', 'boolean'),
      ],
      obligations: [
        c('code', 'Document', 'المستند'),
        c('kind', 'Type', 'النوع', 'status'),
        c('party', 'Party', 'الطرف'),
        c('total_minor', 'Total', 'الإجمالي', 'money'),
        c('paidMinor', 'Settled', 'المسوى', 'money'),
        c('remainingMinor', 'Outstanding', 'المستحق', 'money'),
        c('due_date', 'Due date', 'الاستحقاق', 'date'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      deals: [
        c('reference', 'Contract', 'العقد'),
        c('customer', 'Customer', 'العميل'),
        c('agent', 'Agent', 'السيلز'),
        c('property_value_minor', 'Property value', 'قيمة العقار', 'money'),
        c('state', 'Finance status', 'الحالة المحاسبية', 'status'),
        c('automation_error', 'Needs attention', 'تحتاج مراجعة'),
      ],
      agreements: [
        c('name', 'Agreement', 'الاتفاقية'),
        c('developer', 'Developer', 'المطور'),
        c('mode', 'Basis', 'الأساس', 'status'),
        c('rate_bps', 'Rate', 'النسبة', 'percent'),
        c('fixed_minor', 'Fixed amount', 'المبلغ الثابت', 'money'),
        c('agent_bps', 'Agent %', 'حصة السيلز', 'percent'),
        c('lead_bps', 'Team lead %', 'حصة القائد', 'percent'),
        c('active', 'Active', 'نشط', 'boolean'),
      ],
      cheques: [
        c('number', 'Cheque', 'الشيك'),
        c('bank', 'Bank', 'البنك'),
        c('kind', 'Direction', 'الاتجاه', 'status'),
        c('party', 'Party', 'الطرف'),
        c('amount_minor', 'Amount', 'المبلغ', 'money'),
        c('due_date', 'Due', 'الاستحقاق', 'date'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      reconciliations: [
        c('treasury', 'Bank account', 'الحساب'),
        c('statement_date', 'Statement date', 'تاريخ الكشف', 'date'),
        c('statement_minor', 'Statement balance', 'رصيد الكشف', 'money'),
        c('book_minor', 'Matched balance', 'الرصيد المطابق', 'money'),
        c('difference_minor', 'Difference', 'الفرق', 'money'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      custodies: [
        c('code', 'Custody', 'العهدة'),
        c('employee', 'Employee', 'الموظف'),
        c('purpose', 'Purpose', 'الغرض'),
        c('amount_minor', 'Issued amount', 'المبلغ', 'money'),
        c('spentMinor', 'Expenses', 'المصروف', 'money'),
        c('returnedMinor', 'Returned', 'المردود', 'money'),
        c('remainingMinor', 'Remaining', 'المتبقي', 'money'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
      'hr-advances': [
        c('employee', 'Employee', 'الموظف'),
        c('employee_code', 'Code', 'رقم الموظف'),
        c('amount_minor', 'HR principal', 'أصل السلفة', 'money'),
        c('paid_out_date', 'Actual payout', 'تاريخ الصرف', 'date'),
        c('status', 'Status', 'الحالة', 'status'),
        c('payout_booked', 'Linked to accounting', 'مرتبطة بالحسابات', 'boolean'),
      ],
      self: [
        c('code', 'Document', 'المستند'),
        c('employee', 'Employee', 'الموظف'),
        c('kind', 'Type', 'النوع', 'status'),
        c('total_minor', 'Earned / adjustment', 'المستحق أو التسوية', 'money'),
        c('paidMinor', 'Settled', 'المسوى', 'money'),
        c('remainingMinor', 'Remaining', 'المتبقي', 'money'),
        c('due_date', 'Due date', 'الاستحقاق', 'date'),
        c('status', 'Status', 'الحالة', 'status'),
      ],
    };
    return map[tab === 'expenses' ? 'obligations' : tab] ?? [];
  }
  value(row: any, c: Column) {
    const v = row[c.key];
    if (v === null || v === undefined || v === '') return this.t('Not set', 'غير محدد');
    if (c.type === 'money') return this.money(String(v));
    if (c.type === 'date') return String(v).slice(0, 10);
    if (c.type === 'percent') return Number(v) / 100 + '%';
    if (c.type === 'boolean') return v ? this.t('Yes', 'نعم') : this.t('No', 'لا');
    if (c.type === 'status') return this.label(v);
    if (typeof v === 'object') return v[this.ui.lang()] || v.en || v.ar || '—';
    return String(v);
  }
  newLabel() {
    return this.label(
      {
        accounts: 'account',
        dimensions: 'dimension',
        parties: 'party',
        periods: 'period',
        treasuries: 'treasury',
        transactions: 'transaction',
        obligations: 'obligation',
        expenses: 'obligation',
        journals: 'journal',
        agreements: 'agreement',
        cheques: 'cheque',
        custodies: 'custody',
        reconciliations: 'reconcile',
        'installment-plans': 'installment',
        'collection-targets': 'target',
        'commission-policies': 'policy',
        'automation-rules': 'automation',
        'salary-profiles': 'salary',
        'payroll-runs': 'payrollrun',
      }[this.current()] ?? '',
    );
  }
  canCreate() {
    if (
      !this.context()?.configured ||
      this.isSelf ||
      this.mode === 'reports' ||
      this.mode === 'overview' ||
      ['settings', 'deals', 'hr-advances', 'staff-statements'].includes(this.current())
    )
      return false;
    return [
      'accounts',
      'dimensions',
      'periods',
      'treasuries',
      'agreements',
      'collection-targets',
      'commission-policies',
      'automation-rules',
    ].includes(this.current())
      ? this.context()?.canSettings
      : this.current() === 'reconciliations'
        ? this.context()?.canApprove
        : this.current() === 'transactions'
          ? this.context()?.canPost
          : this.context()?.canWrite;
  }
  private open(kind: string) {
    this.previousFocus = document.activeElement as HTMLElement;
    this.formError.set('');
    this.dialog.set(kind);
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.dialog input,.dialog select,.dialog textarea,.dialog button')
        ?.focus(),
    );
  }
  edit(row?: any, kind?: string) {
    const map: Record<string, string> = {
      accounts: 'account',
      dimensions: 'dimension',
      parties: 'party',
      periods: 'period',
      treasuries: 'treasury',
      transactions: 'transaction',
      obligations: 'obligation',
      expenses: 'obligation',
      journals: 'journal',
      agreements: 'agreement',
      cheques: 'cheque',
      custodies: 'custody',
      reconciliations: 'reconcile',
      'installment-plans': 'installment',
      'collection-targets': 'target',
      'commission-policies': 'policy',
      'automation-rules': 'automation',
      'salary-profiles': 'salary',
      'payroll-runs': 'payrollrun',
    };
    const dialog = kind ?? map[this.current()] ?? this.current();
    this.selected.set(row ?? null);
    this.form = {
      date: this.context()?.today,
      from: this.context()?.today,
      to: this.context()?.today,
      dueDate: this.context()?.today,
      fiscalMonth: 1,
      year: Number(this.context()?.today?.slice(0, 4) ?? 2026),
      kind:
        dialog === 'obligation'
          ? this.current() === 'expenses'
            ? 'expense'
            : 'developer_claim'
          : dialog === 'account'
            ? 'asset'
            : dialog === 'dimension'
              ? 'branch'
              : dialog === 'party'
                ? 'developer'
                : dialog === 'transaction'
                  ? 'receipt'
                  : dialog === 'cheque'
                    ? 'incoming'
                    : 'cash',
      mode: 'percent',
      ratePercent: '2',
      agentPercent: '20',
      leadPercent: '5',
      dueDays: 30,
      taxPercent: String((this.options().settings?.vat_bps ?? 0) / 100),
      vatPercent: String((this.options().settings?.vat_bps ?? 0) / 100),
      cashFlow: 'operating',
      active: true,
      collectionOwner: 'company',
      firstDue: this.context()?.today,
      installments: 12,
      intervalMonths: 1,
      ...row,
    };
    if (row) {
      this.form = {
        ...this.form,
        bankReference: row.bank_reference ?? '',
        cashFlow: row.cash_flow ?? 'operating',
        taxNumber: row.tax_number ?? '',
        referenceId: row.reference_id ?? '',
        developerId: row.developer_id,
        ratePercent: String((row.rate_bps ?? 0) / 100),
        fixedMinor: row.fixed_minor ? compactAmountInput(row.fixed_minor) : '',
        agentPercent: String((row.agent_bps ?? 0) / 100),
        leadPercent: String((row.lead_bps ?? 0) / 100),
        dueDays: row.due_days ?? 30,
        fiscalMonth: row.fiscal_month ?? 1,
      };
    }
    if (dialog === 'target' && row) {
      this.form.from = String(row.start_date).slice(0, 10);
      this.form.to = String(row.end_date).slice(0, 10);
      this.form.amountMinor = compactAmountInput(row.amount_minor);
      this.form.branchId = row.branch_id ?? '';
      this.form.teamId = row.team_id ?? '';
    }
    if (dialog === 'policy')
      Object.assign(this.form, {
        roleKey: row?.role_key ?? 'agent',
        userId: row?.user_id ?? '',
        policyTeamId: row?.team_id ?? '',
        from: row?.effective_from ?? this.context()?.today,
        to: row?.effective_to ?? '',
      });
    if (dialog === 'automation')
      Object.assign(this.form, {
        contractType: row?.contract_type ?? 'sale',
        crmProjectId: row?.crm_project_id ?? '',
        agreementId: row?.agreement_id ?? '',
        autoAdjust: row?.auto_adjust ?? false,
        createInstallments: row?.create_installments ?? false,
        installments: row?.installments ?? 1,
        intervalMonths: row?.interval_months ?? 1,
        firstDueDays: row?.first_due_days ?? 30,
        collectionOwner: row?.collection_owner ?? 'developer',
        active: row?.active ?? false,
      });
    if (dialog === 'salary')
      Object.assign(this.form, {
        employeeId: row?.employee_id ?? '',
        baseMinor: compactAmountInput(row?.base_minor ?? '0'),
        allowanceMinor: compactAmountInput(row?.allowance_minor ?? '0'),
        deductionMinor: compactAmountInput(row?.deduction_minor ?? '0'),
        deductionNote: row?.deduction_note ?? '',
        advanceCapPercent: String((row?.advance_cap_bps ?? 10000) / 100),
        active: row?.active ?? true,
      });
    if (dialog === 'payrollrun')
      Object.assign(this.form, { month: this.context()?.today?.slice(0, 7), employeeIds: [] });
    this.lines = [
      { accountId: '', partyId: '', debit: '', credit: '' },
      { accountId: '', partyId: '', debit: '', credit: '' },
    ];
    this.tiers = (row?.tiers ?? [{ fromMinor: '0', rateBps: 100 }]).map((x: any) => ({
      from: compactAmountInput(x.fromMinor),
      rate: String(x.rateBps / 100),
    }));
    this.bankLines.set(null);
    this.selectedLines.set([]);
    this.open(dialog);
  }
  async detail(row: any) {
    this.error.set('');
    try {
      const tab = this.current(),
        entity = tab === 'expenses' ? 'obligations' : tab;
      let r = row;
      if (['journals', 'obligations', 'payroll-runs'].includes(entity))
        r = await this.auth.request(this.base + entity + '/' + row.id);
      if (!this.isSelf && !['staff-statements', 'payroll-runs', 'salary-profiles'].includes(entity))
        r = {
          ...r,
          historyData: (await this.auth.request(this.base + 'history/' + entity + '/' + row.id))
            .items,
        };
      this.selected.set(r);
      this.files.set([]);
      this.open('detail');
      if (
        !this.isSelf &&
        [
          'journals',
          'transactions',
          'obligations',
          'custodies',
          'cheques',
          'deals',
          'reconciliations',
        ].includes(entity)
      ) {
        const files = await this.auth.request(this.base + 'files/' + entity + '/' + row.id);
        if (this.selected()?.id === row.id) this.files.set(files.items);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  rowActions(r: any): string[] {
    const tab = this.current(),
      ctx = this.context();
    if (this.isSelf || this.mode === 'reports') return [];
    if (
      [
        'accounts',
        'dimensions',
        'parties',
        'treasuries',
        'agreements',
        'collection-targets',
        'commission-policies',
        'automation-rules',
        'salary-profiles',
      ].includes(tab)
    )
      return ctx?.canSettings || (tab === 'parties' && ctx?.canWrite) ? ['edit'] : [];
    if (tab === 'payroll-runs')
      return [
        ...(r.status === 'draft' && ctx?.canWrite ? ['submit', 'cancel'] : []),
        ...(r.status === 'submitted' && ctx?.canApprove ? ['approve', 'reject'] : []),
        ...(r.status === 'approved' && ctx?.canApprove ? ['post', 'cancel'] : []),
        ...(r.status === 'posted' && ctx?.canApprove ? ['reverse'] : []),
      ];
    if (tab === 'installment-plans')
      return ctx?.canApprove
        ? r.status === 'pending'
          ? ['approve', 'cancel']
          : r.status === 'posted'
            ? ['cancel']
            : []
        : [];
    if (tab === 'reconciliations')
      return ctx?.canApprove ? [r.status === 'completed' ? 'reopen' : 'reconcile'] : [];
    if (tab === 'periods') return ctx?.canSettings ? [r.closed ? 'reopen' : 'close'] : [];
    if (tab === 'journals')
      return r.source_kind === 'manual'
        ? r.status === 'draft'
          ? [...(ctx?.canWrite ? ['edit'] : []), ...(ctx?.canPost ? ['post'] : [])]
          : ctx?.canPost && !r.reversed
            ? ['reverse']
            : []
        : [];
    if (tab === 'transactions') return ctx?.canPost && !r.reversed ? ['reverse'] : [];
    if (tab === 'obligations' || tab === 'expenses')
      return [
        ...(r.has_offsets && ctx?.canApprove ? ['reverse_offset'] : []),
        ...(r.status === 'draft' && ctx?.canWrite ? ['submit'] : []),
        ...(r.status === 'pending' && ctx?.canApprove ? ['approve', 'reject'] : []),
        ...(r.status === 'approved' && ctx?.canPost ? ['post'] : []),
        ...(['draft', 'pending', 'approved'].includes(r.status) && ctx?.canWrite ? ['cancel'] : []),
        ...(r.status === 'posted' && ctx?.canPost
          ? [
              r.collection_owner === 'developer'
                ? 'external_collection'
                : ['developer_claim', 'customer_funds', 'employee_recovery'].includes(r.kind)
                  ? 'receive'
                  : 'pay',
              ...(r.journal_id && !r.deal_id && !r.plan_id && !r.payroll_run_id ? ['reverse'] : []),
            ]
          : []),
        ...(r.kind === 'commission_payable' && r.status === 'posted' && ctx?.canApprove
          ? ['offset_advance']
          : []),
      ];
    if (tab === 'deals')
      return ctx?.canApprove
        ? r.booked_version === null && r.contract_status === 'signed'
          ? ['book']
          : r.state === 'needs_adjustment'
            ? ['adjust']
            : []
        : [];
    if (tab === 'cheques')
      return r.status === 'cancelled'
        ? []
        : [
            ...(ctx?.canWrite && r.status !== 'cleared' ? ['deposit', 'defer', 'cancel'] : []),
            ...(ctx?.canPost ? [...(r.status !== 'cleared' ? ['clear'] : []), 'bounce'] : []),
          ];
    if (tab === 'custodies')
      return [
        ...(r.status === 'pending' && ctx?.canApprove ? ['approve', 'reject'] : []),
        ...(r.status === 'approved' && ctx?.canPost ? ['payout'] : []),
        ...(r.status === 'active' && ctx?.canPost ? ['expense', 'return'] : []),
        ...((r.settlements ?? []).some((x: any) => !x.reversed) && ctx?.canPost
          ? ['reverse_settlement']
          : []),
      ];
    if (tab === 'hr-advances')
      return ctx?.canPost
        ? [
            ...(!r.payout_booked
              ? ['book_payout']
              : ctx?.canApprove
                ? ['reverse_payout_link']
                : []),
            ...(ctx?.canApprove &&
            (this.data().payments ?? []).some((x: any) => x.advance_id === r.id && x.booked)
              ? ['reverse_repayment_link']
              : []),
            ...((this.data().payments ?? []).some(
              (x: any) => x.advance_id === r.id && !x.booked && !x.reversed_reason,
            ) && r.payout_booked
              ? ['book_repayment']
              : []),
          ]
        : [];
    return [];
  }
  actionLabel(a: string) {
    if (this.current() === 'reconciliations' && a === 'reopen')
      return this.t('Reopen bank statement', 'إعادة فتح مطابقة البنك');
    return a === 'edit'
      ? this.t('Edit', 'تعديل')
      : a === 'receive'
        ? this.t('Record receipt', 'تسجيل قبض')
        : a === 'pay'
          ? this.t('Record payment', 'تسجيل صرف')
          : this.label(a);
  }
  async act(a: string, row: any) {
    if (a === 'reconcile') {
      this.edit(undefined, 'reconcile');
      this.form.treasuryId = row.treasury_id;
      this.form.date = String(row.statement_date).slice(0, 10);
      this.form.statementAmount = compactAmountInput(row.statement_minor);
      return;
    }
    if (a === 'reverse_offset')
      row = { ...row, ...(await this.auth.request(this.base + 'obligations/' + row.id)) };
    if (a === 'edit') {
      if (this.current() === 'journals') {
        const d = await this.auth.request(this.base + 'journals/' + row.id);
        this.edit(d);
        this.form.date = d.entry_date;
        this.lines = d.lines.map((l: any) => ({
          accountId: l.account_id,
          partyId: l.party_id ?? '',
          debit: l.debit_minor === '0' ? '' : compactAmountInput(l.debit_minor),
          credit: l.credit_minor === '0' ? '' : compactAmountInput(l.credit_minor),
        }));
      } else this.edit(row);
      return;
    }
    if (a === 'receive' || a === 'pay') {
      this.edit(undefined, 'transaction');
      this.form = {
        ...this.form,
        kind: a === 'receive' ? 'receipt' : 'payment',
        obligationId: row.id,
        partyId: row.party_id,
        amountMinor: compactAmountInput(row.remainingMinor),
        memo: row.code + ' ' + (row.description ?? ''),
        method: 'bank_transfer',
      };
      if (!this.invoices().some((x) => x.id === row.id)) this.invoices.update((x) => [row, ...x]);
      return;
    }
    this.selected.set(row);
    if (a === 'book') {
      this.form = {
        date: this.context().today,
        agreementId: '',
        agentId: row.owner_id ?? '',
        leadId: '',
      };
      this.open('book');
      return;
    }
    this.action = a;
    this.form = {
      date: this.context().today,
      reason: '',
      reference: '',
      amountMinor: '',
      treasuryId: '',
      paymentId: '',
      accountId: '',
      dueDate: this.context().today,
      advanceId: '',
      settlementId: '',
    };
    if (a === 'offset_advance') {
      this.advances.set(await this.auth.request(this.base + 'hr-advances'));
    }
    this.open('action');
  }
  close() {
    if (this.saving()) return;
    this.dialog.set('');
    this.selected.set(null);
    this.files.set([]);
    this.previousFocus?.focus();
  }
  @HostListener('document:keydown.escape') escape() {
    this.close();
  }
  @HostListener('document:keydown', ['$event']) trap(e: KeyboardEvent) {
    if (!this.dialog() || e.key !== 'Tab') return;
    const nodes = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.dialog button:not([disabled]),.dialog input:not([disabled]),.dialog select:not([disabled]),.dialog textarea:not([disabled]),.dialog a[href]',
      ),
    ];
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  percent(s: any) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(s)))
      throw Error(
        this.t(
          'Enter a percentage with up to two decimal places',
          'أدخل نسبة بحد أقصى منزلتين عشريتين',
        ),
      );
    const n = Number(s) * 100;
    if (!Number.isInteger(Math.round(n)) || n < 0 || n > 10000)
      throw Error(
        this.t('Percentage must be between 0 and 100', 'النسبة يجب أن تكون بين صفر و١٠٠'),
      );
    return Math.round(n);
  }
  amount(v: string) {
    return parseCompactAmount(v);
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const f = this.form,
        r = this.selected(),
        d = this.dialog();
      let path = '',
        body: any = { requestId: crypto.randomUUID() },
        pick = (keys: string[]) =>
          Object.fromEntries(
            keys.filter((k) => f[k] !== undefined && f[k] !== '').map((k) => [k, f[k]]),
          ),
        dims = () =>
          Object.fromEntries(
            ['branchId', 'costCentreId', 'projectId', 'teamId']
              .filter((k) => f[k])
              .map((k) => [k, f[k]]),
          );
      if (d === 'setup') {
        path = 'setup';
        body = { ...body, year: Number(f.year), fiscalMonth: Number(f.fiscalMonth) };
      } else if (d === 'policy') {
        path = 'commission-policies' + (r ? '/' + r.id : '');
        body = {
          ...body,
          ...(r ? { version: r.version } : {}),
          ...pick(['name', 'roleKey', 'mode', 'from', 'active']),
          to: f.to || null,
          userId: f.userId || null,
          teamId: f.policyTeamId || null,
          rateBps: f.mode === 'percent' ? this.percent(f.ratePercent) : 0,
          fixedMinor: f.mode === 'fixed' ? this.amount(f.fixedMinor) : '0',
          tiers:
            f.mode === 'tiers'
              ? this.tiers.map((x) => ({
                  fromMinor: this.amount(x.from),
                  rateBps: this.percent(x.rate),
                }))
              : [],
        };
      } else if (d === 'automation') {
        path = 'automation-rules' + (r ? '/' + r.id : '');
        body = {
          ...body,
          ...(r ? { version: r.version } : {}),
          ...pick([
            'name',
            'contractType',
            'agreementId',
            'autoAdjust',
            'createInstallments',
            'collectionOwner',
            'active',
          ]),
          crmProjectId: f.crmProjectId || null,
          installments: Number(f.installments),
          intervalMonths: Number(f.intervalMonths),
          firstDueDays: Number(f.firstDueDays),
        };
      } else if (d === 'salary') {
        path = 'salary-profiles' + (r ? '/' + r.id : '');
        body = {
          ...body,
          ...(r ? { version: r.version } : {}),
          ...pick(['employeeId', 'deductionNote', 'active']),
          baseMinor: this.amount(f.baseMinor),
          allowanceMinor: this.amount(f.allowanceMinor),
          deductionMinor: this.amount(f.deductionMinor),
          advanceCapBps: this.percent(f.advanceCapPercent),
        };
      } else if (d === 'payrollrun') {
        path = 'payroll-runs';
        body = { ...body, month: f.month, date: f.date, employeeIds: f.employeeIds };
      } else if (d === 'settings') {
        path = 'settings';
        body = {
          ...body,
          version: r.version,
          fiscalMonth: Number(f.fiscalMonth),
          vatBps: this.percent(f.vatPercent),
        };
      } else if (['account', 'dimension', 'party', 'treasury', 'agreement'].includes(d)) {
        path =
          {
            account: 'accounts',
            dimension: 'dimensions',
            party: 'parties',
            treasury: 'treasuries',
            agreement: 'agreements',
          }[d] ?? '';
        if (r) path += '/' + r.id;
        body = {
          ...body,
          ...(r ? { version: r.version } : {}),
          ...pick(
            d === 'account'
              ? ['code', 'name', 'kind', 'active', 'cashFlow']
              : d === 'dimension'
                ? ['kind', 'name', 'active']
                : d === 'party'
                  ? ['kind', 'name', 'email', 'phone', 'taxNumber', 'active']
                  : d === 'treasury'
                    ? ['name', 'kind', 'bankReference', 'active']
                    : ['name', 'developerId', 'mode', 'active'],
          ),
        };
        if (d === 'party')
          body.referenceId =
            f.kind === 'employee' ? f.referenceId || null : (r?.reference_id ?? null);
        if (d === 'agreement')
          Object.assign(body, {
            rateBps: f.mode === 'percent' ? this.percent(f.ratePercent) : 0,
            fixedMinor: f.mode === 'fixed' ? this.amount(f.fixedMinor) : '0',
            tiers:
              f.mode === 'tiers'
                ? this.tiers.map((x) => ({
                    fromMinor: this.amount(x.from),
                    rateBps: this.percent(x.rate),
                  }))
                : [],
            agentBps: this.percent(f.agentPercent),
            leadBps: this.percent(f.leadPercent),
            dueDays: Number(f.dueDays),
          });
      } else if (d === 'target') {
        path = 'collection-targets' + (r ? '/' + r.id : '');
        body = {
          ...body,
          ...pick(['name', 'from', 'to']),
          amountMinor: this.amount(f.amountMinor),
          branchId: f.branchId || null,
          teamId: f.teamId || null,
          ...(r ? { version: r.version } : {}),
        };
      } else if (d === 'installment') {
        path = 'installment-plans';
        body = {
          ...body,
          ...pick([
            'customerId',
            'developerId',
            'date',
            'firstDue',
            'collectionOwner',
            'description',
          ]),
          totalMinor: this.amount(f.totalMinor),
          installments: Number(f.installments),
          intervalMonths: Number(f.intervalMonths),
        };
      } else if (d === 'period') {
        path = 'periods';
        body = { ...body, ...pick(['name', 'from', 'to']) };
      } else if (d === 'journal') {
        path = 'journals' + (r ? '/' + r.id : '');
        body = {
          ...body,
          ...pick(['date', 'memo', 'cashFlow']),
          ...(r ? { version: r.version } : {}),
          lines: this.lines.map((l) => ({
            accountId: l.accountId,
            partyId: l.partyId || null,
            ...dims(),
            debitMinor: l.debit ? this.amount(l.debit) : '0',
            creditMinor: l.credit ? this.amount(l.credit) : '0',
          })),
        };
      } else if (d === 'transaction') {
        path = 'transactions';
        body = {
          ...body,
          ...pick(['kind', 'date', 'treasuryId', 'memo', 'reference', 'cashFlow']),
          amountMinor: this.amount(f.amountMinor),
          ...dims(),
          ...(f.kind === 'transfer'
            ? { toTreasuryId: f.toTreasuryId }
            : {
                ...pick(['obligationId', 'partyId', 'method']),
                ...(!f.obligationId ? { counterAccountId: f.counterAccountId } : {}),
              }),
        };
      } else if (d === 'obligation') {
        path = 'obligations';
        body = {
          ...body,
          ...pick(['kind', 'partyId', 'date', 'dueDate', 'description']),
          netMinor: this.amount(f.netMinor),
          taxBps: this.percent(f.kind === 'customer_funds' ? '0' : f.taxPercent),
          ...dims(),
          ...pick(
            f.kind === 'customer_funds'
              ? ['developerId', 'collectionOwner']
              : f.kind === 'credit_note'
                ? ['creditFor']
                : ['accountId'],
          ),
        };
      } else if (d === 'cheque') {
        path = 'cheques';
        body = {
          ...body,
          ...pick([
            'number',
            'bank',
            'kind',
            'treasuryId',
            'partyId',
            'obligationId',
            'dueDate',
            'notes',
          ]),
          ...(!f.obligationId ? { counterAccountId: f.counterAccountId } : {}),
          amountMinor: this.amount(f.amountMinor),
        };
      } else if (d === 'custody') {
        path = 'custodies';
        body = {
          ...body,
          ...pick(['employeeId', 'purpose']),
          amountMinor: this.amount(f.amountMinor),
        };
      } else if (d === 'reconcile') {
        path = 'reconciliations';
        body = {
          ...body,
          ...pick(['treasuryId', 'date', 'notes']),
          statementMinor: String(f.statementAmount).startsWith('-')
            ? '-' + this.amount(String(f.statementAmount).slice(1))
            : this.amount(f.statementAmount),
          lineIds: this.selectedLines(),
        };
      } else if (d === 'book') {
        path = 'deals/' + r.id + '/book';
        const a = this.agreements().find((x) => x.id === f.agreementId);
        body = {
          ...body,
          ...pick(['date', 'agreementId', 'agentId', 'leadId']),
          version: r.version,
          agreementVersion: a?.version,
          ...dims(),
        };
      } else if (d === 'action') {
        const entity = this.current() === 'expenses' ? 'obligations' : this.current();
        path =
          entity +
          '/' +
          r.id +
          (['offset_advance', 'reverse_offset'].includes(this.action)
            ? '/settle-advance'
            : '/action');
        body = {
          ...body,
          version: r.version,
          action: ['reverse_payout_link', 'reverse_repayment_link'].includes(this.action)
            ? 'reverse_link'
            : this.action,
          ...pick(['reason', 'reference']),
          ...Object.fromEntries(
            this.fields()
              .filter((x) => x.type !== 'amount')
              .map((x) => [x.key, f[x.key]])
              .filter(([, v]) => v !== '' && v !== undefined),
          ),
          ...(f.amountMinor ? { amountMinor: this.amount(f.amountMinor) } : {}),
          ...dims(),
        };
        if (this.action === 'offset_advance')
          body.advanceVersion = this.advances().items.find(
            (a: any) => a.id === f.advanceId,
          )?.version;
      }
      await this.auth.request(this.base + path, body);
      this.dialog.set('');
      this.selected.set(null);
      this.previousFocus?.focus();
      this.notice.set(this.t('Saved successfully', 'تم الحفظ بنجاح'));
      await this.load();
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  staffColumns(): Column[] {
    return [
      { key: 'employee', en: 'Employee', ar: 'الموظف' },
      ...[
        ['saleValueMinor', 'Sales value', 'قيمة الصفقات'],
        ['earnedMinor', 'Earned commission', 'العمولة المكتسبة'],
        ['adjustmentsMinor', 'Adjustments', 'التسويات'],
        ['paidMinor', 'Commission paid', 'العمولة المدفوعة'],
        ['advanceOffsetsMinor', 'Advance offsets', 'خصم السلف من العمولة'],
        ['commissionOutstandingMinor', 'Commission remaining', 'العمولة المتبقية'],
        ['salaryOutstandingMinor', 'Salary remaining', 'الراتب المتبقي'],
        ['advanceBalanceMinor', 'Advance balance', 'رصيد السلف'],
        ['recoveryBalanceMinor', 'Recoveries', 'مبالغ مستردة من الموظف'],
        ['netPositionMinor', 'Net financial position', 'صافي الموقف المالي'],
      ].map(([key, en, ar]) => ({ key, en, ar, type: 'money' as const })),
    ];
  }
  statementValue(row: any, column: Column) {
    return this.value(row, column);
  }
  toggleEmployee(id: string, checked: boolean) {
    this.form.employeeIds = checked
      ? [...(this.form.employeeIds ?? []), id]
      : (this.form.employeeIds ?? []).filter((x: string) => x !== id);
  }
  async processAutomation() {
    this.error.set('');
    this.loading.set(true);
    try {
      const r = await this.auth.request(this.base + 'automation-process', {
        requestId: crypto.randomUUID(),
        version: 1,
        action: 'process',
      });
      this.notice.set(
        this.t('Processed deals: ', 'الصفقات المعالجة: ') +
          r.processed +
          this.t(' · Needs review: ', ' · تحتاج مراجعة: ') +
          r.errors.length,
      );
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  changeReport() {
    this.page.set(1);
    this.accountId = '';
    this.partyId = '';
    if (['account_statement', 'party_statement'].includes(this.reportKind)) {
      this.data.set({ items: [], summary: {}, total: 0 });
      this.notice.set(
        this.t('Choose the account or party, then Apply.', 'اختر الحساب أو الطرف ثم اضغط تطبيق.'),
      );
      return;
    }
    void this.load(true);
  }
  async preset(period: string) {
    const date = new Date(this.context().today + 'T00:00:00Z'),
      year = date.getUTCFullYear(),
      month = date.getUTCMonth();
    this.to = this.context().today;
    if (period === 'today') this.from = this.to;
    else if (period === 'week') {
      date.setUTCDate(date.getUTCDate() - date.getUTCDay());
      this.from = date.toISOString().slice(0, 10);
    } else if (period === 'month')
      this.from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    else if (period === 'quarter')
      this.from = new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1)).toISOString().slice(0, 10);
    else this.from = new Date(Date.UTC(year, 0, 1)).toISOString().slice(0, 10);
    await this.load(true);
  }
  async loadBankLines() {
    this.formError.set('');
    try {
      if (!this.form.treasuryId || !this.form.date)
        throw Error(
          this.t('Choose a bank and statement date first', 'اختر البنك وتاريخ الكشف أولًا'),
        );
      const r = await this.auth.request(
        this.base +
          'reconciliation-lines?' +
          new URLSearchParams({ treasuryId: this.form.treasuryId, to: this.form.date }),
      );
      this.bankLines.set(r);
      this.selectedLines.set([]);
    } catch (e) {
      this.formError.set((e as Error).message);
    }
  }
  toggleLine(id: string, on: boolean) {
    this.selectedLines.update((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  }
  selectedBankAmount() {
    return this.money(
      String(
        BigInt(this.bankLines()?.prior?.statement_minor ?? '0') +
          (this.bankLines()?.items ?? [])
            .filter((l: any) => this.selectedLines().includes(l.id))
            .reduce((s: bigint, l: any) => s + BigInt(l.debit_minor) - BigInt(l.credit_minor), 0n),
      ),
    );
  }
  downloadUrl(file: any) {
    return (
      this.config.apiUrl + this.base + 'attachments/' + encodeURIComponent(file.id) + '/download'
    );
  }
  pdfUrl(row: any) {
    const entity = this.current() === 'expenses' ? 'obligations' : this.current();
    return this.config.apiUrl + this.base + 'print/' + entity + '/' + row.id;
  }
  async upload(e: Event) {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    this.formError.set('');
    this.saving.set(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('requestId', crypto.randomUUID());
      const entity = this.current() === 'expenses' ? 'obligations' : this.current();
      await this.auth.request(this.base + 'files/' + entity + '/' + this.selected().id, form);
      this.files.set(
        (await this.auth.request(this.base + 'files/' + entity + '/' + this.selected().id)).items,
      );
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      input.value = '';
      this.saving.set(false);
    }
  }
  historyChanges(event: any) {
    const b = event.details?.input;
    if (!b) return [];
    const labels: Record<string, [string, string]> = {
      name: ['Name', 'الاسم'],
      code: ['Code', 'الرقم'],
      kind: ['Type', 'النوع'],
      date: ['Date', 'التاريخ'],
      from: ['From', 'من'],
      to: ['To', 'إلى'],
      memo: ['Description', 'البيان'],
      reason: ['Reason', 'السبب'],
      amountMinor: ['Amount', 'المبلغ'],
      netMinor: ['Net amount', 'صافي المبلغ'],
      taxBps: ['Tax %', 'نسبة الضريبة'],
      rateBps: ['Commission %', 'نسبة العمولة'],
      active: ['Active', 'نشط'],
      reference: ['Reference', 'المرجع'],
    };
    return Object.entries(labels)
      .filter(([k]) => b[k] !== undefined && b[k] !== null && b[k] !== '')
      .map(([k, l]) => ({
        label: this.t(l[0], l[1]),
        value: k.endsWith('Minor')
          ? this.money(b[k])
          : k.endsWith('Bps')
            ? String(b[k] / 100) + '%'
            : k === 'kind'
              ? this.label(b[k])
              : typeof b[k] === 'boolean'
                ? b[k]
                  ? this.t('Yes', 'نعم')
                  : this.t('No', 'لا')
                : String(b[k]),
      }));
  }
  historyTitle(kind: string) {
    const k = kind.replace(/^request\./, '');
    const labels: Record<string, [string, string]> = {
      'account.save': ['Account saved', 'حفظ الحساب'],
      'dimension.save': ['Branch or cost centre saved', 'حفظ الفرع أو مركز التكلفة'],
      'party.save': ['Party saved', 'حفظ الطرف'],
      'settings.save': ['Settings saved', 'حفظ الإعدادات'],
      'journal.save': ['Journal saved', 'حفظ القيد'],
      'journal.post': ['Journal posted', 'ترحيل القيد'],
      'journal.reverse': ['Journal reversed', 'عكس القيد'],
      'transaction.create': ['Voucher recorded', 'تسجيل السند'],
      'obligation.create': ['Document created', 'إنشاء المستند'],
      'obligation.approve': ['Document approved', 'اعتماد المستند'],
      'obligation.post': ['Document posted', 'ترحيل المستند'],
      'period.close': ['Period closed', 'إقفال الفترة'],
      'period.reopen': ['Period reopened', 'إعادة فتح الفترة'],
    };
    const found = Object.entries(labels).find(([prefix]) => k.startsWith(prefix));
    return found ? this.t(...found[1]) : this.t('Finance action recorded', 'تم تسجيل إجراء مالي');
  }
  historyTime(v: string) {
    return new Intl.DateTimeFormat(this.ui.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(v));
  }
  detailPairs() {
    if (this.selected()?.activity)
      return this.staffColumns().map((c) => ({
        label: this.t(c.en, c.ar),
        value: this.value(this.selected(), c),
      }));
    const r = this.selected();
    if (!r) return [];
    const labels: Record<string, [string, string]> = {
      name: ['Name', 'الاسم'],
      employee: ['Employee', 'الموظف'],
      email: ['Email', 'البريد'],
      phone: ['Phone', 'الهاتف'],
      start_date: ['Start date', 'بداية الفترة'],
      end_date: ['End date', 'نهاية الفترة'],
      bank_reference: ['Bank reference', 'مرجع البنك'],
      paid_out_date: ['HR payout date', 'تاريخ صرف السلفة'],
      code: ['Reference', 'المرجع'],
      entry_date: ['Date', 'التاريخ'],
      kind: ['Type', 'النوع'],
      status: ['Status', 'الحالة'],
      memo: ['Description', 'البيان'],
      description: ['Description', 'البيان'],
      purpose: ['Purpose', 'الغرض'],
      review_note: ['Review note', 'ملاحظة المراجعة'],
      base_minor: ['Base salary', 'الراتب الأساسي'],
      allowance_minor: ['Allowances', 'البدلات'],
      deduction_minor: ['Approved deductions', 'الخصومات المعتمدة'],
      deduction_note: ['Deduction reason', 'سبب الخصم'],
      advance_cap_bps: ['Advance deduction cap %', 'حد خصم السلف %'],
      month: ['Payroll month', 'شهر الرواتب'],
      net_minor: ['Net amount', 'الصافي'],
      tax_minor: ['Tax', 'الضريبة'],
      total_minor: ['Total', 'الإجمالي'],
      amount_minor: ['Amount', 'المبلغ'],
      paidMinor: ['Settled', 'المسوى'],
      creditedMinor: ['Credits / adjustments', 'الإشعارات والتسويات'],
      remainingMinor: ['Remaining', 'المتبقي'],
      due_date: ['Due date', 'الاستحقاق'],
      reference: ['Payment reference', 'مرجع السداد'],
      notes: ['Notes', 'ملاحظات'],
    };
    return Object.entries(labels)
      .filter(([k]) => r[k] !== undefined && r[k] !== null && r[k] !== '')
      .map(([k, v]) => ({
        label: this.t(v[0], v[1]),
        value: k.endsWith('_bps')
          ? String(r[k] / 100) + '%'
          : k.endsWith('_minor') || k.endsWith('Minor')
            ? this.money(String(r[k]))
            : k === 'status' || k === 'kind'
              ? this.label(r[k])
              : String(r[k]),
      }));
  }
  summaryLabels: Record<string, [string, string]> = {
    targetMinor: ['Collection target', 'مستهدف التحصيل'],
    actualMinor: ['Developer commissions collected', 'عمولات المطورين المحصلة'],
    targetVarianceMinor: ['Actual less target', 'الفعلي ناقص المستهدف'],
    totalReceiptsMinor: ['All net receipts', 'إجمالي صافي المقبوضات'],
    cashMinor: ['Cash & banks', 'الخزينة والبنوك'],
    developerReceivableMinor: ['Developer receivables', 'مستحقات المطورين'],
    customerReceivableMinor: ['Customer receivables', 'مديونيات العملاء'],
    supplierPayableMinor: ['Supplier payables', 'التزامات الموردين'],
    commissionPayableMinor: ['Commissions payable', 'العمولات المستحقة'],
    clientFundsMinor: ['Developer client funds', 'أموال العملاء للمطورين'],
    employeeCustodyMinor: ['Employee cash custody', 'العهد النقدية'],
    salaryAdvancesMinor: ['Salary advances', 'سلف الموظفين'],
    salariesPayableMinor: ['Salaries payable', 'رواتب مستحقة'],
    revenueMinor: ['Revenue', 'الإيرادات'],
    expenseMinor: ['Expenses', 'المصروفات'],
    profitMinor: ['Net profit / loss', 'صافي الربح أو الخسارة'],
    assetsMinor: ['Assets', 'الأصول'],
    liabilitiesMinor: ['Liabilities', 'الالتزامات'],
    equityMinor: ['Equity', 'حقوق الملكية'],
    retainedEarningsMinor: ['Accumulated earnings', 'الأرباح المتراكمة'],
    differenceMinor: ['Reconciliation difference', 'فرق المطابقة'],
    openingMinor: ['Opening balance', 'رصيد افتتاحي'],
    movementMinor: ['Net movement', 'صافي الحركة'],
    closingMinor: ['Closing balance', 'رصيد ختامي'],
    debitMinor: ['Total debit', 'إجمالي المدين'],
    creditMinor: ['Total credit', 'إجمالي الدائن'],
    receivableMinor: ['Receivables', 'المستحقات'],
    payableMinor: ['Payables', 'الالتزامات'],
  };
  summary() {
    return Object.entries(this.data().summary ?? {})
      .filter(([k]) => this.summaryLabels[k])
      .map(([k, v]) => ({
        key: k,
        label: this.t(...this.summaryLabels[k]),
        value: this.money(String(v)),
      }));
  }
  exportRows() {
    const cols = this.isSelf ? this.staffColumns() : this.columns(),
      esc = (v: string) => {
        if (/^[=+@\-\t\r]/.test(v)) v = "'" + v;
        return '"' + v.replaceAll('"', '""') + '"';
      },
      rows = [
        cols.map((c) => this.t(c.en, c.ar)),
        ...((this.isSelf ? this.data().staff?.items : this.data().items) ?? []).map((r: any) =>
          cols.map((c) => {
            if (c.type === 'money') {
              const n = BigInt(r[c.key] ?? '0'),
                abs = n < 0n ? -n : n;
              return (
                (n < 0n ? '-' : '') + String(abs / 100n) + '.' + String(abs % 100n).padStart(2, '0')
              );
            }
            return this.value(r, c);
          }),
        ),
      ];
    const url = URL.createObjectURL(
        new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], {
          type: 'text/csv;charset=utf-8',
        }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = 'finance-' + this.current() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
