import { FormsModule } from '@angular/forms';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { CompaniesApi } from '../../../companies-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Plan = string;
type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended';
type PaymentMethod = 'card' | 'bank' | 'instapay';
type SortKey = 'company' | 'plan' | 'status' | 'payment' | 'renews' | 'mrr';

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
  mrr: number;
}

const PLAN_LABEL: Record<Lang, Record<Plan, string>> = {
  en: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
  ar: { starter: 'أساسية', pro: 'احترافية', business: 'أعمال', enterprise: 'مؤسسات' },
};

const PLAN_DOT: Record<Plan, string> = {
  starter: '#C3C5D6',
  pro: '#3D4FD6',
  business: '#7E89E6',
  enterprise: '#F5B841',
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

const STATUS_COLOR: Record<SubStatus, { bg: string; fg: string }> = {
  trialing: { bg: '#E6E8FB', fg: '#2B37A0' },
  active: { bg: '#DCEEE1', fg: '#2F7A4F' },
  past_due: { bg: '#F6E6CB', fg: '#9A6B1E' },
  canceled: { bg: '#EEEDE8', fg: '#6B6A65' },
  expired: { bg: '#F6E6CB', fg: '#9A6B1E' },
  suspended: { bg: '#F8E1DC', fg: '#9A3422' },
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
  styleUrl: './subscriptions.scss',
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
  readonly statusFilter = signal<SubStatus | 'all'>('all');
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
      if (status !== 'all' && s.status !== status) return false;
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
    return PLAN_DOT[p] ?? '#3D4FD6';
  }

  statusLabel(s: SubStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: SubStatus): { bg: string; fg: string } {
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

  private readonly logoPalette = ['#3D4FD6', '#7E89E6', '#16182A', '#9A6B1E', '#2F7A4F', '#B4442F'];

  logoBg(s: Subscription): string {
    const code = s.companyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return this.logoPalette[code % this.logoPalette.length];
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

  setStatusFilter(v: SubStatus | 'all'): void {
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

  filterByKpiStatus(status: SubStatus | 'all'): void {
    this.setStatusFilter(status);
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
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to change plan');
    } finally {
      this.saving.set(false);
    }
  }

  askConfirm(s: Subscription, kind: 'cancel' | 'renew'): void {
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
