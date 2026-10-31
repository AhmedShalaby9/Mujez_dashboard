import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompaniesApi } from '../../../companies-api.service';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { FeaturesApi } from '../../../features-api.service';
import { AuthService } from '../../../auth.service';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type CompanyType = 'brokerage' | 'developer' | 'property_mgmt' | 'hybrid';
type CompanyStatus = 'pending' | 'trial' | 'active' | 'suspended' | 'expired' | 'archived';
type Plan = 'starter' | 'pro' | 'business' | 'enterprise';
type SortKey =
  'name' | 'status' | 'plan' | 'type' | 'city' | 'users' | 'mrr' | 'activity' | 'created';
type WsMode = 'read' | 'manage';
type ConfirmKind = 'suspend' | 'reactivate' | 'archive';
type Tab =
  'all' | 'active' | 'trial' | 'pending' | 'pastdue' | 'suspended' | 'expired' | 'archived';
type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended';
type ReasonKind = 'payment' | 'security' | 'terms' | 'request';
interface Resource {
  used: number | null;
  limit: number | null;
  measured: boolean;
}
interface Usage {
  id: string;
  users: Resource;
  listings: Resource;
  storage: Resource;
}

interface Company {
  slug: string;
  version: number;
  id: string;
  nameEn: string;
  nameAr: string;
  type: CompanyType;
  city: string;
  adminEmail: string;
  phone: string;
  website: string;
  plan: Plan;
  status: CompanyStatus;
  statusReason?: string | null;
  cycle?: 'monthly' | 'annual' | null;
  users: number;
  mrr: number;
  createdAt: string;
  lastActivity: string;
}

const CITY_AR: Record<string, string> = {
  Cairo: 'القاهرة',
  Giza: 'الجيزة',
  Alexandria: 'الإسكندرية',
  'New Cairo': 'القاهرة الجديدة',
  '6th of October': 'السادس من أكتوبر',
  'Sheikh Zayed': 'الشيخ زايد',
  Hurghada: 'الغردقة',
  'North Coast': 'الساحل الشمالي',
  'New Capital': 'العاصمة الإدارية',
  Heliopolis: 'مصر الجديدة',
  Maadi: 'المعادي',
  'Nasr City': 'مدينة نصر',
  'Al Rehab': 'الرحاب',
  'El Gouna': 'الجونة',
};

const TYPE_LABEL: Record<Lang, Record<CompanyType, string>> = {
  en: {
    brokerage: 'Brokerage',
    developer: 'Developer',
    property_mgmt: 'Property Mgmt',
    hybrid: 'Hybrid',
  },
  ar: {
    brokerage: 'وساطة عقارية',
    developer: 'مطوّر عقاري',
    property_mgmt: 'إدارة عقارات',
    hybrid: 'مختلط',
  },
};

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

const STATUS_LABEL: Record<Lang, Record<CompanyStatus, string>> = {
  en: {
    pending: 'Pending',
    trial: 'Trial',
    active: 'Active',
    suspended: 'Suspended',
    expired: 'Expired',
    archived: 'Archived',
  },
  ar: {
    pending: 'قيد الانتظار',
    trial: 'تجريبية',
    active: 'نشطة',
    suspended: 'موقوفة',
    expired: 'منتهية',
    archived: 'مؤرشفة',
  },
};

