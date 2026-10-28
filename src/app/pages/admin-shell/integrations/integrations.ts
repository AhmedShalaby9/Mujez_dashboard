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
  styleUrl: './integrations.scss',
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
