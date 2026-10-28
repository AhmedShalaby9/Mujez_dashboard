import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type CompanyType = 'brokerage' | 'developer' | 'property_mgmt' | 'hybrid';
type CompanyStatus = 'pending' | 'trial' | 'active' | 'suspended' | 'expired' | 'archived';
type Plan = 'starter' | 'pro' | 'business' | 'enterprise';
type SortKey = 'name' | 'status' | 'plan' | 'type' | 'city' | 'users' | 'mrr' | 'activity';
type WsMode = 'read' | 'manage';
type ConfirmKind = 'suspend' | 'reactivate' | 'archive';

interface Company {
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

const SEED: Company[] = [
  { id: 'MJ-1001', nameEn: 'Al Qahira Developments', nameAr: 'القاهرة للتطوير', type: 'developer', city: 'Cairo', adminEmail: 'admin@alqahira.mujez.io', phone: '+20 10 1234 5001', website: 'alqahira.mujez.com', plan: 'business', status: 'active', users: 142, mrr: 18400, createdAt: 'Feb 3, 2025', lastActivity: '12m ago' },
  { id: 'MJ-1002', nameEn: 'Nile View Realty', nameAr: 'نايل فيو العقارية', type: 'brokerage', city: 'Giza', adminEmail: 'admin@nileview.mujez.io', phone: '+20 10 1234 5002', website: 'nileview.mujez.com', plan: 'pro', status: 'trial', users: 28, mrr: 0, createdAt: 'Sep 18, 2026', lastActivity: '1h ago' },
  { id: 'MJ-1003', nameEn: 'Deira Properties', nameAr: 'ديرة العقارية', type: 'property_mgmt', city: 'New Cairo', adminEmail: 'admin@deira.mujez.io', phone: '+20 10 1234 5003', website: 'deira.mujez.com', plan: 'pro', status: 'active', users: 61, mrr: 7200, createdAt: 'Nov 22, 2024', lastActivity: '3h ago' },
  { id: 'MJ-1004', nameEn: 'Coastal Homes', nameAr: 'كوستال هومز', type: 'brokerage', city: 'Hurghada', adminEmail: 'admin@coastalhomes.mujez.io', phone: '+20 10 1234 5004', website: 'coastalhomes.mujez.com', plan: 'starter', status: 'active', users: 14, mrr: 2600, createdAt: 'Oct 2, 2026', lastActivity: 'Yesterday' },
  { id: 'MJ-1005', nameEn: 'Smart Spaces', nameAr: 'سمارت سبيسز', type: 'hybrid', city: 'Alexandria', adminEmail: 'admin@smartspaces.mujez.io', phone: '+20 10 1234 5005', website: 'smartspaces.mujez.com', plan: 'business', status: 'active', users: 97, mrr: 15800, createdAt: 'Jan 11, 2025', lastActivity: '6h ago' },
  { id: 'MJ-1006', nameEn: 'Zamalek Realty Group', nameAr: 'مجموعة الزمالك العقارية', type: 'brokerage', city: 'Cairo', adminEmail: 'admin@zamalekrealty.mujez.io', phone: '+20 10 1234 5006', website: 'zamalekrealty.mujez.com', plan: 'pro', status: 'suspended', users: 33, mrr: 5400, createdAt: 'May 7, 2025', lastActivity: '4d ago' },
  { id: 'MJ-1007', nameEn: 'October Living', nameAr: 'أكتوبر ليفينج', type: 'developer', city: '6th of October', adminEmail: 'admin@octoberliving.mujez.io', phone: '+20 10 1234 5007', website: 'octoberliving.mujez.com', plan: 'enterprise', status: 'active', users: 412, mrr: 54200, createdAt: 'Mar 29, 2024', lastActivity: '38m ago' },
  { id: 'MJ-1008', nameEn: 'Marina Bay Properties', nameAr: 'مارينا باي العقارية', type: 'brokerage', city: 'North Coast', adminEmail: 'admin@marinabay.mujez.io', phone: '+20 10 1234 5008', website: 'marinabay.mujez.com', plan: 'starter', status: 'trial', users: 9, mrr: 0, createdAt: 'Oct 12, 2026', lastActivity: '2h ago' },
  { id: 'MJ-1009', nameEn: 'Golden Sands Developers', nameAr: 'الرمال الذهبية للتطوير', type: 'developer', city: 'Sheikh Zayed', adminEmail: 'admin@goldensands.mujez.io', phone: '+20 10 1234 5009', website: 'goldensands.mujez.com', plan: 'business', status: 'active', users: 128, mrr: 19600, createdAt: 'Jun 15, 2025', lastActivity: '1d ago' },
  { id: 'MJ-1010', nameEn: 'Urban Nest Brokerage', nameAr: 'أوربان نِست', type: 'brokerage', city: 'New Cairo', adminEmail: 'admin@urbannest.mujez.io', phone: '+20 10 1234 5010', website: 'urbannest.mujez.com', plan: 'starter', status: 'pending', users: 1, mrr: 0, createdAt: 'Oct 25, 2026', lastActivity: 'Just now' },
  { id: 'MJ-1011', nameEn: 'New Capital Homes', nameAr: 'نيو كابيتال هومز', type: 'developer', city: 'New Capital', adminEmail: 'admin@newcapitalhomes.mujez.io', phone: '+20 10 1234 5011', website: 'newcapitalhomes.mujez.com', plan: 'enterprise', status: 'active', users: 356, mrr: 61500, createdAt: 'Aug 4, 2024', lastActivity: '15m ago' },
  { id: 'MJ-1012', nameEn: 'Heliopolis Estates', nameAr: 'مصر الجديدة العقارية', type: 'property_mgmt', city: 'Heliopolis', adminEmail: 'admin@heliopolisestates.mujez.io', phone: '+20 10 1234 5012', website: 'heliopolisestates.mujez.com', plan: 'pro', status: 'active', users: 54, mrr: 6800, createdAt: 'Dec 1, 2025', lastActivity: '5h ago' },
  { id: 'MJ-1013', nameEn: 'Maadi Properties Group', nameAr: 'مجموعة المعادي العقارية', type: 'brokerage', city: 'Maadi', adminEmail: 'admin@maadigroup.mujez.io', phone: '+20 10 1234 5013', website: 'maadigroup.mujez.com', plan: 'starter', status: 'expired', users: 7, mrr: 0, createdAt: 'Jul 9, 2025', lastActivity: '21d ago' },
  { id: 'MJ-1014', nameEn: 'Nasr City Realty', nameAr: 'مدينة نصر العقارية', type: 'brokerage', city: 'Nasr City', adminEmail: 'admin@nasrcityrealty.mujez.io', phone: '+20 10 1234 5014', website: 'nasrcityrealty.mujez.com', plan: 'starter', status: 'active', users: 19, mrr: 3100, createdAt: 'Apr 17, 2026', lastActivity: '9h ago' },
  { id: 'MJ-1015', nameEn: 'Smart Homes Egypt', nameAr: 'سمارت هومز إيجيبت', type: 'hybrid', city: 'Giza', adminEmail: 'admin@smarthomes-eg.mujez.io', phone: '+20 10 1234 5015', website: 'smarthomes-eg.mujez.com', plan: 'pro', status: 'active', users: 71, mrr: 8900, createdAt: 'Feb 28, 2025', lastActivity: '2d ago' },
  { id: 'MJ-1016', nameEn: 'Rehab Living Co.', nameAr: 'الرحاب ليفينج', type: 'property_mgmt', city: 'Al Rehab', adminEmail: 'admin@rehabliving.mujez.io', phone: '+20 10 1234 5016', website: 'rehabliving.mujez.com', plan: 'pro', status: 'trial', users: 22, mrr: 0, createdAt: 'Oct 8, 2026', lastActivity: '7h ago' },
  { id: 'MJ-1017', nameEn: 'Capital Gate Developers', nameAr: 'كابيتال جيت للتطوير', type: 'developer', city: 'New Capital', adminEmail: 'admin@capitalgate.mujez.io', phone: '+20 10 1234 5017', website: 'capitalgate.mujez.com', plan: 'business', status: 'active', users: 166, mrr: 23700, createdAt: 'Jan 30, 2025', lastActivity: '48m ago' },
  { id: 'MJ-1018', nameEn: 'Blue Lagoon Realty', nameAr: 'بلو لاجون العقارية', type: 'brokerage', city: 'El Gouna', adminEmail: 'admin@bluelagoon.mujez.io', phone: '+20 10 1234 5018', website: 'bluelagoon.mujez.com', plan: 'starter', status: 'active', users: 11, mrr: 2100, createdAt: 'Jun 3, 2026', lastActivity: '3d ago' },
  { id: 'MJ-1019', nameEn: 'Downtown Properties', nameAr: 'داون تاون العقارية', type: 'brokerage', city: 'Cairo', adminEmail: 'admin@downtownprop.mujez.io', phone: '+20 10 1234 5019', website: 'downtownprop.mujez.com', plan: 'starter', status: 'archived', users: 4, mrr: 0, createdAt: 'Mar 14, 2024', lastActivity: '112d ago' },
  { id: 'MJ-1020', nameEn: 'Green Valley Homes', nameAr: 'جرين فالي هومز', type: 'developer', city: '6th of October', adminEmail: 'admin@greenvalley.mujez.io', phone: '+20 10 1234 5020', website: 'greenvalley.mujez.com', plan: 'pro', status: 'active', users: 48, mrr: 6200, createdAt: 'Sep 2, 2025', lastActivity: '1d ago' },
  { id: 'MJ-1021', nameEn: 'Horizon Estates', nameAr: 'هورايزون العقارية', type: 'brokerage', city: 'Alexandria', adminEmail: 'admin@horizonestates.mujez.io', phone: '+20 10 1234 5021', website: 'horizonestates.mujez.com', plan: 'starter', status: 'active', users: 16, mrr: 2400, createdAt: 'Jul 21, 2026', lastActivity: '14h ago' },
  { id: 'MJ-1022', nameEn: 'Palm Hills Partners', nameAr: 'بالم هيلز بارتنرز', type: 'developer', city: 'New Cairo', adminEmail: 'admin@palmhillspartners.mujez.io', phone: '+20 10 1234 5022', website: 'palmhillspartners.mujez.com', plan: 'business', status: 'suspended', users: 89, mrr: 14300, createdAt: 'Oct 30, 2024', lastActivity: '9d ago' },
  { id: 'MJ-1023', nameEn: 'Metro Realty Group', nameAr: 'مترو العقارية', type: 'brokerage', city: 'Giza', adminEmail: 'admin@metrorealty.mujez.io', phone: '+20 10 1234 5023', website: 'metrorealty.mujez.com', plan: 'pro', status: 'active', users: 39, mrr: 5900, createdAt: 'May 19, 2025', lastActivity: '22h ago' },
  { id: 'MJ-1024', nameEn: 'Sunrise Properties', nameAr: 'صن رايز العقارية', type: 'brokerage', city: 'Hurghada', adminEmail: 'admin@sunriseprop.mujez.io', phone: '+20 10 1234 5024', website: 'sunriseprop.mujez.com', plan: 'starter', status: 'trial', users: 6, mrr: 0, createdAt: 'Oct 20, 2026', lastActivity: '30m ago' },
];

const TYPE_LABEL: Record<Lang, Record<CompanyType, string>> = {
  en: { brokerage: 'Brokerage', developer: 'Developer', property_mgmt: 'Property Mgmt', hybrid: 'Hybrid' },
  ar: { brokerage: 'وساطة عقارية', developer: 'مطوّر عقاري', property_mgmt: 'إدارة عقارات', hybrid: 'مختلط' },
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
  en: { pending: 'Pending', trial: 'Trial', active: 'Active', suspended: 'Suspended', expired: 'Expired', archived: 'Archived' },
  ar: { pending: 'قيد الانتظار', trial: 'تجريبية', active: 'نشطة', suspended: 'موقوفة', expired: 'منتهية', archived: 'مؤرشفة' },
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
  columns: { company: string; status: string; plan: string; type: string; city: string; users: string; mrr: string; activity: string; actions: string };
  actions: { view: string; enter: string; suspend: string; reactivate: string; archive: string };
  pager: (from: number, to: number, total: number) => string;
  prev: string;
  next: string;
  emptyTitle: string;
  emptySub: string;
  drawerClose: string;
  drawerFields: { id: string; type: string; status: string; plan: string; city: string; adminEmail: string; phone: string; website: string; users: string; mrr: string; created: string; lastActivity: string };
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
    columns: { company: 'Company', status: 'Status', plan: 'Plan', type: 'Type', city: 'City', users: 'Users', mrr: 'MRR', activity: 'Last activity', actions: '' },
    actions: { view: 'View', enter: 'Enter', suspend: 'Suspend', reactivate: 'Reactivate', archive: 'Archive' },
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
    wsModeManageSub: 'Make changes on the customer’s behalf. Requires a reason and is time-limited.',
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
    confirmSuspendBody: (name) => `${name} will lose access immediately. Their subscription is not affected.`,
    confirmReactivateTitle: 'Reactivate company',
    confirmReactivateBody: (name) => `${name} will regain access immediately.`,
    confirmArchiveTitle: 'Archive company',
    confirmArchiveBody: (name) => `${name} becomes read-only. This can be reversed within 90 days.`,
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
    columns: { company: 'الشركة', status: 'الحالة', plan: 'الخطة', type: 'النوع', city: 'المدينة', users: 'المستخدمون', mrr: 'الإيراد الشهري', activity: 'آخر نشاط', actions: '' },
    actions: { view: 'عرض', enter: 'دخول', suspend: 'إيقاف', reactivate: 'إعادة تفعيل', archive: 'أرشفة' },
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
    confirmArchiveBody: (name) => `ستصبح ${name} للقراءة فقط. يمكن التراجع خلال 90 يومًا.`,
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
  templateUrl: './companies.html',
  styleUrl: './companies.scss',
})
export class Companies {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly statusTypes: CompanyStatus[] = ['pending', 'trial', 'active', 'suspended', 'expired', 'archived'];
  readonly companyTypes: CompanyType[] = ['brokerage', 'developer', 'property_mgmt', 'hybrid'];
  readonly planTypes: Plan[] = ['starter', 'pro', 'business', 'enterprise'];
  readonly wsDurations: Array<30 | 60 | 120> = [30, 60, 120];

