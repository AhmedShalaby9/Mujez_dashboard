import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Category = 'comm' | 'mkt' | 're' | 'pay' | 'infra';
type Status = 'healthy' | 'degraded' | 'down' | 'disabled';

interface SyncEntry {
  time: string;
  messageEn: string;
  messageAr: string;
}

interface Integration {
  key: string;
  nameEn: string;
  nameAr: string;
  category: Category;
  status: Status;
  previousStatus: Status;
  companies: number;
  lastSync: string;
  errors24h: number;
  webhookSlug: string;
  log: SyncEntry[];
}

const SEED: Integration[] = [
  {
    key: 'whatsapp', nameEn: 'WhatsApp Business Platform', nameAr: 'منصة واتساب بيزنس', category: 'comm', status: 'healthy', previousStatus: 'healthy',
    companies: 15, lastSync: '2m ago', errors24h: 0, webhookSlug: 'whatsapp',
    log: [
      { time: 'Oct 28 10:40', messageEn: 'OK · 412 events', messageAr: 'سليم · 412 حدثًا' },
      { time: 'Oct 28 10:20', messageEn: 'OK · 388 events', messageAr: 'سليم · 388 حدثًا' },
      { time: 'Oct 28 10:00', messageEn: 'OK · 401 events', messageAr: 'سليم · 401 حدثًا' },
    ],
  },
  {
    key: 'twilio', nameEn: 'Twilio SMS', nameAr: 'تويليو SMS', category: 'comm', status: 'healthy', previousStatus: 'healthy',
    companies: 9, lastSync: '5m ago', errors24h: 0, webhookSlug: 'twilio',
    log: [
      { time: 'Oct 28 10:35', messageEn: 'OK · 96 events', messageAr: 'سليم · 96 حدثًا' },
      { time: 'Oct 28 09:35', messageEn: 'OK · 102 events', messageAr: 'سليم · 102 حدثًا' },
      { time: 'Oct 28 08:35', messageEn: 'OK · 88 events', messageAr: 'سليم · 88 حدثًا' },
    ],
  },
  {
    key: 'meta', nameEn: 'Meta Lead Ads', nameAr: 'إعلانات ميتا للعملاء', category: 'mkt', status: 'degraded', previousStatus: 'degraded',
    companies: 12, lastSync: '18m ago', errors24h: 6, webhookSlug: 'meta-lead-ads',
    log: [
      { time: 'Oct 28 10:22', messageEn: '6 events failed · HTTP 502 from provider', messageAr: '6 أحداث فشلت · 502' },
      { time: 'Oct 28 09:52', messageEn: 'OK · 54 events', messageAr: 'سليم · 54 حدثًا' },
      { time: 'Oct 28 09:22', messageEn: 'OK · 61 events', messageAr: 'سليم · 61 حدثًا' },
    ],
  },
  {
    key: 'google-ads', nameEn: 'Google Ads', nameAr: 'إعلانات جوجل', category: 'mkt', status: 'healthy', previousStatus: 'healthy',
    companies: 8, lastSync: '3m ago', errors24h: 0, webhookSlug: 'google-ads',
    log: [
      { time: 'Oct 28 10:37', messageEn: 'OK · 34 events', messageAr: 'سليم · 34 حدثًا' },
      { time: 'Oct 28 09:37', messageEn: 'OK · 29 events', messageAr: 'سليم · 29 حدثًا' },
      { time: 'Oct 28 08:37', messageEn: 'OK · 31 events', messageAr: 'سليم · 31 حدثًا' },
    ],
  },
  {
    key: 'property-finder', nameEn: 'Property Finder', nameAr: 'بروبرتي فايندر', category: 're', status: 'down', previousStatus: 'down',
    companies: 11, lastSync: '2h ago', errors24h: 23, webhookSlug: 'property-finder',
    log: [
      { time: 'Oct 28 08:40', messageEn: 'Signature verification failed', messageAr: 'فشل التحقق من التوقيع' },
      { time: 'Oct 28 06:40', messageEn: '23 events failed · HTTP 502 from provider', messageAr: '23 حدثًا فشل · 502' },
      { time: 'Oct 28 04:40', messageEn: 'OK · 140 events', messageAr: 'سليم · 140 حدثًا' },
    ],
  },
  {
    key: 'dev-feed', nameEn: 'Developer Inventory Feed', nameAr: 'تغذية مخزون المطورين', category: 're', status: 'healthy', previousStatus: 'healthy',
    companies: 4, lastSync: '14m ago', errors24h: 0, webhookSlug: 'developer-feed',
    log: [
      { time: 'Oct 28 10:26', messageEn: 'OK · 210 events', messageAr: 'سليم · 210 حدثًا' },
      { time: 'Oct 28 08:26', messageEn: 'OK · 198 events', messageAr: 'سليم · 198 حدثًا' },
      { time: 'Oct 28 06:26', messageEn: 'OK · 205 events', messageAr: 'سليم · 205 حدثًا' },
    ],
  },
  {
    key: 'paymob', nameEn: 'Paymob', nameAr: 'بايموب', category: 'pay', status: 'healthy', previousStatus: 'healthy',
    companies: 18, lastSync: '1m ago', errors24h: 0, webhookSlug: 'paymob',
    log: [
      { time: 'Oct 28 10:39', messageEn: 'OK · 58 events', messageAr: 'سليم · 58 حدثًا' },
      { time: 'Oct 28 09:39', messageEn: 'OK · 61 events', messageAr: 'سليم · 61 حدثًا' },
      { time: 'Oct 28 08:39', messageEn: 'OK · 49 events', messageAr: 'سليم · 49 حدثًا' },
    ],
  },
  {
    key: 'instapay', nameEn: 'InstaPay Reconciliation', nameAr: 'تسوية إنستاباي', category: 'pay', status: 'healthy', previousStatus: 'healthy',
    companies: 18, lastSync: '6h ago', errors24h: 0, webhookSlug: 'instapay',
    log: [
      { time: 'Oct 28 05:00', messageEn: 'OK · daily file reconciled, 112 rows', messageAr: 'سليم · 112 صفًا' },
      { time: 'Oct 27 05:00', messageEn: 'OK · daily file reconciled, 98 rows', messageAr: 'سليم · 98 صفًا' },
      { time: 'Oct 26 05:00', messageEn: 'OK · daily file reconciled, 104 rows', messageAr: 'سليم · 104 صفًا' },
    ],
  },
  {
    key: 's3', nameEn: 'AWS S3 Storage', nameAr: 'تخزين AWS S3', category: 'infra', status: 'healthy', previousStatus: 'healthy',
    companies: 24, lastSync: '1m ago', errors24h: 0, webhookSlug: 's3',
    log: [
      { time: 'Oct 28 10:39', messageEn: 'OK · uploads nominal', messageAr: 'سليم · الرفع طبيعي' },
      { time: 'Oct 28 09:39', messageEn: 'OK · uploads nominal', messageAr: 'سليم · الرفع طبيعي' },
      { time: 'Oct 28 08:39', messageEn: 'OK · uploads nominal', messageAr: 'سليم · الرفع طبيعي' },
    ],
  },
  {
    key: 'sendgrid', nameEn: 'SendGrid Email', nameAr: 'سيند جريد للبريد', category: 'infra', status: 'degraded', previousStatus: 'degraded',
    companies: 24, lastSync: '22m ago', errors24h: 4, webhookSlug: 'sendgrid',
    log: [
      { time: 'Oct 28 10:18', messageEn: '4 events failed · soft bounces', messageAr: '4 أحداث فشلت · ارتداد مؤقت' },
      { time: 'Oct 28 09:18', messageEn: 'OK · 310 events', messageAr: 'سليم · 310 أحداث' },
      { time: 'Oct 28 08:18', messageEn: 'OK · 296 events', messageAr: 'سليم · 296 حدثًا' },
    ],
  },
];

