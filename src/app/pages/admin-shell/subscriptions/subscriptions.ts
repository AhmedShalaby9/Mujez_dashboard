import { FormsModule } from '@angular/forms';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { CompaniesApi } from '../../../companies-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Plan = string;
type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended';
type PaymentMethod = 'card' | 'bank' | 'instapay';
type SortKey = 'company' | 'plan' | 'status' | 'payment' | 'renews' | 'mrr' | 'amount' | 'start';
type Tab = SubStatus | 'all' | 'ending';
type StaticKind = 'cycle' | 'extend' | 'adjust' | 'reminders';
const LOGO: Array<[string, string]> = [
  ['#EEF5D6', '#3F5A0E'],
  ['#E6EEFB', '#274A93'],
  ['#F6E8DE', '#8A4A1E'],
  ['#EDE7F8', '#55349A'],
  ['#E3F2EF', '#1D6458'],
  ['#F7E4E7', '#933045'],
];

interface Subscription {
  version: number;
  cancelAtPeriodEnd: boolean;
  amountMinor: string;
  planVersionId: string;
  pendingVersionId: string | null;
  planRevision: number;
  subId: string;
  companyId: string;
  companyEn: string;
  companyAr: string;
  plan: Plan;
  cycle: 'monthly' | 'annual';
  status: SubStatus;
  payment: PaymentMethod;
  renewsOn: string;
  periodStart?: string;
  mrr: number;
}

const PLAN_LABEL: Record<Lang, Record<Plan, string>> = {
  en: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
  ar: { starter: 'أساسية', pro: 'احترافية', business: 'أعمال', enterprise: 'مؤسسات' },
};

const PLAN_DOT: Record<Plan, string> = {
  starter: '#a1a1a6',
  pro: '#111113',
  business: '#8BB33A',
  enterprise: '#c8f169',
};

const STATUS_LABEL: Record<Lang, Record<SubStatus, string>> = {
  en: {
    trialing: 'Trialing',
    active: 'Active',
    past_due: 'Past due',
    canceled: 'Canceled',
    expired: 'Expired',
    suspended: 'Suspended',
  },
  ar: {
    trialing: 'تجريبي',
    active: 'نشط',
    past_due: 'متأخر الدفع',
    canceled: 'ملغى',
    expired: 'منتهٍ',
    suspended: 'موقوف',
  },
};

