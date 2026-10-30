import { FormsModule } from '@angular/forms';
import { CompaniesApi } from '../../../companies-api.service';
import { AuthService } from '../../../auth.service';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type CompanyType = 'brokerage' | 'developer' | 'property_mgmt' | 'hybrid';
type CompanyStatus = 'pending' | 'trial' | 'active' | 'suspended' | 'expired' | 'archived';
type Plan = 'starter' | 'pro' | 'business' | 'enterprise';
type SortKey = 'name' | 'status' | 'plan' | 'type' | 'city' | 'users' | 'mrr' | 'activity';
type WsMode = 'read' | 'manage';
type ConfirmKind = 'suspend' | 'reactivate' | 'archive';

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
  starter: '#C3C5D6',
  pro: '#3D4FD6',
  business: '#7E89E6',
  enterprise: '#F5B841',
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

const STATUS_COLOR: Record<CompanyStatus, { bg: string; fg: string }> = {
  pending: { bg: '#EEEDE8', fg: '#45443F' },
  trial: { bg: '#E6E8FB', fg: '#2B37A0' },
  active: { bg: '#DCEEE1', fg: '#2F7A4F' },
  suspended: { bg: '#F8E1DC', fg: '#9A3422' },
  expired: { bg: '#F6E6CB', fg: '#9A6B1E' },
  archived: { bg: '#EEEDE8', fg: '#6B6A65' },
};

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
  };
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
  wsToast: string;
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
    },
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
    wsToast: 'Static design preview — entering a workspace isn’t wired to a tenant app.',
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
    },
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
    wsToast: 'معاينة تصميم ثابتة — الدخول إلى مساحة العمل غير متصل بتطبيق المستأجر.',
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

const PAGE_SIZE = 10;

@Component({
  selector: 'app-companies',
  imports: [FormsModule],
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class Companies {
  authDefaults() {
    return this.auth.request('/admin/api/v1/platform-defaults');
  }
  private readonly api = inject(CompaniesApi);
  readonly auth = inject(AuthService);
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
    void this.reload();
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
        defaultPlan = (await this.authDefaults()).defaultPlan;
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
            ? 'تم إنشاء الشركة وحساب المالك. تمت جدولة إرسال بيانات الدخول بالبريد.'
            : 'Company and owner account created. Login details are queued for email delivery.',
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

  private readonly companies = signal<Company[]>([]);

  readonly search = signal('');
  readonly statusFilter = signal<CompanyStatus | 'all'>('all');
  readonly typeFilter = signal<CompanyType | 'all'>('all');
  readonly planFilter = signal<Plan | 'all'>('all');
  readonly sortKey = signal<SortKey>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);

  readonly viewing = signal<Company | null>(null);
  readonly kebabFor = signal<string | null>(null);
  readonly wsCompany = signal<Company | null>(null);
  readonly wsMode = signal<WsMode>('read');
  readonly wsReason = signal('');
  readonly wsDuration = signal<30 | 60 | 120>(30);
  readonly wsAck = signal(false);
  readonly wsError = signal('');
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
      if (status !== 'all' && c.status !== status) return false;
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
    return PLAN_DOT[p] ?? '#3D4FD6';
  }

  statusLabel(s: CompanyStatus): string {
    return STATUS_LABEL[this.lang()][s];
  }

  statusColor(s: CompanyStatus): { bg: string; fg: string } {
    return STATUS_COLOR[s];
  }

  companyName(c: Company): string {
    return this.lang() === 'ar' ? c.nameAr : c.nameEn;
  }

  private readonly logoPalette = ['#3D4FD6', '#7E89E6', '#16182A', '#9A6B1E', '#2F7A4F', '#B4442F'];

  logoBg(c: Company): string {
    const code = c.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return this.logoPalette[code % this.logoPalette.length];
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

  setStatusFilter(v: CompanyStatus | 'all'): void {
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

  filterByKpiStatus(status: CompanyStatus | 'all'): void {
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
    this.kebabFor.set(null);
  }

  closeWsDialog(): void {
    this.wsCompany.set(null);
  }

  submitWsDialog(): void {
    if (this.wsMode() === 'manage') {
      if (this.wsReason().trim().length < 10) {
        this.wsError.set(this.L().wsReasonErr);
        return;
      }
      if (!this.wsAck()) {
        this.wsError.set(this.L().wsAckErr);
        return;
      }
    }
    this.closeWsDialog();
    this.showToast(this.L().wsToast);
  }

  askConfirm(c: Company, kind: ConfirmKind): void {
    this.confirming.set({ company: c, kind });
    this.kebabFor.set(null);
  }

  cancelConfirm(): void {
    this.confirming.set(null);
  }

  async performConfirm(): Promise<void> {
    const target = this.confirming();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.change(target.company.id, 'status', {
        action: target.kind,
        version: target.company.version,
        reason: this.reason(),
      });
      this.confirming.set(null);
      this.reason.set('');
      this.viewing.set(null);
      await this.reload();
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