const STATUS_COLOR: Record<CompanyStatus, { bg: string; fg: string; dot: string }> = {
  pending: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
  trial: { bg: '#EAEFFD', fg: '#2E47A8', dot: '#5B78E5' },
  active: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
  suspended: { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' },
  expired: { bg: '#F1F1ED', fg: '#45454A', dot: '#8A8A90' },
  archived: { bg: '#F1F1ED', fg: '#6E6E73', dot: '#B4B4AE' },
};

const SUB_LABEL: Record<SubStatus, [string, string]> = {
  active: ['Paid', 'مدفوع'],
  trialing: ['Trialing', 'تجريبي'],
  past_due: ['Past due', 'متأخر'],
  canceled: ['Canceled', 'ملغي'],
  expired: ['Expired', 'منتهي'],
  suspended: ['Suspended', 'موقوف'],
};
const SUB_COLOR: Record<SubStatus, string> = {
  active: '#1E6B3E',
  trialing: '#2E47A8',
  past_due: '#83570C',
  canceled: '#6E6E73',
  expired: '#6E6E73',
  suspended: '#A23624',
};
const REASONS: Record<ReasonKind, [string, string]> = {
  payment: ['Non-payment', 'عدم السداد'],
  security: ['Security review', 'مراجعة أمنية'],
  terms: ['Terms violation', 'مخالفة الشروط'],
  request: ['Customer request', 'طلب العميل'],
};
const LOGO: Array<[string, string]> = [
  ['#EEF5D6', '#3F5A0E'],
  ['#E6EEFB', '#274A93'],
  ['#F6E8DE', '#8A4A1E'],
  ['#EDE7F8', '#55349A'],
  ['#E3F2EF', '#1D6458'],
  ['#F7E4E7', '#933045'],
];

interface Copy {
  eyebrow: string;
  title: string;
  addBtn: string;
  exportBtn: string;
  searchPh: string;
  statusAll: string;
  typeAll: string;
  planAll: string;
  kpis: { total: string; active: string; trial: string; suspended: string };
  columns: {
    company: string;
    status: string;
    plan: string;
    type: string;
    city: string;
    users: string;
    mrr: string;
    activity: string;
    actions: string;
  };
  actions: { view: string; enter: string; suspend: string; reactivate: string; archive: string };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: {
    id: string;
    type: string;
    status: string;
    plan: string;
    city: string;
    adminEmail: string;
    phone: string;
    website: string;
    users: string;
    mrr: string;
    created: string;
    lastActivity: string;
    cycle: string;
    owner: string;
  };
  cycleNames: { monthly: string; annual: string };
  statusNote: (status: CompanyStatus, reason: string | null) => string | null;
  wsTitle: string;
  wsSub: string;
  wsModeRead: string;
  wsModeReadSub: string;
  wsModeManage: string;
  wsModeManageSub: string;
  wsReasonLabel: string;
  wsReasonPh: string;
  wsDurationLabel: string;
  wsAck: string;
  wsCancel: string;
  wsEnter: string;
  wsReasonErr: string;
  wsAckErr: string;
  wsPasswordLabel: string;
  confirmSuspendTitle: string;
  confirmSuspendBody: (name: string) => string;
  confirmReactivateTitle: string;
  confirmReactivateBody: (name: string) => string;
  confirmArchiveTitle: string;
  confirmArchiveBody: (name: string) => string;
  confirmCancel: string;
  confirmGo: string;
  toastSuspended: (name: string) => string;
  toastReactivated: (name: string) => string;
  toastArchived: (name: string) => string;
  toastExported: (n: number) => string;
  comingSoon: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Companies',
    title: 'Companies',
    addBtn: 'Add company',
    exportBtn: 'Export CSV',
    searchPh: 'Search name, ID, admin email, city…',
    statusAll: 'All statuses',
    typeAll: 'All types',
    planAll: 'All plans',
    kpis: { total: 'Total companies', active: 'Active', trial: 'Trial', suspended: 'Suspended' },
    columns: {
      company: 'Company',
      status: 'Status',
      plan: 'Plan',
      type: 'Type',
      city: 'City',
      users: 'Users',
      mrr: 'MRR',
      activity: 'Last activity',
      actions: '',
    },
    actions: {
      view: 'View',
      enter: 'Enter',
      suspend: 'Suspend',
      reactivate: 'Reactivate',
      archive: 'Archive',
    },
    pager: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    prev: 'Previous',
    next: 'Next',
    emptyTitle: 'No companies match your filters',
    emptySub: 'Try clearing the search or filters.',
    drawerClose: 'Close',
    drawerFields: {
      id: 'Company ID',
      type: 'Type',
      status: 'Status',
      plan: 'Plan',
      city: 'City',
      adminEmail: 'Admin email',
      phone: 'Phone',
      website: 'Website',
      users: 'CRM users',
      mrr: 'MRR',
      created: 'Created',
      lastActivity: 'Last activity',
      cycle: 'Billing cycle',
      owner: 'Account owner',
    },
    cycleNames: { monthly: 'Monthly', annual: 'Annual' },
    statusNote: (status, reason) =>
      status === 'suspended'
        ? `Suspended${reason ? ' — ' + reason : ''}. Users cannot sign in; data is kept.`
        : status === 'archived'
          ? 'Archived — read-only for 90 days, then exported and scheduled for deletion.'
          : status === 'expired'
            ? 'Subscription expired. Renew to restore full access.'
            : status === 'trial'
              ? 'Trial company — converts to paid when a plan is purchased.'
              : null,
    wsTitle: 'Enter workspace',
    wsSub: 'Choose how you want to access this company.',
    wsModeRead: 'Read-only',
    wsModeReadSub: 'Browse the workspace without making changes. No reason required.',
    wsModeManage: 'Management',
    wsModeManageSub:
      'Make changes on the customer’s behalf. Requires a reason and is time-limited.',
    wsReasonLabel: 'Reason',
    wsReasonPh: 'Why do you need management access? (min. 10 characters)',
    wsDurationLabel: 'Duration',
    wsAck: 'I understand this session is audited and the customer can see it was used.',
    wsCancel: 'Cancel',
    wsEnter: 'Enter workspace',
    wsReasonErr: 'Reason must be at least 10 characters.',
    wsAckErr: 'Please acknowledge before continuing.',
    wsPasswordLabel: 'Confirm with your password',
    confirmSuspendTitle: 'Suspend company',
    confirmSuspendBody: (name) =>
      `${name} will lose access immediately. Billing is managed separately.`,
    confirmReactivateTitle: 'Reactivate company',
    confirmReactivateBody: (name) => `${name} will regain access immediately.`,
    confirmArchiveTitle: 'Archive company',
    confirmArchiveBody: (name) => `${name} will be archived and become read-only.`,
    confirmCancel: 'Cancel',
    confirmGo: 'Confirm',
    toastSuspended: (name) => `${name} was suspended.`,
    toastReactivated: (name) => `${name} was reactivated.`,
    toastArchived: (name) => `${name} was archived.`,
    toastExported: (n) => `Exported ${n} companies to CSV.`,
    comingSoon: 'Coming soon',
  },
  ar: {
    eyebrow: 'الشركات',
    title: 'الشركات',
    addBtn: 'إضافة شركة',
    exportBtn: 'تصدير CSV',
    searchPh: 'ابحث بالاسم أو المعرّف أو بريد المشرف أو المدينة…',
    statusAll: 'كل الحالات',
    typeAll: 'كل الأنواع',
    planAll: 'كل الخطط',
    kpis: { total: 'إجمالي الشركات', active: 'نشطة', trial: 'تجريبية', suspended: 'موقوفة' },
    columns: {
      company: 'الشركة',
      status: 'الحالة',
      plan: 'الخطة',
      type: 'النوع',
      city: 'المدينة',
      users: 'المستخدمون',
      mrr: 'الإيراد الشهري',
      activity: 'آخر نشاط',
      actions: '',
    },
    actions: {
      view: 'عرض',
      enter: 'دخول',
      suspend: 'إيقاف',
      reactivate: 'إعادة تفعيل',
      archive: 'أرشفة',
    },
    pager: (from, to, total) => `عرض ${from}–${to} من ${total}`,
    prev: 'السابق',
    next: 'التالي',
    emptyTitle: 'لا توجد شركات مطابقة للفلاتر',
    emptySub: 'جرّب مسح البحث أو الفلاتر.',
    drawerClose: 'إغلاق',
    drawerFields: {
      id: 'معرّف الشركة',
      type: 'النوع',
      status: 'الحالة',
      plan: 'الخطة',
      city: 'المدينة',
      adminEmail: 'بريد المشرف',
      phone: 'الهاتف',
      website: 'الموقع الإلكتروني',
      users: 'مستخدمو CRM',
      mrr: 'الإيراد الشهري',
      created: 'تاريخ الإنشاء',
      lastActivity: 'آخر نشاط',
      cycle: 'دورة الفوترة',
      owner: 'مالك الحساب',
    },
    cycleNames: { monthly: 'شهري', annual: 'سنوي' },
    statusNote: (status, reason) =>
      status === 'suspended'
        ? `موقوفة${reason ? ' — ' + reason : ''}. لا يمكن للمستخدمين الدخول والبيانات محفوظة.`
        : status === 'archived'
          ? 'مؤرشفة — للقراءة فقط لمدة 90 يومًا ثم يتم التصدير وجدولة الحذف.'
          : status === 'expired'
            ? 'انتهى الاشتراك. جدّد للعودة للوصول الكامل.'
            : status === 'trial'
              ? 'شركة تجريبية — تتحول للدفع عند شراء باقة.'
              : null,
    wsTitle: 'دخول مساحة العمل',
    wsSub: 'اختر طريقة الوصول إلى مساحة عمل هذه الشركة.',
    wsModeRead: 'قراءة فقط',
    wsModeReadSub: 'تصفح مساحة العمل دون إجراء أي تغييرات. لا حاجة لسبب.',
    wsModeManage: 'إدارة',
    wsModeManageSub: 'إجراء تغييرات نيابة عن العميل. يتطلب سببًا وله وقت محدد.',
    wsReasonLabel: 'السبب',
    wsReasonPh: 'لماذا تحتاج إلى صلاحية الإدارة؟ (10 أحرف على الأقل)',
    wsDurationLabel: 'المدة',
    wsAck: 'أدرك أن هذه الجلسة مُسجَّلة وأن العميل يمكنه رؤية أنها استُخدمت.',
    wsCancel: 'إلغاء',
    wsEnter: 'دخول مساحة العمل',
    wsReasonErr: 'يجب ألا يقل السبب عن 10 أحرف.',
    wsAckErr: 'يرجى التأكيد قبل المتابعة.',
    wsPasswordLabel: 'تأكيد بكلمة المرور',
    confirmSuspendTitle: 'إيقاف الشركة',
    confirmSuspendBody: (name) => `ستفقد ${name} الوصول فورًا. اشتراكها لن يتأثر.`,
    confirmReactivateTitle: 'إعادة تفعيل الشركة',
    confirmReactivateBody: (name) => `ستستعيد ${name} الوصول فورًا.`,
    confirmArchiveTitle: 'أرشفة الشركة',
    confirmArchiveBody: (name) => `ستصبح ${name} للقراءة فقط. `,
    confirmCancel: 'إلغاء',
    confirmGo: 'تأكيد',
    toastSuspended: (name) => `تم إيقاف ${name}.`,
    toastReactivated: (name) => `تمت إعادة تفعيل ${name}.`,
    toastArchived: (name) => `تمت أرشفة ${name}.`,
    toastExported: (n) => `تم تصدير ${n} شركة إلى CSV.`,
    comingSoon: 'قريبًا',
  },
};