interface Copy {
  eyebrow: string;
  title: string;
  kpis: { total: string; healthy: string; degraded: string; unavailable: string };
  catAll: string;
  cats: Record<Category, string>;
  status: Record<Status, string>;
  colIntegration: string;
  colCategory: string;
  colStatus: string;
  colCompanies: string;
  colLastSync: string;
  colErrors: string;
  colAvailable: string;
  drawerConfig: string;
  drawerCredentials: string;
  drawerVaultRef: string;
  drawerWebhook: string;
  drawerConnected: string;
  drawerLog: string;
  drawerClose: string;
  makeAvailable: string;
  makeUnavailable: string;
  disableTitle: (name: string) => string;
  disableBody: (companies: number) => string;
  enableTitle: (name: string) => string;
  enableBody: string;
  reasonLabel: string;
  reasonError: string;
  cancel: string;
  confirm: string;
  disabledToast: (name: string) => string;
  enabledToast: (name: string) => string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Platform',
    title: 'Integrations',
    kpis: { total: 'Integrations', healthy: 'Healthy', degraded: 'Degraded', unavailable: 'Failing / unavailable' },
    catAll: 'All categories',
    cats: { comm: 'Communication', mkt: 'Marketing', re: 'Real estate', pay: 'Payments', infra: 'Infrastructure' },
    status: { healthy: 'Healthy', degraded: 'Degraded', down: 'Failing', disabled: 'Unavailable' },
    colIntegration: 'Integration',
    colCategory: 'Category',
    colStatus: 'Status',
    colCompanies: 'Companies',
    colLastSync: 'Last sync',
    colErrors: 'Errors (24h)',
    colAvailable: 'Available',
    drawerConfig: 'Configuration',
    drawerCredentials: 'Credentials',
    drawerVaultRef: 'vault ref',
    drawerWebhook: 'Webhook',
    drawerConnected: 'Connected companies',
    drawerLog: 'Sync log (latest)',
    drawerClose: 'Close',
    makeAvailable: 'Make available',
    makeUnavailable: 'Make unavailable',
    disableTitle: (name) => `Make unavailable: ${name}`,
    disableBody: (companies) => `${companies} companies use this integration. Syncing stops for all of them.`,
    enableTitle: (name) => `Make available: ${name}`,
    enableBody: 'Companies can connect this integration again.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    disabledToast: (name) => `${name} is now unavailable.`,
    enabledToast: (name) => `${name} is now available.`,
    emptyTitle: 'No integrations in this category',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'التكاملات',
    kpis: { total: 'التكاملات', healthy: 'سليمة', degraded: 'متدهورة', unavailable: 'متعطلة / غير متاحة' },
    catAll: 'كل الفئات',
    cats: { comm: 'الاتصال', mkt: 'التسويق', re: 'العقارات', pay: 'المدفوعات', infra: 'البنية' },
    status: { healthy: 'سليم', degraded: 'متدهور', down: 'متعطل', disabled: 'غير متاح' },
    colIntegration: 'التكامل',
    colCategory: 'الفئة',
    colStatus: 'الحالة',
    colCompanies: 'الشركات',
    colLastSync: 'آخر مزامنة',
    colErrors: 'أخطاء (24 س)',
    colAvailable: 'متاح',
    drawerConfig: 'الإعدادات',
    drawerCredentials: 'بيانات الاعتماد',
    drawerVaultRef: 'مرجع الخزنة',
    drawerWebhook: 'Webhook',
    drawerConnected: 'الشركات المتصلة',
    drawerLog: 'سجل المزامنة (الأحدث)',
    drawerClose: 'إغلاق',
    makeAvailable: 'إتاحة',
    makeUnavailable: 'إيقاف',
    disableTitle: (name) => `إيقاف: ${name}`,
    disableBody: (companies) => `تستخدم ${companies} شركة هذا التكامل. ستتوقف المزامنة لها جميعًا.`,
    enableTitle: (name) => `إتاحة: ${name}`,
    enableBody: 'يمكن للشركات ربط هذا التكامل مجددًا.',
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    disabledToast: (name) => `${name} أصبح غير متاح.`,
    enabledToast: (name) => `${name} أصبح متاحًا.`,
    emptyTitle: 'لا توجد تكاملات في هذه الفئة',
  },
};

