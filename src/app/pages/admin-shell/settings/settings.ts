import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { PlatformConfig } from '../../../platform-config.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Tab = 'general' | 'defaults' | 'billing' | 'security' | 'notifs' | 'brand';

interface SettingsState {
  platformName: string;
  supportEmail: string;
  defaultLang: 'en' | 'ar';
  defaultTimezone: string;
  trialDays: number;
  defaultPlan: string;
  defaultCurrency: string;
  invoiceFormat: string;
  paymentTerms: number;
  taxRate: number;
  taxProfile: string;
  requireMfa: boolean;
  sessionLength: number;
  managementMaxMinutes: number;
  ipAllowlist: string;
  lockoutAttempts: number;
  notifyPaymentFailed: boolean;
  notifyTrialEnding: boolean;
  notifyTicketAssigned: boolean;
  notifyIncident: boolean;
  supportUrl: string;
  primaryColor: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  tabs: Record<Tab, string>;
  saveBtn: string;
  saveTitle: string;
  saveBody: string;
  saveBodySecurity: string;
  codeLabel: string;
  codeError: string;
  cancel: string;
  confirm: string;
  savedToast: string;
  fields: Record<string, string>;
  plans: { starter: string; pro: string; business: string; enterprise: string };
  taxProfiles: { standard: string; reverse_charge: string };
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Settings',
    sub: 'Global platform configuration',
    tabs: {
      general: 'General',
      defaults: 'Company defaults',
      billing: 'Billing',
      security: 'Security',
      notifs: 'Notifications',
      brand: 'Branding',
    },
    saveBtn: 'Save changes',
    saveTitle: 'Save platform settings',
    saveBody: 'Defaults apply to new records. Security changes take effect as described below.',
    saveBodySecurity: 'Changes apply platform-wide. Security changes require re-authentication.',
    codeLabel: 'Current password',
    codeError: 'Enter your current password.',
    cancel: 'Cancel',
    confirm: 'Save',
    savedToast: 'Settings saved.',
    fields: {
      platformName: 'Platform name',
      supportEmail: 'Support email',
      defaultLang: 'Default language',
      defaultTimezone: 'Default timezone',
      trialDays: 'Default trial length (days)',
      defaultPlan: 'Default plan for new companies',
      defaultCurrency: 'Default currency',
      invoiceFormat: 'Invoice number format',
      paymentTerms: 'Payment terms (days)',
      taxRate: 'VAT rate (%)',
      taxProfile: 'Default tax profile',
      requireMfa: 'Require MFA for all administrators',
      sessionLength: 'Session length (minutes)',
      managementMaxMinutes: 'Management-mode max duration (minutes)',
      ipAllowlist: 'IP allowlist (one per line)',
      lockoutAttempts: 'Lockout after failed attempts',
      notifyPaymentFailed: 'Payment failed',
      notifyTrialEnding: 'Trial ending',
      notifyTicketAssigned: 'Ticket assigned to me',
      notifyIncident: 'System incident',
      supportUrl: 'Support URL',
      primaryColor: 'Primary color',
    },
    plans: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
    taxProfiles: { standard: 'Standard (14% VAT)', reverse_charge: 'Reverse charge (foreign)' },
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'الإعدادات',
    sub: 'إعدادات المنصة العامة',
    tabs: {
      general: 'عام',
      defaults: 'افتراضيات الشركات',
      billing: 'الفوترة',
      security: 'الأمان',
      notifs: 'الإشعارات',
      brand: 'الهوية',
    },
    saveBtn: 'حفظ التغييرات',
    saveTitle: 'حفظ إعدادات المنصة',
    saveBody: 'تُطبّق التغييرات على مستوى المنصة.',
    saveBodySecurity: 'تُطبّق التغييرات على مستوى المنصة. تغييرات الأمان تتطلب إعادة المصادقة.',
    codeLabel: 'كلمة المرور الحالية',
    codeError: 'أدخل كلمة المرور الحالية.',
    cancel: 'إلغاء',
    confirm: 'حفظ',
    savedToast: 'تم حفظ الإعدادات.',
    fields: {
      platformName: 'اسم المنصة',
      supportEmail: 'بريد الدعم',
      defaultLang: 'اللغة الافتراضية',
      defaultTimezone: 'المنطقة الزمنية الافتراضية',
      trialDays: 'مدة الفترة التجريبية الافتراضية (أيام)',
      defaultPlan: 'الباقة الافتراضية للشركات الجديدة',
      defaultCurrency: 'العملة الافتراضية',
      invoiceFormat: 'تنسيق رقم الفاتورة',
      paymentTerms: 'شروط الدفع (أيام)',
      taxRate: 'نسبة ضريبة القيمة المضافة (%)',
      taxProfile: 'ملف الضريبة الافتراضي',
      requireMfa: 'إلزام MFA لكل المسؤولين',
      sessionLength: 'مدة الجلسة (دقائق)',
      managementMaxMinutes: 'الحد الأقصى لوضع الإدارة (دقائق)',
      ipAllowlist: 'قائمة عناوين IP المسموحة (سطر لكل عنوان)',
      lockoutAttempts: 'القفل بعد عدد محاولات فاشلة',
      notifyPaymentFailed: 'فشل الدفع',
      notifyTrialEnding: 'انتهاء الفترة التجريبية',
      notifyTicketAssigned: 'تذكرة أُسندت إليّ',
      notifyIncident: 'عطل في النظام',
      supportUrl: 'رابط الدعم',
      primaryColor: 'اللون الأساسي',
    },
    plans: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
    taxProfiles: { standard: 'عادي (ضريبة 14٪)', reverse_charge: 'عكسي (عميل أجنبي)' },
  },
};

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['../admin-ui.scss', './settings.scss'],
})
export class Settings {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly tabOrder: Tab[] = ['general', 'defaults', 'billing', 'security', 'notifs', 'brand'];
  readonly activeTab = signal<Tab>('general');

