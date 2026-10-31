import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Category = 'comm' | 'mkt' | 're' | 'pay' | 'infra';
type Status = 'healthy' | 'degraded' | 'down' | 'disabled' | 'unconfigured';

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
  enabled: boolean;
  version: number;
  companies: number;
  lastSync: string | null;
  errors24h: number | null;
  connectorReady?: boolean;
  credentialConfigured?: boolean;
  webhookUrl?: string | null;

  log: SyncEntry[];
}

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
    kpis: {
      total: 'Integrations',
      healthy: 'Healthy',
      degraded: 'Degraded',
      unavailable: 'Failing / unavailable',
    },
    catAll: 'All categories',
    cats: {
      comm: 'Communication',
      mkt: 'Marketing',
      re: 'Real estate',
      pay: 'Payments',
      infra: 'Infrastructure',
    },
    status: {
      healthy: 'Healthy',
      degraded: 'Degraded',
      down: 'Failing',
      disabled: 'Disabled',
      unconfigured: 'Unconfigured',
    },
    colIntegration: 'Integration',
    colCategory: 'Category',
    colStatus: 'Status',
    colCompanies: 'Companies',
    colLastSync: 'Last sync',
    colErrors: 'Errors (24h)',
    colAvailable: 'Requested enabled',
    drawerConfig: 'Configuration',
    drawerCredentials: 'Credentials',
    drawerVaultRef: 'vault ref',
    drawerWebhook: 'Webhook',
    drawerConnected: 'Connected companies',
    drawerLog: 'Configuration history',
    drawerClose: 'Close',
    makeAvailable: 'Make available',
    makeUnavailable: 'Make unavailable',
    disableTitle: (name) => `Make unavailable: ${name}`,
    disableBody: (companies) =>
      'Disable the requested setting. No provider connector is currently active.',
    enableTitle: (name) => `Make available: ${name}`,
    enableBody:
      'Save the requested enabled setting. Provider connectivity remains pending until its connector and credentials are implemented.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    disabledToast: (name) => `${name} is now unavailable.`,
    enabledToast: (name) => `${name}: requested setting saved; connector pending.`,
    emptyTitle: 'No integrations in this category',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'التكاملات',
    kpis: {
      total: 'التكاملات',
      healthy: 'سليمة',
      degraded: 'متدهورة',
      unavailable: 'متعطلة / غير متاحة',
    },
    catAll: 'كل الفئات',
    cats: { comm: 'الاتصال', mkt: 'التسويق', re: 'العقارات', pay: 'المدفوعات', infra: 'البنية' },
    status: {
      healthy: 'سليم',
      degraded: 'متدهور',
      down: 'متعطل',
      disabled: 'معطل',
      unconfigured: 'غير مهيأ',
    },
    colIntegration: 'التكامل',
    colCategory: 'الفئة',
    colStatus: 'الحالة',
    colCompanies: 'الشركات',
    colLastSync: 'آخر مزامنة',
    colErrors: 'أخطاء (24 س)',
    colAvailable: 'طلب التفعيل',
    drawerConfig: 'الإعدادات',
    drawerCredentials: 'بيانات الاعتماد',
    drawerVaultRef: 'مرجع الخزنة',
    drawerWebhook: 'Webhook',
    drawerConnected: 'الشركات المتصلة',
    drawerLog: 'سجل الإعدادات',
    drawerClose: 'إغلاق',
    makeAvailable: 'إتاحة',
    makeUnavailable: 'إيقاف',
    disableTitle: (name) => `إيقاف: ${name}`,
    disableBody: (companies) => 'إيقاف طلب التفعيل. لا يوجد موصل نشط حاليًا.',
    enableTitle: (name) => `إتاحة: ${name}`,
    enableBody: 'حفظ طلب التفعيل. الاتصال بالمزود معلق حتى تنفيذ الموصل وبيانات الاعتماد.',
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    disabledToast: (name) => `${name} أصبح غير متاح.`,
    enabledToast: (name) => `${name}: تم حفظ الطلب؛ الموصل معلق.`,
    emptyTitle: 'لا توجد تكاملات في هذه الفئة',
  },
};

