import { OverviewApi, overviewAlertText } from '../../overview-api.service';
import { PlatformConfig } from '../../platform-config.service';
import { SupportApi } from '../../support-api.service';
import { BillingApi } from '../../billing-api.service';
import { SubscriptionsApi } from '../../subscriptions-api.service';
import { CompaniesApi } from '../../companies-api.service';
import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminUiState, type Lang } from './admin-ui-state';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

const ICONS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  companies:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 7h1M15 7h1M8 11h1M15 11h1M8 15h1M15 15h1"/>',
  onboarding: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'subscription-plans':
    '<path d="M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
  subscriptions:
    '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  billing: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/>',
  payments: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  'feature-management': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  'usage-limits': '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  integrations:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'system-health': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'support-tickets':
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/>',
  announcements: '<path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/>',
  notifications: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'platform-users':
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'roles-permissions': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'audit-logs': '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v2h6V3M8 11h8M8 15h5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

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
  collapse: string;
  expand: string;
}

const EN_NAV: NavEntry[] = [
  { kind: 'head', label: 'Overview' },
  { kind: 'item', label: 'Dashboard', path: 'dashboard', enabled: true },
  { kind: 'item', label: 'Companies', path: 'companies', count: '24', enabled: true },
  { kind: 'item', label: 'Onboarding', path: 'onboarding', count: '5', enabled: true },
  { kind: 'head', label: 'Revenue' },
  { kind: 'item', label: 'Subscription plans', path: 'subscription-plans', enabled: true },
  { kind: 'item', label: 'Subscriptions', path: 'subscriptions', count: '23', enabled: true },
  { kind: 'item', label: 'Billing & invoices', path: 'billing', count: '20', enabled: true },
  { kind: 'item', label: 'Payments', path: 'payments', count: '18', enabled: true },
  { kind: 'head', label: 'Platform' },
  { kind: 'item', label: 'Feature management', path: 'feature-management', enabled: true },
  { kind: 'item', label: 'Usage & limits', path: 'usage-limits', enabled: true },
  { kind: 'item', label: 'Integrations', path: 'integrations', enabled: true },
  { kind: 'item', label: 'System health', path: 'system-health', enabled: true },
  { kind: 'head', label: 'Operations' },
  { kind: 'item', label: 'Support tickets', path: 'support-tickets', enabled: true },
  { kind: 'item', label: 'Announcements', path: 'announcements', enabled: true },
  { kind: 'item', label: 'Notifications', path: 'notifications', enabled: true },
  { kind: 'head', label: 'Administration' },
  { kind: 'item', label: 'Platform users', path: 'platform-users', enabled: true },
  { kind: 'item', label: 'Roles & permissions', path: 'roles-permissions', enabled: true },
  { kind: 'item', label: 'Audit logs', path: 'audit-logs', enabled: true },
  { kind: 'item', label: 'Settings', path: 'settings', enabled: true },
];