const STATUS_COLOR: Record<SubStatus, { bg: string; fg: string; dot: string }> = {
  trialing: { bg: '#EAEFFD', fg: '#2E47A8', dot: '#5B78E5' },
  active: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
  past_due: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
  canceled: { bg: '#F1F1ED', fg: '#6E6E73', dot: '#B4B4AE' },
  expired: { bg: '#F1F1ED', fg: '#45454A', dot: '#8A8A90' },
  suspended: { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' },
};

const PAYMENT_LABEL: Record<Lang, Record<PaymentMethod, string>> = {
  en: { card: 'Card', bank: 'Bank transfer', instapay: 'InstaPay' },
  ar: { card: 'بطاقة', bank: 'تحويل بنكي', instapay: 'إنستاباي' },
};

interface Copy {
  eyebrow: string;
  title: string;
  searchPh: string;
  statusAll: string;
  planAll: string;
  paymentAll: string;
  kpis: { total: string; active: string; trialing: string; pastDue: string };
  columns: {
    company: string;
    plan: string;
    status: string;
    payment: string;
    cycle: string;
    renews: string;
    mrr: string;
  };
  cycleLabel: { monthly: string; annual: string };
  actions: { view: string; changePlan: string; renew: string; cancel: string };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: {
    subId: string;
    company: string;
    plan: string;
    status: string;
    payment: string;
    cycle: string;
    renews: string;
    mrr: string;
  };
  changePlanTitle: string;
  changePlanSub: (name: string) => string;
  changePlanLabel: string;
  changePlanConfirm: string;
  cancelTitle: string;
  cancelBody: (name: string) => string;
  renewTitle: string;
  renewBody: (name: string) => string;
  confirmCancel: string;
  confirmGo: string;
  toastChanged: (name: string, plan: string) => string;
  toastCanceled: (name: string) => string;
  toastRenewed: (name: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Billing',
    title: 'Subscriptions',
    searchPh: 'Search company, ID, subscription ref…',
    statusAll: 'All statuses',
    planAll: 'All plans',
    paymentAll: 'All payment methods',
    kpis: {
      total: 'Total subscriptions',
      active: 'Active',
      trialing: 'Trialing',
      pastDue: 'Past due',
    },
    columns: {
      company: 'Company',
      plan: 'Plan',
      status: 'Status',
      payment: 'Payment',
      cycle: 'Cycle',
      renews: 'Renews / ends',
      mrr: 'MRR',
    },
    cycleLabel: { monthly: 'Monthly', annual: 'Annual' },
    actions: {
      view: 'View',
      changePlan: 'Change plan',
      renew: 'Renew',
      cancel: 'Cancel subscription',
    },
    pager: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    prev: 'Previous',
    next: 'Next',
    emptyTitle: 'No subscriptions match your filters',
    emptySub: 'Try clearing the search or filters.',
    drawerClose: 'Close',
    drawerFields: {
      subId: 'Subscription ref',
      company: 'Company',
      plan: 'Plan',
      status: 'Status',
      payment: 'Payment method',
      cycle: 'Billing cycle',
      renews: 'Renews / ends',
      mrr: 'MRR',
    },
    changePlanTitle: 'Change plan',
    changePlanSub: (name) =>
      `${name} · pick the new plan. Changes apply immediately. No charge, refund, or proration is processed.`,
    changePlanLabel: 'New plan',
    changePlanConfirm: 'Change plan',
    cancelTitle: 'Cancel subscription',
    cancelBody: (name) =>
      `${name}'s subscription will end at the close of the current billing period.`,
    renewTitle: 'Renew subscription',
    renewBody: (name) => `${name}'s subscription will be renewed for another cycle immediately.`,
    confirmCancel: 'Cancel',
    confirmGo: 'Confirm',
    toastChanged: (name, plan) => `${name} moved to the ${plan} plan.`,
    toastCanceled: (name) => `${name}'s subscription was canceled.`,
    toastRenewed: (name) => `${name}'s subscription was renewed.`,
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'الاشتراكات',
    searchPh: 'ابحث بالشركة أو المعرّف أو مرجع الاشتراك…',
    statusAll: 'كل الحالات',
    planAll: 'كل الخطط',
    paymentAll: 'كل طرق الدفع',
    kpis: {
      total: 'إجمالي الاشتراكات',
      active: 'نشطة',
      trialing: 'تجريبية',
      pastDue: 'متأخرة الدفع',
    },
    columns: {
      company: 'الشركة',
      plan: 'الخطة',
      status: 'الحالة',
      payment: 'الدفع',
      cycle: 'الدورة',
      renews: 'التجديد / الانتهاء',
      mrr: 'الإيراد الشهري',
    },
    cycleLabel: { monthly: 'شهري', annual: 'سنوي' },
    actions: { view: 'عرض', changePlan: 'تغيير الخطة', renew: 'تجديد', cancel: 'إلغاء الاشتراك' },
    pager: (from, to, total) => `عرض ${from}–${to} من ${total}`,
    prev: 'السابق',
    next: 'التالي',
    emptyTitle: 'لا توجد اشتراكات مطابقة للفلاتر',
    emptySub: 'جرّب مسح البحث أو الفلاتر.',
    drawerClose: 'إغلاق',
    drawerFields: {
      subId: 'مرجع الاشتراك',
      company: 'الشركة',
      plan: 'الخطة',
      status: 'الحالة',
      payment: 'طريقة الدفع',
      cycle: 'دورة الفوترة',
      renews: 'التجديد / الانتهاء',
      mrr: 'الإيراد الشهري',
    },
    changePlanTitle: 'تغيير الخطة',
    changePlanSub: (name) =>
      `${name} · اختر الخطة الجديدة. تُطبّق الشروط فورًا دون تحصيل أو استرداد دفعات.`,
    changePlanLabel: 'الخطة الجديدة',
    changePlanConfirm: 'تغيير الخطة',
    cancelTitle: 'إلغاء الاشتراك',
    cancelBody: (name) => `سينتهي اشتراك ${name} في نهاية دورة الفوترة الحالية.`,
    renewTitle: 'تجديد الاشتراك',
    renewBody: (name) => `سيُجدَّد اشتراك ${name} لدورة أخرى فورًا.`,
    confirmCancel: 'إلغاء',
    confirmGo: 'تأكيد',
    toastChanged: (name, plan) => `انتقلت ${name} إلى خطة ${plan}.`,
    toastCanceled: (name) => `تم إلغاء اشتراك ${name}.`,
    toastRenewed: (name) => `تم تجديد اشتراك ${name}.`,
  },
};

const PAGE_SIZE = 10;

@Component({
  selector: 'app-subscriptions',
  imports: [FormsModule],
  templateUrl: './subscriptions.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './subscriptions.scss'],
})
export class Subscriptions {
  private readonly ui = inject(AdminUiState);
  private readonly route = inject(ActivatedRoute);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: SubStatus[] = [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'expired',
    'suspended',
  ];
  get planTypes(): Plan[] {
    return this.availablePlans().map((p) => p.key);
  }
  readonly paymentTypes: PaymentMethod[] = ['card', 'bank', 'instapay'];

  private readonly subs = signal<Subscription[]>([]);

  readonly search = signal('');
  readonly statusFilter = signal<Tab>('all');
  readonly planFilter = signal<Plan | 'all'>('all');
  readonly paymentFilter = signal<PaymentMethod | 'all'>('all');
  readonly sortKey = signal<SortKey>('company');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);

  readonly viewing = signal<Subscription | null>(null);
  readonly kebabFor = signal<string | null>(null);
  readonly changingPlan = signal<Subscription | null>(null);
  readonly newPlan = signal<Plan>('starter');
  readonly confirming = signal<{ sub: Subscription; kind: 'cancel' | 'renew' } | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  private readonly api = inject(SubscriptionsApi);
  private readonly companiesApi = inject(CompaniesApi);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly availablePlans = signal<
    Array<{ key: Plan; nameEn: string; nameAr: string; archived: boolean; planVersionId: string }>
  >([]);
  readonly companies = signal<Array<{ id: string; nameEn: string; status: string }>>([]);
  draft = {
    companyId: '',
    plan: 'starter' as Plan,
    cycle: 'monthly',
    payment: 'bank',
    status: 'active',
  };
  readonly activePlans = computed(() => this.availablePlans().filter((p) => !p.archived));
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.subs.set(await this.api.subscriptions<Subscription>());
      this.availablePlans.set(await this.api.plans(true));
      this.companies.set(await this.companiesApi.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load subscriptions');
    } finally {
      this.loading.set(false);
    }
  }
  async createSubscription() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const plan = this.availablePlans().find((p) => p.key === this.draft.plan && !p.archived);
      if (!plan) throw new Error('Select an available plan');
      await this.api.create({ ...this.draft, planVersionId: plan.planVersionId });
      this.creating.set(false);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to create subscription');
    } finally {
      this.saving.set(false);
    }
  }
  constructor() {
    void this.reload();
    const planParam = this.route.snapshot.queryParamMap.get('plan') as Plan | null;
    if (planParam) {
      this.planFilter.set(planParam);
    }
  }

  readonly kpis = computed(() => {
    const list = this.subs();
    return {
      total: list.length,
      active: list.filter((s) => s.status === 'active').length,
      trialing: list.filter((s) => s.status === 'trialing').length,
      pastDue: list.filter((s) => s.status === 'past_due').length,
    };
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const plan = this.planFilter();
    const payment = this.paymentFilter();
    return this.subs().filter((s) => {
      if (!this.inTab(s, status)) return false;
      if (plan !== 'all' && s.plan !== plan) return false;
      if (payment !== 'all' && s.payment !== payment) return false;
      if (!q) return true;
      return (
        s.companyEn.toLowerCase().includes(q) ||
        s.companyAr.includes(q) ||
        s.companyId.toLowerCase().includes(q) ||
        s.subId.toLowerCase().includes(q)
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
        case 'company':
          av = lang === 'ar' ? a.companyAr : a.companyEn;
          bv = lang === 'ar' ? b.companyAr : b.companyEn;
          break;
        case 'plan':
          av = this.planTypes.indexOf(a.plan);
          bv = this.planTypes.indexOf(b.plan);
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
        case 'payment':
          av = a.payment;
          bv = b.payment;
          break;
        case 'renews':
          av = a.renewsOn;
          bv = b.renewsOn;
          break;
        case 'mrr':
          av = a.mrr;
          bv = b.mrr;
          break;
        case 'amount':
          av = Number(a.amountMinor);
          bv = Number(b.amountMinor);
          break;
        case 'start':
          av = a.periodStart ?? '';
          bv = b.periodStart ?? '';
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

  isPlanAvailable(key: Plan) {
    return this.activePlans().some((p) => p.key === key);
  }
  planLabel(p: Plan): string {
    const option = this.availablePlans().find((v) => v.key === p);
    return option
      ? this.lang() === 'ar'
        ? option.nameAr
        : option.nameEn
      : (PLAN_LABEL[this.lang()][p] ?? p);
  }

  planDot(p: Plan): string {
    return PLAN_DOT[p] ?? '#111113';
  }

  statusLabel(s: SubStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: SubStatus): { bg: string; fg: string; dot: string } {
    return STATUS_COLOR[s];
  }

  paymentLabel(p: PaymentMethod): string {
    return PAYMENT_LABEL[this.lang()][p];
  }

  companyName(s: Subscription): string {
    return this.lang() === 'ar' ? s.companyAr : s.companyEn;
  }

  cycleLabel(s: Subscription): string {
    return this.L().cycleLabel[s.cycle];
  }

  formatMrr(v: number): string {
    if (v === 0) return '—';
    return this.lang() === 'ar'
      ? `${v.toLocaleString('en-US')} ج.م`
      : `EGP ${v.toLocaleString('en-US')}`;
  }

  private logo(s: Subscription): [string, string] {
    const code = s.companyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return LOGO[code % LOGO.length];
  }
  logoBg(s: Subscription): string {
    return this.logo(s)[0];
  }
  logoFg(s: Subscription): string {
    return this.logo(s)[1];
  }

  logoInitials(s: Subscription): string {
    return s.companyEn
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

  setPlanFilter(v: Plan | 'all'): void {
    this.planFilter.set(v);
    this.page.set(1);
  }

  setPaymentFilter(v: PaymentMethod | 'all'): void {
    this.paymentFilter.set(v);
    this.page.set(1);
  }

  filterByKpiStatus(status: Tab): void {
    this.setStatusFilter(status);
  }
  private ended(s: Subscription) {
    return ['canceled', 'expired'].includes(s.status);
  }
  /** "Cancels at renewal" = scheduled cancellation that hasn't taken effect yet. */
  isEnding(s: Subscription) {
    return s.cancelAtPeriodEnd && !this.ended(s);
  }
  inTab(s: Subscription, t: Tab) {
    return t === 'all' || (t === 'ending' ? this.isEnding(s) : s.status === t);
  }
  readonly tabs = computed(() => {
    const ar = this.lang() === 'ar';
    const list: Array<[Tab, string, string]> = [
      ['all', 'All', 'الكل'],
      ['active', 'Active', 'نشطة'],
      ['trialing', 'Trialing', 'تجريبية'],
      ['past_due', 'Past due', 'متأخرة'],
      ['ending', 'Cancels at renewal', 'تُلغى عند التجديد'],
      ['canceled', 'Canceled', 'ملغاة'],
      ['expired', 'Expired', 'منتهية'],
      ['suspended', 'Suspended', 'موقوفة'],
    ];
    return list
      .map(([k, en, a]) => ({
        k,
        label: ar ? a : en,
        n: this.subs().filter((x) => this.inTab(x, k)).length,
      }))
      .filter((t) => t.k !== 'suspended' || t.n > 0);
  });
  daysTo(iso: string) {
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  }
  readonly stats = computed(() => {
    const list = this.subs();
    const live = list.filter((x) => !this.ended(x));
    return {
      mrr: list.reduce((n, x) => n + (Number(x.mrr) || 0), 0),
      active: list.filter((x) => x.status === 'active').length,
      trialing: list.filter((x) => x.status === 'trialing').length,
      trialSoon: list.filter((x) => x.status === 'trialing' && this.daysTo(x.renewsOn) <= 7).length,
      pastDue: list.filter((x) => x.status === 'past_due').length,
      renewSoon: live.filter((x) => !x.cancelAtPeriodEnd && this.daysTo(x.renewsOn) <= 7).length,
      ending: list.filter((x) => this.isEnding(x)).length,
    };
  });
  readonly hasFilters = computed(
    () =>
      !!this.search().trim() ||
      this.statusFilter() !== 'all' ||
      this.planFilter() !== 'all' ||
      this.paymentFilter() !== 'all',
  );
  clearFilters() {
    this.search.set('');
    this.statusFilter.set('all');
    this.planFilter.set('all');
    this.paymentFilter.set('all');
    this.page.set(1);
  }
  isEnded(s: Subscription) {
    return this.ended(s);
  }
  amount(s: Subscription) {
    return 'EGP ' + Math.round(Number(s.amountMinor) / 100).toLocaleString('en-US');
  }
  date(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  renewSub(s: Subscription): string {
    if (this.ended(s)) return '';
    const d = this.daysTo(s.renewsOn),
      ar = this.lang() === 'ar';
    if (s.status === 'trialing') return ar ? `تنتهي التجربة خلال ${d} يوم` : `trial ends in ${d} d`;
    if (this.isEnding(s)) return ar ? 'يُلغى في هذا التاريخ' : 'cancels on this date';
    return d <= 7 ? (ar ? `خلال ${d} أيام` : `in ${d} days`) : '';
  }
  money(v: number) {
    return 'EGP ' + (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v).toLocaleString('en-US'));
  }
  /** Plan rank from the catalog order, for upgrade/downgrade shortcuts. */
  private rank(key: Plan) {
    return this.activePlans().findIndex((p) => p.key === key);
  }
  neighbour(s: Subscription, dir: 1 | -1): Plan | null {
    const list = this.activePlans();
    const i = this.rank(s.plan);
    return i < 0 ? null : (list[i + dir]?.key ?? null);
  }
  openChangeTo(s: Subscription, plan: Plan) {
    this.openChangePlan(s);
    this.newPlan.set(plan);
  }
  planPrice(key: Plan, cycle: 'monthly' | 'annual') {
    const p = this.availablePlans().find((x) => x.key === key) as any;
    const v = p?.[cycle === 'annual' ? 'annualMinor' : 'monthlyMinor'];
    return typeof v === 'number' ? 'EGP ' + Math.round(v / 100).toLocaleString('en-US') : '—';
  }

  // ---- static (design-only) forms; see BACKEND_MISSING.md ----
  readonly staticForm = signal<{ kind: StaticKind; sub: Subscription | null } | null>(null);
  readonly cancelReason = signal('price');
  readonly cancelNote = signal('');
  openStatic(kind: StaticKind, sub: Subscription | null = null) {
    this.kebabFor.set(null);
    this.staticForm.set({ kind, sub });
  }
  submitStatic() {
    const ar = this.lang() === 'ar';
    this.staticForm.set(null);
    this.showToast(
      ar
        ? 'هذا الإجراء غير متصل بالخادم بعد — لم يتغير شيء.'
        : "This action isn't connected to the backend yet — nothing was changed.",
    );
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

  openView(s: Subscription): void {
    this.viewing.set(s);
    this.kebabFor.set(null);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleKebab(id: string): void {
    this.kebabFor.set(this.kebabFor() === id ? null : id);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  openChangePlan(s: Subscription): void {
    this.changingPlan.set(s);
    this.newPlan.set(s.plan);
    this.kebabFor.set(null);
  }

  closeChangePlan(): void {
    this.changingPlan.set(null);
  }

  async submitChangePlan() {
    const target = this.changingPlan();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const plan = this.activePlans().find((p) => p.key === this.newPlan());
      if (!plan) throw new Error('Select an available plan');
      await this.api.action(target.subId, 'change', {
        version: target.version,
        plan: plan.key,
        planVersionId: plan.planVersionId,
      });
      this.changingPlan.set(null);
      this.viewing.set(null);
      await this.reload();
      this.showToast(this.L().toastChanged(this.companyName(target), this.planLabel(plan.key)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to change plan');
    } finally {
      this.saving.set(false);
    }
  }

  askConfirm(s: Subscription, kind: 'cancel' | 'renew'): void {
    this.cancelReason.set('price');
    this.cancelNote.set('');
    this.confirming.set({ sub: s, kind });
    this.kebabFor.set(null);
  }

  cancelConfirm(): void {
    this.confirming.set(null);
  }

  async performConfirm() {
    const target = this.confirming();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.action(target.sub.subId, target.kind, { version: target.sub.version });
      this.confirming.set(null);
      this.viewing.set(null);
      await this.reload();
      const n = this.companyName(target.sub);
      this.showToast(
        target.kind === 'cancel' ? this.L().toastCanceled(n) : this.L().toastRenewed(n),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update subscription');
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
