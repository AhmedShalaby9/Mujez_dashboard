import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminUiState, type Lang } from './admin-ui-state';

interface NavHead {
  kind: 'head';
  label: string;
}

interface NavItem {
  kind: 'item';
  label: string;
  path?: string;
  count?: string;
  enabled: boolean;
}

type NavEntry = NavHead | NavItem;

interface Notification {
  title: string;
  time: string;
  unread: boolean;
}

interface Copy {
  brand: string;
  platformTag: string;
  platformAdmin: string;
  searchPh: string;
  otherLang: string;
  profileMenu: { profile: string; settings: string; signOut: string };
  notifTitle: string;
  notifEmpty: string;
  nav: NavEntry[];
  notifications: Notification[];
}

const EN_NAV: NavEntry[] = [
  { kind: 'head', label: 'Overview' },
  { kind: 'item', label: 'Dashboard', path: 'dashboard', enabled: true },
  { kind: 'head', label: 'Companies' },
  { kind: 'item', label: 'Companies', path: 'companies', count: '24', enabled: true },
  { kind: 'item', label: 'Onboarding', path: 'onboarding', count: '5', enabled: true },
  { kind: 'head', label: 'Billing' },
  { kind: 'item', label: 'Subscription Plans', path: 'subscription-plans', enabled: true },
  { kind: 'item', label: 'Subscriptions', path: 'subscriptions', count: '23', enabled: true },
  { kind: 'item', label: 'Billing & Invoices', path: 'billing', count: '20', enabled: true },
  { kind: 'item', label: 'Payments', path: 'payments', count: '18', enabled: true },
  { kind: 'head', label: 'Platform' },
  { kind: 'item', label: 'Feature Management', path: 'feature-management', enabled: true },
  { kind: 'item', label: 'Usage & Limits', path: 'usage-limits', enabled: true },
  { kind: 'item', label: 'Integrations', path: 'integrations', enabled: true },
  { kind: 'item', label: 'System Health', path: 'system-health', enabled: true },
  { kind: 'head', label: 'Support' },
  { kind: 'item', label: 'Support Tickets', path: 'support-tickets', count: '12', enabled: true },
  { kind: 'item', label: 'Announcements', path: 'announcements', enabled: true },
  { kind: 'head', label: 'Administration' },
  { kind: 'item', label: 'Platform Users', path: 'platform-users', enabled: true },
  { kind: 'item', label: 'Roles & Permissions', path: 'roles-permissions', enabled: true },
  { kind: 'item', label: 'Audit Logs', path: 'audit-logs', enabled: true },
  { kind: 'item', label: 'Settings', path: 'settings', enabled: true },
];

const AR_NAV: NavEntry[] = [
  { kind: 'head', label: 'نظرة عامة' },
  { kind: 'item', label: 'لوحة التحكم', path: 'dashboard', enabled: true },
  { kind: 'head', label: 'الشركات' },
  { kind: 'item', label: 'الشركات', path: 'companies', count: '24', enabled: true },
  { kind: 'item', label: 'التأهيل', path: 'onboarding', count: '5', enabled: true },
  { kind: 'head', label: 'الفوترة' },
  { kind: 'item', label: 'خطط الاشتراك', path: 'subscription-plans', enabled: true },
  { kind: 'item', label: 'الاشتراكات', path: 'subscriptions', count: '23', enabled: true },
  { kind: 'item', label: 'الفواتير', path: 'billing', count: '20', enabled: true },
  { kind: 'item', label: 'المدفوعات', path: 'payments', count: '18', enabled: true },
  { kind: 'head', label: 'المنصة' },
  { kind: 'item', label: 'إدارة الميزات', path: 'feature-management', enabled: true },
  { kind: 'item', label: 'الاستخدام والحدود', path: 'usage-limits', enabled: true },
  { kind: 'item', label: 'التكاملات', path: 'integrations', enabled: true },
  { kind: 'item', label: 'سلامة النظام', path: 'system-health', enabled: true },
  { kind: 'head', label: 'الدعم' },
  { kind: 'item', label: 'تذاكر الدعم', path: 'support-tickets', count: '12', enabled: true },
  { kind: 'item', label: 'الإعلانات', path: 'announcements', enabled: true },
  { kind: 'head', label: 'الإدارة' },
  { kind: 'item', label: 'موظفو المنصة', path: 'platform-users', enabled: true },
  { kind: 'item', label: 'الأدوار والصلاحيات', path: 'roles-permissions', enabled: true },
  { kind: 'item', label: 'سجلات التدقيق', path: 'audit-logs', enabled: true },
  { kind: 'item', label: 'الإعدادات', path: 'settings', enabled: true },
];

const COPY: Record<Lang, Copy> = {
  en: {
    brand: 'Mujez',
    platformTag: 'Platform Admin',
    platformAdmin: 'Platform Admin',
    searchPh: 'Search companies, invoices, tickets…',
    otherLang: 'العربية',
    profileMenu: { profile: 'Profile', settings: 'Settings', signOut: 'Sign out' },
    notifTitle: 'Notifications',
    notifEmpty: "You're all caught up.",
    nav: EN_NAV,
    notifications: [
      { title: 'Al Qahira Developments — payment failed (3rd attempt)', time: '12m ago', unread: true },
      { title: 'Nile View Realty — trial ends in 2 days', time: '1h ago', unread: true },
      { title: 'Deira Properties — approaching 90% of unit limit', time: '3h ago', unread: true },
      { title: 'New company created: Coastal Homes', time: 'Yesterday', unread: false },
    ],
  },
  ar: {
    brand: 'مجاز',
    platformTag: 'إدارة المنصة',
    platformAdmin: 'إدارة المنصة',
    searchPh: 'ابحث عن شركات أو فواتير أو تذاكر…',
    otherLang: 'English',
    profileMenu: { profile: 'الملف الشخصي', settings: 'الإعدادات', signOut: 'تسجيل الخروج' },
    notifTitle: 'الإشعارات',
    notifEmpty: 'لا توجد إشعارات جديدة.',
    nav: AR_NAV,
    notifications: [
      { title: 'القاهرة للتطوير — فشل الدفع (المحاولة الثالثة)', time: 'منذ 12 دقيقة', unread: true },
      { title: 'نايل فيو العقارية — تنتهي الفترة التجريبية خلال يومين', time: 'منذ ساعة', unread: true },
      { title: 'ديرة العقارية — اقتربت من 90% من حد الوحدات', time: 'منذ 3 ساعات', unread: true },
      { title: 'تم إنشاء شركة جديدة: كوستال هومز', time: 'أمس', unread: false },
    ],
  },
};

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  private readonly ui = inject(AdminUiState);

  readonly dir = this.ui.dir;
  readonly L = computed(() => COPY[this.ui.lang()]);

  readonly me = { name: 'Omar Khaled', role: 'Platform Admin', initials: 'OK' };

  readonly mobileNavOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly search = signal('');

  readonly unreadCount = computed(() => this.L().notifications.filter((n) => n.unread).length);

  toggleLang(): void {
    this.ui.toggleLang();
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.set(!this.mobileNavOpen());
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  toggleNotif(): void {
    this.notifOpen.set(!this.notifOpen());
    this.profileOpen.set(false);
  }

  toggleProfile(): void {
    this.profileOpen.set(!this.profileOpen());
    this.notifOpen.set(false);
  }

  closeMenus(): void {
    this.notifOpen.set(false);
    this.profileOpen.set(false);
  }
}