const AR_NAV: NavEntry[] = [
  { kind: 'head', label: 'نظرة عامة' },
  { kind: 'item', label: 'لوحة التحكم', path: 'dashboard', enabled: true },
  { kind: 'item', label: 'الشركات', path: 'companies', count: '24', enabled: true },
  { kind: 'item', label: 'التهيئة', path: 'onboarding', count: '5', enabled: true },
  { kind: 'head', label: 'الإيرادات' },
  { kind: 'item', label: 'باقات الاشتراك', path: 'subscription-plans', enabled: true },
  { kind: 'item', label: 'الاشتراكات', path: 'subscriptions', count: '23', enabled: true },
  { kind: 'item', label: 'الفواتير', path: 'billing', count: '20', enabled: true },
  { kind: 'item', label: 'المدفوعات', path: 'payments', count: '18', enabled: true },
  { kind: 'head', label: 'المنصة' },
  { kind: 'item', label: 'إدارة الميزات', path: 'feature-management', enabled: true },
  { kind: 'item', label: 'الاستخدام والحدود', path: 'usage-limits', enabled: true },
  { kind: 'item', label: 'التكاملات', path: 'integrations', enabled: true },
  { kind: 'item', label: 'صحة النظام', path: 'system-health', enabled: true },
  { kind: 'head', label: 'العمليات' },
  { kind: 'item', label: 'تذاكر الدعم', path: 'support-tickets', enabled: true },
  { kind: 'item', label: 'الإعلانات', path: 'announcements', enabled: true },
  { kind: 'item', label: 'الإشعارات', path: 'notifications', enabled: true },
  { kind: 'head', label: 'الإدارة' },
  { kind: 'item', label: 'مستخدمو المنصة', path: 'platform-users', enabled: true },
  { kind: 'item', label: 'الأدوار والصلاحيات', path: 'roles-permissions', enabled: true },
  { kind: 'item', label: 'سجل التدقيق', path: 'audit-logs', enabled: true },
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
    notifTitle: 'Current alerts',
    notifEmpty: 'No current alerts in your permitted modules',
    nav: EN_NAV,
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
  },
  ar: {
    brand: 'موچز',
    platformTag: 'إدارة المنصة',
    platformAdmin: 'إدارة المنصة',
    searchPh: 'ابحث عن شركات أو فواتير أو تذاكر…',
    otherLang: 'English',
    profileMenu: { profile: 'الملف الشخصي', settings: 'الإعدادات', signOut: 'تسجيل الخروج' },
    notifTitle: 'التنبيهات الحالية',
    notifEmpty: 'لا توجد إشعارات جديدة.',
    nav: AR_NAV,
    collapse: 'طي القائمة',
    expand: 'توسيع القائمة',
  },
};

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  readonly overview = inject(OverviewApi);
  readonly notifications = computed(() =>
    this.overview.alerts().map((a) => ({
      id: a.id,
      path: a.path,
      title: overviewAlertText(a, this.ui.lang()),
      time: this.ui.lang() === 'ar' ? 'الحالة الحالية' : 'Current condition',
      attention: a.severity !== 'low',
    })),
  );
  readonly config = inject(PlatformConfig);
  readonly supportApi = inject(SupportApi);
  constructor() {
    void this.overview.refreshAlerts();
    if (this.auth.user()?.permissions.includes('support')) void this.supportApi.summary();
  }
  readonly billingApi = inject(BillingApi);
  readonly subscriptionsApi = inject(SubscriptionsApi);
  readonly companiesApi = inject(CompaniesApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  async signOut() {
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch {
      window.alert('Could not sign out. Please try again.');
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly dir = this.ui.dir;
  readonly L = computed(() => {
    const copy = COPY[this.ui.lang()];
    const counts = this.companiesApi.counts();
    return {
      ...copy,
      nav: copy.nav.map((entry) =>
        entry.kind === 'item' && (entry.path === 'companies' || entry.path === 'onboarding')
          ? {
              ...entry,
              count: counts[entry.path] === undefined ? undefined : String(counts[entry.path]),
            }
          : entry.kind === 'item' && entry.path === 'subscriptions'
            ? {
                ...entry,
                count:
                  this.subscriptionsApi.count() === undefined
                    ? undefined
                    : String(this.subscriptionsApi.count()),
              }
            : entry.kind === 'item' && (entry.path === 'billing' || entry.path === 'payments')
              ? {
                  ...entry,
                  count:
                    this.billingApi.counts()[entry.path === 'billing' ? 'invoices' : 'payments'] ===
                    undefined
                      ? undefined
                      : String(
                          this.billingApi.counts()[
                            entry.path === 'billing' ? 'invoices' : 'payments'
                          ],
                        ),
                }
              : entry.kind === 'item' && entry.path === 'support-tickets'
                ? {
                    ...entry,
                    count:
                      this.supportApi.count() === undefined
                        ? undefined
                        : String(this.supportApi.count()),
                  }
                : entry,
      ),
    };
  });

  get me() {
    const user = this.auth.user();
    return {
      name: user?.name ?? '',
      role:
        user?.roleName?.[this.ui.lang()] ??
        (user?.role === 'super_admin' ? 'Super Admin' : 'Administrator'),
      initials: (user?.name ?? '')
        .split(' ')
        .map((s) => s[0])
        .join('')
        .slice(0, 2),
    };
  }
  canView(path?: string) {
    const permissions: Record<string, string> = {
      companies: 'co.view',
      onboarding: 'co.create',
      'subscription-plans': 'plans',
      subscriptions: 'sub.manage',
      billing: 'billing',
      payments: 'billing',
      'feature-management': 'features',
      'usage-limits': 'usage',
      integrations: 'integrations',
      'system-health': 'health',
      'support-tickets': 'support',
      announcements: 'ann',
      'platform-users': 'admins',
      'roles-permissions': 'admins',
      'audit-logs': 'audit',
      settings: 'settings',
    };
    return !path || !permissions[path] || this.auth.user()?.permissions.includes(permissions[path]);
  }

  readonly mobileNavOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly search = signal('');
  readonly collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  private readonly sanitizer = inject(DomSanitizer);
  private readonly iconCache = new Map<string, SafeHtml>();
  navIcon(path?: string): SafeHtml {
    const key = path ?? '';
    let html = this.iconCache.get(key);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(ICONS[key] ?? ICONS['settings']);
      this.iconCache.set(key, html);
    }
    return html;
  }

  readonly unreadCount = computed(() => this.notifications().length);

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
    if (!this.notifOpen()) void this.overview.refreshAlerts();
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
