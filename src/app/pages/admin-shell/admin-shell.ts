import { OverviewApi, overviewAlertText } from '../../overview-api.service';
import { PlatformConfig } from '../../platform-config.service';
import { SupportApi } from '../../support-api.service';
import { BillingApi } from '../../billing-api.service';
import { SubscriptionsApi } from '../../subscriptions-api.service';
import { CompaniesApi } from '../../companies-api.service';
import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminUiState, type Lang } from './admin-ui-state';

// Single-path stroke icons from the Mujez design (24×24, stroke 1.7).
const ICONS: Record<string, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  companies: 'M3 21h18M5 21V5l7-2v18M12 9h7v12M8 8h1M8 12h1M8 16h1M15 13h1M15 17h1',
  onboarding:
    'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  'subscription-plans': 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  subscriptions: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  billing: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  payments: 'M3 6h18v12H3zM3 10h18M7 15h3',
  'feature-management': 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6',
  'usage-limits': 'M5 20V11M12 20V5M19 20v-6',
  integrations: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
  'system-health': 'M3 12h4l3-7 4 14 3-7h4',
  'support-tickets': 'M4 5h16v11H9l-5 4z',
  announcements: 'M4 10v4h3l7 4V6l-7 4zM18 9a4 4 0 0 1 0 6',
  notifications: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  'platform-users':
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 0 0 0-6M22 21a6 6 0 0 0-4-5.6',
  'roles-permissions': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  'audit-logs': 'M5 3h10l4 4v14H5zM9 12h6M9 16h6M9 8h3',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.4-1.4M5.6 18.4 7 17M17 17l1.4 1.4M5.6 5.6 7 7',
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
  searchShort: string;
  profileMenu: {
    profile: string;
    settings: string;
    security: string;
    activity: string;
    signOut: string;
  };
  health: { ok: string; degraded: string; unknown: string; open: string };
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
    platformTag: 'Platform admin',
    platformAdmin: 'Platform Admin',
    searchPh: 'Search companies, invoices, tickets…',
    otherLang: 'العربية',
    searchShort: 'Search',
    profileMenu: {
      profile: 'Profile',
      settings: 'Settings',
      security: 'Profile & security',
      activity: 'My activity',
      signOut: 'Sign out',
    },
    health: {
      ok: 'All systems operational',
      degraded: 'Service degraded',
      unknown: 'System health',
      open: 'Open status page',
    },
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
    searchShort: 'بحث',
    profileMenu: {
      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      security: 'الملف الشخصي والأمان',
      activity: 'سجل نشاطي',
      signOut: 'تسجيل الخروج',
    },
    health: {
      ok: 'جميع الأنظمة تعمل',
      degraded: 'أداء الخدمة متراجع',
      unknown: 'صحة النظام',
      open: 'فتح صفحة الحالة',
    },
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
    void this.loadHealth();
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
      email: user?.email ?? '',
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

  /** Nav entries folded into collapsible groups; items the user can't open are hidden. */
  readonly groups = computed(() => {
    const out: {
      key: string;
      label: string;
      items: { path: string; label: string; count?: string; icon: string }[];
    }[] = [];
    for (const entry of this.L().nav) {
      if (entry.kind === 'head') out.push({ key: 'g' + out.length, label: entry.label, items: [] });
      else if (entry.path && entry.enabled && this.canView(entry.path) && out.length)
        out[out.length - 1].items.push({
          path: entry.path,
          label: entry.label,
          count: entry.count,
          icon: ICONS[entry.path] ?? ICONS['settings'],
        });
    }
    return out.filter((g) => g.items.length);
  });
  private readonly closedGroups = signal<Record<string, boolean>>({});
  isGroupOpen(key: string) {
    return !this.closedGroups()[key];
  }
  toggleGroup(key: string) {
    this.closedGroups.update((g) => ({ ...g, [key]: !g[key] }));
  }

  private readonly healthData = signal<{
    redis?: { status?: string };
    metrics?: { errorRate?: number };
  } | null>(null);
  private readonly healthFailed = signal(false);
  private async loadHealth() {
    if (!this.canView('system-health')) return;
    try {
      this.healthData.set(await this.auth.request('/admin/api/v1/system-health'));
      this.healthFailed.set(false);
    } catch {
      this.healthFailed.set(true);
    }
  }
  /** Sidebar status card — only claims "operational" when the health endpoint says so. */
  readonly health = computed(() => {
    const h = this.L().health,
      d = this.healthData();
    if (!d || this.healthFailed()) return { state: 'unknown', title: h.unknown, sub: h.open };
    const err = Number(d.metrics?.errorRate ?? 0);
    const ok = d.redis?.status === 'healthy' && err < 5;
    const ar = this.ui.lang() === 'ar';
    return {
      state: ok ? 'ok' : 'warn',
      title: ok ? h.ok : h.degraded,
      sub: (ar ? 'معدل الأخطاء ' : 'Error rate ') + err + '%',
    };
  });

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  focusSearch(): void {
    this.closeMobileNav();
    this.searchInput()?.nativeElement.focus();
  }
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.focusSearch();
    }
  }

  readonly sideProfileOpen = signal(false);

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
    this.sideProfileOpen.set(false);
  }

  toggleProfile(): void {
    this.sideProfileOpen.set(!this.sideProfileOpen());
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  toggleTopProfile(): void {
    this.profileOpen.set(!this.profileOpen());
    this.sideProfileOpen.set(false);
    this.notifOpen.set(false);
  }

  closeMenus(): void {
    this.notifOpen.set(false);
    this.profileOpen.set(false);
    this.sideProfileOpen.set(false);
  }
}