const PAGE_SIZE = 8;

@Component({
  selector: 'app-companies',
  imports: [FormsModule],
  templateUrl: './companies.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './companies.scss'],
})
export class Companies {
  authDefaults() {
    return this.auth.request('/admin/api/v1/platform-defaults');
  }
  private readonly api = inject(CompaniesApi);
  private readonly subsApi = inject(SubscriptionsApi);
  private readonly featuresApi = inject(FeaturesApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Subscription status per company public ID (needs `sub.manage`; empty otherwise). */
  readonly subs = signal<Record<string, SubStatus>>({});
  /** Usage/limits per company public ID (needs `usage`; empty otherwise). */
  readonly usage = signal<Record<string, Usage>>({});
  private can(p: string) {
    return !!this.auth.user()?.permissions?.includes(p);
  }
  private async loadExtras() {
    if (this.can('sub.manage'))
      try {
        const list = await this.subsApi.subscriptions<{ companyId: string; status: SubStatus }>();
        this.subs.set(Object.fromEntries(list.map((x) => [x.companyId, x.status])));
      } catch {}
    if (this.can('usage'))
      try {
        const rows: Usage[] = await this.featuresApi.usage();
        this.usage.set(Object.fromEntries(rows.map((r) => [r.id, r])));
      } catch {}
  }
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly editing = signal<Company | null>(null);
  readonly formOpen = signal(false);
  draft = {
    nameEn: '',
    nameAr: '',
    slug: '',
    type: 'brokerage',
    city: '',
    adminEmail: '',
    phone: '',
    website: '',
    plan: 'starter',
  };
  constructor() {
    void this.reload().then(() => this.openFromUrl());
    void this.loadExtras();
  }
  /** `/admin/companies?company=MJ-…` opens that company's drawer (used by Onboarding). */
  private openFromUrl() {
    const id = this.router.parseUrl(this.router.url).queryParams['company'];
    const c = id && this.companies().find((x) => x.id === id);
    if (c) this.openView(c);
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.companies.set(await this.api.list<Company>());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load companies');
    } finally {
      this.loading.set(false);
    }
  }
  async openForm(company?: Company) {
    let defaultPlan = 'starter';
    if (!company) {
      try {
        const defaults = await this.authDefaults();
        defaultPlan = defaults.defaultPlan;
      } catch {}
    }
    this.editing.set(company ?? null);
    this.draft = company
      ? {
          nameEn: company.nameEn,
          nameAr: company.nameAr,
          slug: company.slug,
          type: company.type,
          city: company.city,
          adminEmail: company.adminEmail,
          phone: company.phone,
          website: company.website,
          plan: company.plan,
        }
      : {
          nameEn: '',
          nameAr: '',
          slug: '',
          type: 'brokerage',
          city: '',
          adminEmail: '',
          phone: '',
          website: '',
          plan: defaultPlan,
        };
    this.error.set('');
    this.formOpen.set(true);
  }
  async saveCompany() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const current = this.editing();
      let created: Company | undefined;
      if (current)
        await this.api.change(current.id, 'update', { ...this.draft, version: current.version });
      else created = await this.api.create(this.draft);
      this.formOpen.set(false);
      this.viewing.set(null);
      await this.reload();
      if (created)
        this.success.set(
          this.lang() === 'ar'
            ? 'تم إنشاء الشركة وحساب المالك والاشتراك الفعّال بالخطة المختارة. تمت جدولة إرسال بيانات الدخول بالبريد.'
            : 'Company, owner account and active subscription created on the selected plan. Login details are queued for email delivery.',
        );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save company');
    } finally {
      this.saving.set(false);
    }
  }
  readonly success = signal('');
  readonly ownerDelivery = signal<any>(null);
  readonly resendPassword = signal('');
  readonly resendReason = signal('');
  readonly ownerInfo = signal<{
    name: string;
    email: string;
    status: string;
    invitation_expires_at: string | null;
    must_change_password?: boolean;
  } | null>(null);
  readonly ownerLoading = signal(false);
  readonly ownerError = signal('');
  readonly ownerDialog = signal<Company | null>(null);
  readonly ownerName = signal('');
  readonly ownerPassword = signal('');
  readonly ownerReason = signal('');
  readonly ownerLink = signal('');
  readonly ownerExpires = signal('');
  readonly ownerSaving = signal(false);
  private ownerRequest = 0;
  async loadOwner(c: Company) {
    const serial = ++this.ownerRequest;
    this.ownerLoading.set(true);
    this.ownerError.set('');
    this.ownerInfo.set(null);
    this.ownerDelivery.set(null);
    try {
      const r = await this.auth.request(
        '/admin/api/v1/companies/' + encodeURIComponent(c.id) + '/owner',
      );
      if (serial === this.ownerRequest) {
        this.ownerInfo.set(r.owner);
        this.ownerDelivery.set(r.delivery);
      }
    } catch (e) {
      if (serial === this.ownerRequest) this.ownerError.set((e as Error).message);
    } finally {
      if (serial === this.ownerRequest) this.ownerLoading.set(false);
    }
  }
  async openOwner(c: Company) {
    this.ownerDialog.set(c);
    this.ownerName.set('');
    this.ownerPassword.set('');
    this.ownerReason.set('');
    this.ownerLink.set('');
    this.ownerExpires.set('');
    await this.loadOwner(c);
    this.ownerName.set(this.ownerInfo()?.name ?? '');
  }
  closeOwner() {
    this.ownerRequest++;
    this.ownerDialog.set(null);
    this.ownerPassword.set('');
    this.ownerLink.set('');
    this.ownerError.set('');
  }
  deliveryLabel(key: string) {
    const labels: Record<string, [string, string]> = {
      queued: ['Queued', 'في الانتظار'],
      processing: ['Sending', 'جار الإرسال'],
      retry: ['Retry scheduled', 'تمت جدولة إعادة المحاولة'],
      accepted: ['Accepted by mail server', 'قبله خادم البريد'],
      failed: ['Sending failed', 'فشل الإرسال'],
      cancelled: ['Cancelled', 'ملغى'],
      manual: ['Manual invitation', 'دعوة يدوية'],
    };
    return labels[key]?.[this.lang() === 'ar' ? 1 : 0] ?? key;
  }
  async resendWelcome() {
    const c = this.viewing();
    if (!c || this.ownerSaving()) return;
    this.ownerSaving.set(true);
    this.ownerError.set('');
    try {
      await this.auth.request(
        '/admin/api/v1/companies/' + encodeURIComponent(c.id) + '/owner/welcome/resend',
        { version: c.version, password: this.resendPassword(), reason: this.resendReason() },
      );
      const fresh = await this.api.detail(c.id);
      this.viewing.set(fresh);
      await this.loadOwner(fresh);
      this.success.set(
        this.lang() === 'ar'
          ? 'تمت جدولة بريد ترحيبي جديد بكلمة مرور مؤقتة جديدة.'
          : 'A new welcome email with a new temporary password is queued.',
      );
    } catch (e) {
      this.ownerError.set((e as Error).message);
    } finally {
      this.resendPassword.set('');
      this.ownerSaving.set(false);
    }
  }
  async inviteOwner(revoke = false) {
    const c = this.ownerDialog();
    if (!c || this.ownerSaving()) return;
    this.ownerSaving.set(true);
    this.ownerError.set('');
    this.ownerLink.set('');
    try {
      const r = await this.auth.request(
        '/admin/api/v1/companies/' +
          encodeURIComponent(c.id) +
          '/owner/' +
          (revoke ? 'revoke' : 'invite'),
        {
          version: c.version,
          password: this.ownerPassword(),
          reason: this.ownerReason(),
          ...(!revoke ? { name: this.ownerName().trim() } : {}),
        },
      );
      if (r.token) {
        this.ownerLink.set(location.origin + '/activate/company#token=' + r.token);
        this.ownerExpires.set(r.expiresAt);
      }
      await this.reload();
      const fresh = this.companies().find((x) => x.id === c.id);
      if (fresh) {
        this.ownerDialog.set(fresh);
        if (this.viewing()?.id === c.id) this.viewing.set(fresh);
        await this.loadOwner(fresh);
      }
    } catch (e) {
      this.ownerError.set((e as Error).message);
    } finally {
      this.ownerPassword.set('');
      this.ownerSaving.set(false);
    }
  }
  readonly reason = signal('');
  readonly reasonKind = signal<ReasonKind>('payment');
  readonly ack = signal(false);
  readonly tried = signal(false);
  readonly reasonKinds = Object.keys(REASONS) as ReasonKind[];
  reasonLabel(k: ReasonKind) {
    return REASONS[k][this.lang() === 'ar' ? 1 : 0];
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: CompanyStatus[] = [
    'pending',
    'trial',
    'active',
    'suspended',
    'expired',
    'archived',
  ];
  readonly companyTypes: CompanyType[] = ['brokerage', 'developer', 'property_mgmt', 'hybrid'];
  readonly planTypes: Plan[] = ['starter', 'pro', 'business', 'enterprise'];
  readonly wsDurations: Array<30 | 60 | 120> = [30, 60, 120];

  readonly companies = signal<Company[]>([]);

  readonly search = signal('');
  readonly statusFilter = signal<Tab>('all');
  readonly typeFilter = signal<CompanyType | 'all'>('all');
  readonly planFilter = signal<Plan | 'all'>('all');
  readonly sortKey = signal<SortKey>('created');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);

  readonly viewing = signal<Company | null>(null);
  readonly kebabFor = signal<string | null>(null);
  readonly wsCompany = signal<Company | null>(null);
  readonly wsMode = signal<WsMode>('read');
  readonly wsReason = signal('');
  readonly wsDuration = signal<30 | 60 | 120>(30);
  readonly wsAck = signal(false);
  readonly wsError = signal('');
  readonly wsPassword = signal('');
  readonly wsSaving = signal(false);
  readonly confirming = signal<{ company: Company; kind: ConfirmKind } | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly kpis = computed(() => {
    const list = this.companies();
    return {
      total: list.length,
      active: list.filter((c) => c.status === 'active').length,
      trial: list.filter((c) => c.status === 'trial').length,
      suspended: list.filter((c) => c.status === 'suspended').length,
    };
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const plan = this.planFilter();
    return this.companies().filter((c) => {
      if (!this.inTab(c, status)) return false;
      if (type !== 'all' && c.type !== type) return false;
      if (plan !== 'all' && c.plan !== plan) return false;
      if (!q) return true;
      return (
        c.nameEn.toLowerCase().includes(q) ||
        c.nameAr.includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.adminEmail.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
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
        case 'name':
          av = lang === 'ar' ? a.nameAr : a.nameEn;
          bv = lang === 'ar' ? b.nameAr : b.nameEn;
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
        case 'plan':
          av = this.planTypes.indexOf(a.plan);
          bv = this.planTypes.indexOf(b.plan);
          break;
        case 'type':
          av = a.type;
          bv = b.type;
          break;
        case 'city':
          av = a.city;
          bv = b.city;
          break;
        case 'users':
          av = a.users;
          bv = b.users;
          break;
        case 'mrr':
          av = a.mrr;
          bv = b.mrr;
          break;
        case 'activity':
          av = a.lastActivity;
          bv = b.lastActivity;
          break;
        case 'created':
          av = a.createdAt;
          bv = b.createdAt;
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

  typeLabel(t: CompanyType): string {
    return TYPE_LABEL[this.lang()][t];
  }

  planLabel(p: Plan): string {
    return PLAN_LABEL[this.lang()][p] ?? p;
  }

  planDot(p: Plan): string {
    return PLAN_DOT[p] ?? '#111113';
  }

  statusLabel(s: CompanyStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: CompanyStatus): { bg: string; fg: string; dot: string } {
    return STATUS_COLOR[s];
  }

  companyName(c: Company): string {
    return this.lang() === 'ar' ? c.nameAr : c.nameEn;
  }

  private logo(c: Company): [string, string] {
    const code = c.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return LOGO[code % LOGO.length];
  }
  logoBg(c: Company): string {
    return this.logo(c)[0];
  }
  logoFg(c: Company): string {
    return this.logo(c)[1];
  }

  logoInitials(c: Company): string {
    return c.nameEn
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  cityLabel(city: string): string {
    return this.lang() === 'ar' ? (CITY_AR[city] ?? city) : city;
  }

  formatMrr(v: number): string {
    if (v === 0) return '—';
    return this.lang() === 'ar'
      ? `${v.toLocaleString('en-US')} ج.م`
      : `EGP ${v.toLocaleString('en-US')}`;
  }

  setSearch(v: string): void {
    this.search.set(v);
    this.page.set(1);
  }

  setStatusFilter(v: Tab): void {
    this.statusFilter.set(v);
    this.page.set(1);
  }

  setTypeFilter(v: CompanyType | 'all'): void {
    this.typeFilter.set(v);
    this.page.set(1);
  }

  setPlanFilter(v: Plan | 'all'): void {
    this.planFilter.set(v);
    this.page.set(1);
  }

  inTab(c: Company, t: Tab) {
    return t === 'all' || (t === 'pastdue' ? this.subs()[c.id] === 'past_due' : c.status === t);
  }
  readonly tabs = computed(() => {
    const ar = this.lang() === 'ar';
    const list: Array<[Tab, string, string]> = [
      ['all', 'All', 'الكل'],
      ['active', 'Active', 'نشطة'],
      ['trial', 'Trial', 'تجريبية'],
      ['pending', 'Pending', 'قيد الانتظار'],
      ['pastdue', 'Past due', 'متأخرة السداد'],
      ['suspended', 'Suspended', 'موقوفة'],
      ['expired', 'Expired', 'منتهية'],
      ['archived', 'Archived', 'مؤرشفة'],
    ];
    return list
      .filter(([k]) => k !== 'pastdue' || this.can('sub.manage'))
      .map(([k, en, a]) => ({
        k,
        label: ar ? a : en,
        n: this.companies().filter((c) => this.inTab(c, k)).length,
      }));
  });
  readonly totalUsers = computed(() => this.companies().reduce((n, c) => n + (c.users || 0), 0));
  readonly hasFilters = computed(
    () =>
      !!this.search().trim() ||
      this.statusFilter() !== 'all' ||
      this.typeFilter() !== 'all' ||
      this.planFilter() !== 'all',
  );
  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
    this.typeFilter.set('all');
    this.planFilter.set('all');
    this.page.set(1);
  }
  subStatus(c: Company): { label: string; fg: string } | null {
    const st = this.subs()[c.id];
    return st ? { label: SUB_LABEL[st][this.lang() === 'ar' ? 1 : 0], fg: SUB_COLOR[st] } : null;
  }
  /** Seat usage bar for the Users column; null when no limit is known. */
  seats(c: Company): { limit: string; w: string; color: string } | null {
    const u = this.usage()[c.id]?.users;
    if (!u) return null;
    if (u.limit === null) return { limit: '∞', w: '12%', color: '#111113' };
    const p = u.limit ? c.users / u.limit : 1;
    return {
      limit: String(u.limit),
      w: Math.min(100, p * 100).toFixed(0) + '%',
      color: p >= 0.95 ? '#E2553B' : p >= 0.8 ? '#D99A28' : '#111113',
    };
  }
  usageBars(c: Company) {
    const u = this.usage()[c.id];
    if (!u) return [];
    const ar = this.lang() === 'ar';
    const rows: Array<[string, Resource, string]> = [
      [ar ? 'المستخدمون' : 'Users', u.users, ''],
      [ar ? 'الوحدات' : 'Listings', u.listings, ''],
      [ar ? 'التخزين' : 'Storage', u.storage, ' GB'],
    ];
    return rows.map(([label, r, unit]) => {
      const measured = r.measured && r.used !== null;
      const p = measured && r.limit ? r.used! / r.limit : 0;
      return {
        label,
        value: measured
          ? r.used!.toLocaleString('en-US') +
            unit +
            ' / ' +
            (r.limit === null ? '∞' : r.limit.toLocaleString('en-US') + unit)
          : ar
            ? 'غير مقاس'
            : 'Not measured',
        w: measured ? (r.limit === null ? 12 : Math.min(100, p * 100)).toFixed(0) + '%' : '0%',
        color: p >= 0.9 ? '#E2553B' : p >= 0.8 ? '#D99A28' : '#111113',
        fg: p >= 0.9 ? '#A23624' : '#111113',
      };
    });
  }
  date(v: string): string {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  goCreate(): void {
    void this.router.navigateByUrl('/admin/onboarding/new');
  }
  goSubscriptions(): void {
    void this.router.navigateByUrl('/admin/subscriptions');
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

  openView(c: Company): void {
    this.viewing.set(c);
    void this.loadOwner(c);
    this.kebabFor.set(null);
  }

  closeView(): void {
    this.ownerRequest++;
    this.viewing.set(null);
  }

  toggleKebab(id: string): void {
    this.kebabFor.set(this.kebabFor() === id ? null : id);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  rowActions(c: Company): ConfirmKind[] {
    if (!this.auth.user()?.permissions.includes('co.suspend')) return [];
    if (c.status === 'archived') return [];
    if (c.status === 'suspended') return ['reactivate', 'archive'];
    return ['suspend', 'archive'];
  }

  openWsDialog(c: Company): void {
    this.wsCompany.set(c);
    this.wsMode.set('read');
    this.wsReason.set('');
    this.wsDuration.set(30);
    this.wsAck.set(false);
    this.wsError.set('');
    this.wsPassword.set('');
    this.kebabFor.set(null);
  }

  closeWsDialog(): void {
    this.wsCompany.set(null);
    this.wsPassword.set('');
  }

  async submitWsDialog(): Promise<void> {
    const c = this.wsCompany();
    if (!c || this.wsSaving()) return;
    if (this.wsMode() === 'manage') {
      if (this.wsReason().trim().length < 10) {
        this.wsError.set(this.L().wsReasonErr);
        return;
      }
      if (!this.wsAck()) {
        this.wsError.set(this.L().wsAckErr);
        return;
      }
      if (!this.wsPassword()) {
        this.wsError.set(this.L().wsPasswordLabel);
        return;
      }
    }
    this.wsError.set('');
    this.wsSaving.set(true);
    try {
      await this.auth.request(
        '/admin/api/v1/companies/' + encodeURIComponent(c.id) + '/workspace-session',
        this.wsMode() === 'manage'
          ? {
              mode: 'manage',
              reason: this.wsReason().trim(),
              durationMinutes: this.wsDuration(),
              password: this.wsPassword(),
            }
          : { mode: 'read' },
      );
      this.closeWsDialog();
      await this.router.navigateByUrl('/company/dashboard');
    } catch (e) {
      this.wsError.set((e as Error).message);
    } finally {
      this.wsPassword.set('');
      this.wsSaving.set(false);
    }
  }

  askConfirm(c: Company, kind: ConfirmKind): void {
    this.confirming.set({ company: c, kind });
    this.reason.set('');
    this.reasonKind.set('payment');
    this.ack.set(false);
    this.tried.set(false);
    this.kebabFor.set(null);
  }
  confirmReady(): boolean {
    const cf = this.confirming();
    return this.reason().trim().length >= 10 && (cf?.kind === 'reactivate' || this.ack());
  }

  cancelConfirm(): void {
    this.confirming.set(null);
  }

  async performConfirm(): Promise<void> {
    const target = this.confirming();
    if (!target || this.saving()) return;
    if (!this.confirmReady()) {
      this.tried.set(true);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    // The API takes one free-text reason; the category is prefixed until it has its own field.
    const note = this.reason().trim();
    const reason =
      target.kind === 'reactivate' ? note : `[${REASONS[this.reasonKind()][0]}] ${note}`;
    try {
      await this.api.change(target.company.id, 'status', {
        action: target.kind,
        version: target.company.version,
        reason: reason.slice(0, 500),
      });
      const name = this.companyName(target.company);
      this.confirming.set(null);
      this.reason.set('');
      this.viewing.set(null);
      await this.reload();
      this.showToast(
        target.kind === 'suspend'
          ? this.L().toastSuspended(name)
          : target.kind === 'reactivate'
            ? this.L().toastReactivated(name)
            : this.L().toastArchived(name),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to change status');
    } finally {
      this.saving.set(false);
    }
  }

  exportCsv(): void {
    const rows = this.sorted();
    const header = [
      'ID',
      'Name',
      'Type',
      'City',
      'Status',
      'Plan',
      'Users',
      'MRR (EGP)',
      'Admin email',
      'Created',
      'Last activity',
    ];
    const lines = rows.map((c) =>
      [
        c.id,
        c.nameEn,
        c.type,
        c.city,
        c.status,
        c.plan,
        c.users,
        c.mrr,
        c.adminEmail,
        c.createdAt,
        c.lastActivity,
      ]
        .map(
          (v) =>
            `"${String(v)
              .replace(/^[=+@-]/, "'$&")
              .replace(/"/g, '""')}"`,
        )
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mujez-companies.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(this.L().toastExported(rows.length));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