@Component({
  selector: 'app-integrations',
  imports: [FormsModule],
  templateUrl: './integrations.html',
  styleUrl: './integrations.scss',
})
export class Integrations {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly categories: Category[] = ['comm', 'mkt', 're', 'pay', 'infra'];

  readonly items = signal<Integration[]>(SEED);
  readonly catFilter = signal<Category | 'all'>('all');
  readonly viewing = signal<Integration | null>(null);

  readonly toggling = signal<Integration | null>(null);
  readonly toggleReason = signal('');
  readonly toggleError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(i: Integration): string {
    return this.lang() === 'ar' ? i.nameAr : i.nameEn;
  }

  catName(c: Category): string {
    return this.L().cats[c];
  }

  statusName(s: Status): string {
    return this.L().status[s];
  }

  logMessage(e: SyncEntry): string {
    return this.lang() === 'ar' ? e.messageAr : e.messageEn;
  }

  readonly kpis = computed(() => {
    const list = this.items();
    return {
      total: list.length,
      healthy: list.filter((i) => i.status === 'healthy').length,
      degraded: list.filter((i) => i.status === 'degraded').length,
      unavailable: list.filter((i) => i.status === 'down' || i.status === 'disabled').length,
    };
  });

  readonly filtered = computed(() => {
    const c = this.catFilter();
    return this.items().filter((i) => c === 'all' || i.category === c);
  });

  setCat(c: Category | 'all'): void {
    this.catFilter.set(c);
  }

  openView(i: Integration): void {
    this.viewing.set(i);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  askToggle(i: Integration): void {
    this.toggling.set(i);
    this.toggleReason.set('');
    this.toggleError.set(false);
  }

  cancelToggle(): void {
    this.toggling.set(null);
  }

  confirmToggle(): void {
    const target = this.toggling();
    if (!target) return;
    const willDisable = target.status !== 'disabled';
    if (willDisable && this.toggleReason().trim().length < 5) {
      this.toggleError.set(true);
      return;
    }
    this.items.update((list) =>
      list.map((i) =>
        i.key === target.key
          ? willDisable
            ? { ...i, previousStatus: i.status, status: 'disabled' }
            : { ...i, status: i.previousStatus }
          : i,
      ),
    );
    this.showToast(willDisable ? this.L().disabledToast(this.name(target)) : this.L().enabledToast(this.name(target)));
    this.toggling.set(null);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
