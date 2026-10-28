import { Component, computed, inject, signal } from '@angular/core';
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

const INITIAL: SettingsState = {
  platformName: 'Mujez',
  supportEmail: 'support@mujez.io',
  defaultLang: 'en',
  defaultTimezone: 'Africa/Cairo',
  trialDays: 21,
  defaultPlan: 'starter',
  defaultCurrency: 'EGP',
  invoiceFormat: 'INV-{YYYY}-{####}',
  paymentTerms: 14,
  taxRate: 14,
  taxProfile: 'standard',
  requireMfa: true,
  sessionLength: 45,
  managementMaxMinutes: 120,
  ipAllowlist: '',
  lockoutAttempts: 5,
  notifyPaymentFailed: true,
  notifyTrialEnding: true,
  notifyTicketAssigned: true,
  notifyIncident: true,
  supportUrl: 'https://support.mujez.io',
  primaryColor: '#3D4FD6',
};

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
    tabs: { general: 'General', defaults: 'Company defaults', billing: 'Billing', security: 'Security', notifs: 'Notifications', brand: 'Branding' },
    saveBtn: 'Save changes',
    saveTitle: 'Save platform settings',
    saveBody: 'Changes apply platform-wide.',
    saveBodySecurity: 'Changes apply platform-wide. Security changes require re-authentication.',
    codeLabel: 'TOTP code',
    codeError: 'Enter the 6-digit code.',
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
    tabs: { general: 'عام', defaults: 'افتراضيات الشركات', billing: 'الفوترة', security: 'الأمان', notifs: 'الإشعارات', brand: 'الهوية' },
    saveBtn: 'حفظ التغييرات',
    saveTitle: 'حفظ إعدادات المنصة',
    saveBody: 'تُطبّق التغييرات على مستوى المنصة.',
    saveBodySecurity: 'تُطبّق التغييرات على مستوى المنصة. تغييرات الأمان تتطلب إعادة المصادقة.',
    codeLabel: 'رمز TOTP',
    codeError: 'أدخل الرمز المكوّن من 6 أرقام.',
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
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly tabOrder: Tab[] = ['general', 'defaults', 'billing', 'security', 'notifs', 'brand'];
  readonly activeTab = signal<Tab>('general');

  state: SettingsState = { ...INITIAL };

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
    this.saving.set(true);
    this.saveCode.set('');
    this.saveError.set(false);
  }

  closeSave(): void {
    this.saving.set(false);
  }

  confirmSave(): void {
    if (this.activeTab() === 'security') {
      if (!/^\d{6}$/.test(this.saveCode().trim())) {
        this.saveError.set(true);
        return;
      }
    }
    this.saving.set(false);
    this.showToast(this.L().savedToast);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