  readonly api = inject(AuthService);
  readonly config = inject(PlatformConfig);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly reason = signal('');
  readonly canEdit = computed(() => this.api.user()?.role === 'super_admin');
  version = 0;
  state = {} as SettingsState;
  /** Last loaded value, for the "Unsaved changes" state and Discard. */
  private original = '{}';
  isDirty() {
    return JSON.stringify(this.state) !== this.original;
  }
  discard() {
    this.state = JSON.parse(this.original);
    this.error.set('');
  }
  readonly staticToast = signal('');
  soon() {
    this.showToast(
      this.lang() === 'ar'
        ? 'هذا الإعداد غير مدعوم في الخادم بعد ولن يُحفظ.'
        : "This setting isn't supported by the backend yet and won't be saved.",
    );
  }
  sections(): Array<[Tab, string, string]> {
    const ar = this.lang() === 'ar';
    return [
      [
        'general',
        this.L().tabs.general,
        ar ? 'هوية المنصة والإعدادات الإقليمية' : 'Platform identity and locale defaults',
      ],
      [
        'defaults',
        this.L().tabs.defaults,
        ar ? 'تُطبق عند إنشاء شركة' : 'Applied when a company is created',
      ],
      [
        'billing',
        this.L().tabs.billing,
        ar ? 'الفواتير والشروط والضريبة' : 'Invoices, terms and tax',
      ],
      [
        'security',
        this.L().tabs.security,
        ar ? 'تُطبق على مديري المنصة' : 'Applies to platform administrators',
      ],
      [
        'notifs',
        this.L().tabs.notifs,
        ar ? 'رسائل تلقائية لمديري الشركات' : 'Automatic messages to company admins',
      ],
      ['brand', this.L().tabs.brand, ar ? 'الألوان وقوالب البريد' : 'Colors and email templates'],
    ];
  }
  jump(t: Tab) {
    this.setTab(t);
    document.getElementById('set-' + t)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.request('/admin/api/v1/settings');
      this.state = { ...r.value };
      this.original = JSON.stringify(r.value);
      this.version = r.version;
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  readonly saving = signal(false);
  readonly saveCode = signal('');
  readonly saveError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  tabName(t: Tab): string {
    return this.L().tabs[t];
  }

  setTab(t: Tab): void {
    this.activeTab.set(t);
  }

  openSave(): void {
    this.reason.set('');
    this.error.set('');
    this.saving.set(true);
    this.saveCode.set('');
    this.saveError.set(false);
  }

  closeSave(): void {
    this.saving.set(false);
  }

  async confirmSave() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.request('/admin/api/v1/settings', {
        version: this.version,
        value: { ...this.state },
        password: this.saveCode(),
        reason: this.reason().trim(),
      });
      this.saveCode.set('');
      this.saving.set(false);
      await this.load();
      await this.config.load();
      this.showToast(this.L().savedToast);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