@Component({
  selector: 'app-integrations',
  imports: [FormsModule],
  templateUrl: './integrations.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './integrations.scss'],
})
export class Integrations {
  private readonly api = inject(AuthService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set(await this.api.request('/admin/api/v1/integrations'));
      const key = this.viewing()?.key;
      if (key) this.viewing.set(this.items().find((i) => i.key === key) ?? null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly categories: Category[] = ['comm', 'mkt', 're', 'pay', 'infra'];

  readonly items = signal<Integration[]>([]);
  readonly catFilter = signal<Category | 'all'>('all');
  readonly statusFilter = signal<Status | 'all'>('all');
  readonly search = signal('');
  readonly kebabFor = signal<string | null>(null);
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
      unavailable: list.filter(
        (i) => i.status === 'down' || i.status === 'disabled' || i.status === 'unconfigured',
      ).length,
    };
  });

  readonly filtered = computed(() => {
    const c = this.catFilter(),
      st = this.statusFilter(),
      q = this.search().trim().toLowerCase();
    return this.items().filter(
      (i) =>
        (c === 'all' || i.category === c) &&
        (st === 'all' || i.status === st) &&
        (!q || (i.nameEn + ' ' + i.nameAr + ' ' + i.key).toLowerCase().includes(q)),
    );
  });
  readonly tabs = computed(() => {
    const order: Array<Status | 'all'> = [
      'all',
      'healthy',
      'degraded',
      'down',
      'unconfigured',
      'disabled',
    ];
    const ar = this.lang() === 'ar';
    return order
      .map((k) => ({
        k,
        label: k === 'all' ? (ar ? 'الكل' : 'All') : this.statusName(k),
        n: k === 'all' ? this.items().length : this.items().filter((i) => i.status === k).length,
      }))
      .filter((t) => t.k === 'all' || t.n > 0 || t.k === 'unconfigured' || t.k === 'disabled');
  });
  readonly stats = computed(() => {
    const list = this.items();
    const errs = list.filter((i) => i.errors24h !== null);
    return {
      total: list.length,
      requested: list.filter((i) => i.enabled).length,
      ready: list.filter((i) => i.connectorReady).length,
      degraded: list.filter((i) => i.status === 'degraded' || i.status === 'down').length,
      errors: errs.length ? errs.reduce((n, i) => n + (i.errors24h ?? 0), 0) : null,
    };
  });
  readonly hasFilters = computed(
    () => !!this.search().trim() || this.catFilter() !== 'all' || this.statusFilter() !== 'all',
  );
  clearFilters() {
    this.search.set('');
    this.catFilter.set('all');
    this.statusFilter.set('all');
  }
  pill(s: Status) {
    return (
      {
        healthy: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
        degraded: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
        down: { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' },
        unconfigured: { bg: '#EAEFFD', fg: '#2E47A8', dot: '#5B78E5' },
        disabled: { bg: '#F1F1ED', fg: '#6E6E73', dot: '#B4B4AE' },
      } as Record<Status, { bg: string; fg: string; dot: string }>
    )[s];
  }
  ago(iso: string | null) {
    if (!iso) return '—';
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    const ar = this.lang() === 'ar';
    if (m < 60) return ar ? `منذ ${m} دقيقة` : `${m} min ago`;
    if (m < 2880) return ar ? `منذ ${Math.round(m / 60)} ساعة` : `${Math.round(m / 60)} h ago`;
    return ar ? `منذ ${Math.round(m / 1440)} يوم` : `${Math.round(m / 1440)} d ago`;
  }
  date(iso: string) {
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }
  rotateSoon() {
    this.showToast(
      this.lang() === 'ar'
        ? 'تدوير المفاتيح من الخزنة غير متصل بعد — لم يتغير شيء.'
        : "Key rotation from the vault isn't connected yet — nothing changed.",
    );
  }

  setCat(c: Category | 'all'): void {
    this.catFilter.set(c);
  }

  openView(i: Integration): void {
    this.kebabFor.set(null);
    this.viewing.set(i);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  askToggle(i: Integration): void {
    this.kebabFor.set(null);
    this.toggling.set(i);
    this.toggleReason.set('');
    this.toggleError.set(false);
  }

  cancelToggle(): void {
    this.toggling.set(null);
  }

  async confirmToggle(): Promise<void> {
    const target = this.toggling();
    if (!target || this.saving()) return;
    if (this.toggleReason().trim().length < 5) {
      this.toggleError.set(true);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.request('/admin/api/v1/integrations/' + target.key + '/update', {
        version: target.version,
        enabled: !target.enabled,
        reason: this.toggleReason().trim(),
      });
      this.toggling.set(null);
      await this.load();
      this.showToast(
        target.enabled
          ? this.L().disabledToast(this.name(target))
          : this.L().enabledToast(this.name(target)),
      );
    } catch (e) {
      this.error.set((e as Error).message);
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