  private readonly companies = signal<Company[]>(SEED);

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
    return PLAN_LABEL[this.lang()][p];
  }

  planDot(p: Plan): string {
    return PLAN_DOT[p];
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
    return this.lang() === 'ar' ? CITY_AR[city] ?? city : city;
  }

  formatMrr(v: number): string {
    if (v === 0) return '—';
    return this.lang() === 'ar' ? `${v.toLocaleString('en-US')} ج.م` : `EGP ${v.toLocaleString('en-US')}`;
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

  rowActions(c: Company): ConfirmKind[] {
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

  performConfirm(): void {
    const target = this.confirming();
    if (!target) return;
    const nextStatus: CompanyStatus =
      target.kind === 'suspend' ? 'suspended' : target.kind === 'reactivate' ? 'active' : 'archived';
    this.companies.update((list) =>
      list.map((c) => (c.id === target.company.id ? { ...c, status: nextStatus } : c)),
    );
    const name = this.companyName(target.company);
    const msg =
      target.kind === 'suspend'
        ? this.L().toastSuspended(name)
        : target.kind === 'reactivate'
          ? this.L().toastReactivated(name)
          : this.L().toastArchived(name);
    this.confirming.set(null);
    this.showToast(msg);
  }

  exportCsv(): void {
    const rows = this.sorted();
    const header = ['ID', 'Name', 'Type', 'City', 'Status', 'Plan', 'Users', 'MRR (EGP)', 'Admin email', 'Created', 'Last activity'];
    const lines = rows.map((c) =>
      [c.id, c.nameEn, c.type, c.city, c.status, c.plan, c.users, c.mrr, c.adminEmail, c.createdAt, c.lastActivity]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
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
