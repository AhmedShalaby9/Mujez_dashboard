import { NavigationState, RouteSkeleton } from '../../route-skeleton';
import { NotificationsApi } from '../../notifications-api.service';
import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';
import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CompanyInsightsApi, type Overview } from '../../company-insights-api.service';
import { inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyUiState, type Lang } from './company-ui-state';

/** Nav item -> permission required to see it. Items without an entry here
 * (e.g. the dashboard) are always shown to any signed-in tenant principal. */
const NAV_PERMISSION: Record<string, string> = {
  'hr/employees': 'workspace.view',
  'hr/departments': 'workspace.view',
  'hr/documents': 'workspace.view',
  'hr/onboarding': 'workspace.view',
  pipeline: 'pipeline.read',
  leads: 'leads.read',
  contacts: 'contacts.read',
  calendar: 'calendar.read',
  tasks: 'tasks.read',
  developers: 'projects.read',
  compounds: 'projects.read',
  units: 'units.read',
  reservations: 'reservations.read',
  contracts: 'contracts.read',
  commissions: 'commissions.read',
  documents: 'documents.read',
  marketing: 'marketing.read',
  reports: 'reports.read',
  'ai-analytics': 'reports.read',
  'lead-routing': 'routing.read',
  'audit-log': 'audit.read',
  team: 'team.read',
  'my-team': 'team.self.read',
};

const COMPANY_ICONS: Record<string, string> = {
  'hr/employees': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0',
  'hr/departments': 'M3 21h18M5 21V5h14v16M9 9h6M9 13h6',
  'hr/documents': 'M5 3h10l4 4v14H5zM9 12h6M9 16h6',
  'hr/onboarding': 'M4 5h3v3H4zM11 6h9M4 12h3v3H4zM11 13h9',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  pipeline: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  leads: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 7h5M19.5 4.5v5',
  contacts: 'M5 3h14v18H5zM3 7h4M3 12h4M3 17h4M10 8h5M10 12h5M10 16h3',
  calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2',
  tasks: 'M4 5h3v3H4zM11 6h9M4 12h3v3H4zM11 13h9M4 19h3M11 20h9',
  'my-team':
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 0 0 0-6M22 21a6 6 0 0 0-4-5.6',
  developers: 'M3 21h18M5 21V5l7-2v18M12 9h7v12M8 8h1M8 12h1M8 16h1M15 13h1M15 17h1',
  compounds: 'M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  units: 'M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  reservations: 'M5 3h14v18l-7-4-7 4zM9 8h6M9 12h6',
  contracts: 'M5 3h10l4 4v14H5zM9 8h3M9 12h6M9 16h6',
  commissions: 'M12 3v18M17 7c-1-2-9-2-9 2s8 2 8 6-8 4-10 1',
  documents: 'M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h6',
  marketing: 'M4 10v4h3l7 4V6l-7 4zM18 9a4 4 0 0 1 0 6',
  reports: 'M5 20V11M12 20V5M19 20v-6',
  'ai-analytics': 'M5 20V11M12 20V5M19 20v-6M3 3l2 2M18 3l2 2',
  'lead-routing': 'M4 4h5v5H4zM15 15h5v5h-5zM15 4h5v5h-5zM9 6.5h6M6.5 9v8.5H15',
  'audit-log': 'M5 3h10l4 4v14H5zM9 12h6M9 16h6M9 8h3',
  team: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 0 0 0-6M22 21a6 6 0 0 0-4-5.6',
};
interface NavHead {
  kind: 'head';
  label: string;
}

interface NavItem {
  kind: 'item';
  label: string;
  path: string;
  count?: string;
}

type NavEntry = NavHead | NavItem;

interface Notification {
  id: string;
  path: string;
  title: string;
  time: string;
  attention: boolean;
}

const ALERT_NAMES: Record<string, [string, string]> = {
  'overdue-tasks': ['Overdue open tasks', 'مهام مفتوحة متأخرة'],
  'missing-evidence': ['Contracts missing required evidence', 'عقود ينقصها مستند مطلوب'],
  'expiring-reservations': ['Reservations expiring within 24 hours', 'حجوزات تنتهي خلال 24 ساعة'],
  'payable-commissions': ['Commissions ready for payment', 'عمولات جاهزة للصرف'],
  'first-contact': ['Leads overdue for contact', 'عملاء تجاوزوا مهلة التواصل'],
  'routing-worker': ['Routing worker needs attention', 'عامل التوزيع يحتاج مراجعة'],
};

interface Copy {
  brand: string;
  platformTag: string;
  searchPh: string;
  otherLang: string;
  profileMenu: { profile: string; settings: string; signOut: string };
  notifTitle: string;
  notifEmpty: string;
  nav: NavEntry[];
}

const EN_NAV: NavEntry[] = [
  { kind: 'head', label: 'Sales' },
  { kind: 'item', label: 'Dashboard', path: 'dashboard' },
  { kind: 'item', label: 'Pipeline', path: 'pipeline' },
  { kind: 'item', label: 'Leads', path: 'leads' },
  { kind: 'item', label: 'Contacts', path: 'contacts' },
  { kind: 'item', label: 'Calendar', path: 'calendar' },
  { kind: 'item', label: 'Tasks', path: 'tasks' },
  { kind: 'item', label: 'My team', path: 'my-team' },
  { kind: 'head', label: 'Inventory' },
  { kind: 'item', label: 'Developers', path: 'developers' },
  { kind: 'item', label: 'Compounds', path: 'compounds' },
  { kind: 'item', label: 'Units', path: 'units' },
  { kind: 'item', label: 'Reservations', path: 'reservations' },
  { kind: 'head', label: 'Finance' },
  { kind: 'item', label: 'Contracts', path: 'contracts' },
  { kind: 'item', label: 'Commissions', path: 'commissions' },
  { kind: 'item', label: 'Documents', path: 'documents' },
  { kind: 'head', label: 'Growth' },
  { kind: 'item', label: 'Marketing', path: 'marketing' },
  { kind: 'item', label: 'Reports', path: 'reports' },
  { kind: 'item', label: 'AI analytics', path: 'ai-analytics' },
  { kind: 'head', label: 'People' },
  { kind: 'item', label: 'Employees', path: 'hr/employees' },
  { kind: 'item', label: 'Departments', path: 'hr/departments' },
  { kind: 'item', label: 'Employee documents', path: 'hr/documents' },
  { kind: 'item', label: 'Employee onboarding', path: 'hr/onboarding' },
  { kind: 'head', label: 'Administration' },
  { kind: 'item', label: 'Lead Routing', path: 'lead-routing' },
  { kind: 'item', label: 'Audit Log', path: 'audit-log' },
  { kind: 'item', label: 'Team', path: 'team' },
];

const AR_NAV: NavEntry[] = [
  { kind: 'head', label: 'المبيعات' },
  { kind: 'item', label: 'لوحة التحكم', path: 'dashboard' },
  { kind: 'item', label: 'مراحل الصفقات', path: 'pipeline' },
  { kind: 'item', label: 'العملاء المحتملون', path: 'leads' },
  { kind: 'item', label: 'جهات الاتصال', path: 'contacts' },
  { kind: 'item', label: 'التقويم', path: 'calendar' },
  { kind: 'item', label: 'المهام', path: 'tasks' },
  { kind: 'item', label: 'فريقي', path: 'my-team' },
  { kind: 'head', label: 'المخزون' },
  { kind: 'item', label: 'المطوّرون', path: 'developers' },
  { kind: 'item', label: 'الكمباوندات', path: 'compounds' },
  { kind: 'item', label: 'الوحدات', path: 'units' },
  { kind: 'item', label: 'الحجوزات', path: 'reservations' },
  { kind: 'head', label: 'الفوترة' },
  { kind: 'item', label: 'العقود', path: 'contracts' },
  { kind: 'item', label: 'العمولات', path: 'commissions' },
  { kind: 'item', label: 'المستندات', path: 'documents' },
  { kind: 'head', label: 'النمو' },
  { kind: 'item', label: 'التسويق', path: 'marketing' },
  { kind: 'item', label: 'التقارير', path: 'reports' },
  { kind: 'item', label: 'تحليلات الذكاء الاصطناعي', path: 'ai-analytics' },
  { kind: 'head', label: 'الموارد البشرية' },
  { kind: 'item', label: 'الموظفون', path: 'hr/employees' },
  { kind: 'item', label: 'الأقسام', path: 'hr/departments' },
  { kind: 'item', label: 'مستندات الموظفين', path: 'hr/documents' },
  { kind: 'item', label: 'تهيئة الموظفين', path: 'hr/onboarding' },
  { kind: 'head', label: 'الإدارة' },
  { kind: 'item', label: 'توزيع العملاء', path: 'lead-routing' },
  { kind: 'item', label: 'سجل التدقيق', path: 'audit-log' },
  { kind: 'item', label: 'الفريق', path: 'team' },
];

const COPY: Record<Lang, Copy> = {
  en: {
    brand: 'Mujez',
    platformTag: 'Company CRM',
    searchPh: 'Search leads, deals, units, contracts…',
    otherLang: 'العربية',
    profileMenu: { profile: 'Profile', settings: 'Settings', signOut: 'Sign out' },
    notifTitle: 'Current alerts',
    notifEmpty: 'View current alerts on the dashboard',
    nav: EN_NAV,
  },
  ar: {
    brand: 'موچز',
    platformTag: 'نظام الشركة',
    searchPh: 'ابحث عن عملاء أو صفقات أو وحدات أو عقود…',
    otherLang: 'English',
    profileMenu: { profile: 'الملف الشخصي', settings: 'الإعدادات', signOut: 'تسجيل الخروج' },
    notifTitle: 'التنبيهات الحالية',
    notifEmpty: 'عرض التنبيهات الحالية في لوحة التحكم',
    nav: AR_NAV,
  },
};

@Component({
  selector: 'app-company-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RouteSkeleton],
  templateUrl: './company-shell.html',
  styleUrls: [
    '../admin-shell/admin-sidebar.scss',
    '../admin-shell/admin-ui.scss',
    './company-shell.scss',
  ],
})
export class CompanyShell {
  readonly collapsed = signal(false);
  private readonly desktop = signal(typeof window === 'undefined' || window.innerWidth > 900);
  readonly isCollapsed = computed(() => this.collapsed() && this.desktop());
  readonly closedGroups = signal<Record<string, boolean>>({});
  readonly companySearch = viewChild<ElementRef<HTMLInputElement>>('companySearch');
  icon(path: string) {
    return COMPANY_ICONS[path] ?? COMPANY_ICONS['dashboard'];
  }
  focusSearch() {
    this.companySearch()?.nativeElement.focus();
  }
  toggleGroup(key: string) {
    this.closedGroups.update((v) => ({ ...v, [key]: !v[key] }));
  }
  @HostListener('window:resize') updateNavigationViewport() {
    this.desktop.set(window.innerWidth > 900);
  }
  readonly visibleGroups = computed(() => {
    const groups: { key: string; label: string; items: NavItem[] }[] = [];
    for (const entry of this.visibleNav()) {
      if (entry.kind === 'head') groups.push({ key: '', label: entry.label, items: [] });
      else {
        if (!groups.length) groups.push({ key: '', label: '', items: [] });
        groups[groups.length - 1].items.push(entry);
      }
    }
    return groups.filter((g) => g.items.length).map((g) => ({ ...g, key: g.items[0].path }));
  });
  readonly nav = inject(NavigationState);
  readonly announcements = signal<
    Array<{ id: string; title: string; body: string; type: string; priority: string }>
  >([]);
  private async loadAnnouncements() {
    try {
      const list = await this.auth.request('/api/v1/announcements?lang=' + this.lang());
      this.announcements.set(list);
    } catch {
      this.announcements.set([]);
    }
  }

  private readonly ui = inject(CompanyUiState);

  readonly dir = this.ui.dir;
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.ui.lang()]);
  private readonly insights = inject(CompanyInsightsApi);
  /** Live alerts from GET /company-overview (permission-filtered on the server). */
  readonly alerts = signal<Overview['alerts']>([]);
  readonly notificationFeed = inject(NotificationsApi);
  readonly notifications = computed<Notification[]>(() =>
    this.notificationFeed
      .items()
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        path: n.route,
        title: n.title,
        time: new Date(n.createdAt).toLocaleString(this.lang() === 'ar' ? 'ar-EG' : 'en-GB'),
        attention: !n.readAt,
      })),
  );
  async readNotification(id: string) {
    try {
      await this.notificationFeed.mark(id);
    } catch {}
  }

  /** Sidebar counts: tasks due today + alert counts on the page each alert opens. */
  private readonly counts = signal<Record<string, number>>({});

  readonly visibleNav = computed<NavEntry[]>(() => {
    const perms = this.auth.user()?.permissions ?? [];
    const all = this.L().nav;
    const kept: NavEntry[] = [];
    for (let i = 0; i < all.length; i++) {
      const entry = all[i];
      if (entry.kind === 'item') {
        if (
          (entry.path === 'ai-analytics' || entry.path.startsWith('hr/')) &&
          (this.auth.user()?.pool !== 'company_admin' ||
            this.auth.user()?.role !== 'company_owner' ||
            this.auth.user()?.workspace)
        )
          continue;
        const permission = NAV_PERMISSION[entry.path];
        if (permission && !perms.includes(permission)) continue;
        const n = this.counts()[entry.path];
        kept.push(n ? { ...entry, count: String(n) } : entry);
      } else {
        // Drop a head if nothing in its group survived filtering.
        const next = all.slice(i + 1).findIndex((e) => e.kind === 'head');
        const group = all.slice(i + 1, next === -1 ? undefined : i + 1 + next);
        const hasVisible = group.some(
          (e) =>
            e.kind === 'item' &&
            (!NAV_PERMISSION[e.path] || perms.includes(NAV_PERMISSION[e.path])),
        );
        if (hasVisible) kept.push(entry);
      }
    }
    return kept;
  });

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly companyName = computed(() => this.auth.user()?.company?.name[this.ui.lang()] ?? '');
  readonly error = signal('');
  readonly workspace = computed(() => this.auth.user()?.workspace ?? null);

  get me() {
    const u = this.auth.user();
    const ws = u?.workspace;
    const name = ws ? ws.platformUserName : (u?.name ?? '');
    const roleLabels: Record<string, { en: string; ar: string }> = {
      company_owner: { en: 'Company Owner', ar: 'مالك الشركة' },
      team_lead: { en: 'Team Lead', ar: 'قائد الفريق' },
      agent: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
      employee: { en: 'Employee', ar: 'موظف' },
    };
    const role = ws
      ? (ws.platformRoleName?.[this.ui.lang()] ??
        (this.ui.lang() === 'ar' ? 'مدير منصة' : 'Platform Admin'))
      : u?.roles?.length && u.pool === 'company_user'
        ? u.roles.map((r) => roleLabels[r]?.[this.ui.lang()] ?? r).join(' · ')
        : (u?.roleName?.[this.ui.lang()] ??
          roleLabels[u?.role ?? '']?.[this.ui.lang()] ??
          (this.ui.lang() === 'ar' ? 'مستخدم الشركة' : 'Company User'));
    return {
      name,
      role,
      initials: name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0].toUpperCase())
        .join(''),
    };
  }
  async signOut() {
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  // ---- workspace banner (platform admin inside a controlled workspace session) ----

  readonly now = signal(Date.now());
  private readonly nowTimer = setInterval(() => this.now.set(Date.now()), 1000);
  private readonly destroyRef = inject(DestroyRef).onDestroy(() => clearInterval(this.nowTimer));

  readonly manageCountdown = computed(() => {
    const ws = this.workspace();
    if (!ws?.manageExpiresAt) return null;
    const ms = new Date(ws.manageExpiresAt).getTime() - this.now();
    if (ms <= 0) return '0:00';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ':' + String(s).padStart(2, '0');
  });

  readonly wsBusy = signal(false);
  readonly wsError = signal('');
  readonly elevateOpen = signal(false);
  readonly elevateReason = signal('');
  readonly elevateDuration = signal<30 | 60 | 120>(30);
  readonly elevatePassword = signal('');
  readonly wsDurations: Array<30 | 60 | 120> = [30, 60, 120];

  openElevate(): void {
    this.elevateOpen.set(true);
    this.elevateReason.set('');
    this.elevateDuration.set(30);
    this.elevatePassword.set('');
    this.wsError.set('');
  }
  closeElevate(): void {
    this.elevateOpen.set(false);
    this.elevatePassword.set('');
  }

  async submitElevate(): Promise<void> {
    if (this.wsBusy()) return;
    if (this.elevateReason().trim().length < 10) {
      this.wsError.set(
        this.ui.lang() === 'ar'
          ? 'يجب ألا يقل السبب عن 10 أحرف.'
          : 'Reason must be at least 10 characters.',
      );
      return;
    }
    if (!this.elevatePassword()) {
      this.wsError.set(this.ui.lang() === 'ar' ? 'أدخل كلمة المرور.' : 'Enter your password.');
      return;
    }
    this.wsBusy.set(true);
    try {
      await this.auth.request('/api/v1/workspace-session/elevate', {
        reason: this.elevateReason().trim(),
        durationMinutes: this.elevateDuration(),
        password: this.elevatePassword(),
      });
      await this.auth.restore();
      this.closeElevate();
    } catch (e) {
      this.wsError.set((e as Error).message);
    } finally {
      this.elevatePassword.set('');
      this.wsBusy.set(false);
    }
  }

  async dropToReadOnly(): Promise<void> {
    if (this.wsBusy()) return;
    this.wsBusy.set(true);
    try {
      await this.auth.request('/api/v1/workspace-session/drop', {});
      await this.auth.restore();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.wsBusy.set(false);
    }
  }

  async exitWorkspace(destination = '/admin/dashboard'): Promise<void> {
    if (this.wsBusy()) return;
    this.wsBusy.set(true);
    try {
      await this.auth.request('/api/v1/workspace-session/exit', {});
      if (!(await this.auth.restore())) throw new Error('Unable to refresh platform session.');
      await this.router.navigateByUrl(destination);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.wsBusy.set(false);
    }
  }

  switchWorkspace(): void {
    void this.exitWorkspace('/admin/companies');
  }

  private alertsSerial = 0;
  async loadAlerts() {
    if (
      this.auth.user()?.pool === 'company_user' &&
      !this.auth.user()?.permissions.includes('leads.read')
    )
      return;
    const n = ++this.alertsSerial;
    try {
      const d = await this.insights.get<Overview>('/company-overview');
      if (n !== this.alertsSerial) return;
      this.alerts.set(d.alerts.filter((a) => a.count > 0));
    } catch {
      // The bell stays empty if the overview isn't available (no workspace.view).
      if (n === this.alertsSerial) this.alerts.set([]);
    }
  }
  private readonly navSub = this.router.events
    .pipe(filter((e) => e instanceof NavigationEnd))
    .subscribe(() => {
      void this.loadAlerts();
      void this.loadAnnouncements();
      void this.notificationFeed.refresh();
      void this.loadTools();
    });
  private readonly navCleanup = inject(DestroyRef).onDestroy(() => this.navSub.unsubscribe());
  private readonly initAlerts = void this.loadAlerts();
  private readonly initAnnouncements = void this.loadAnnouncements();
  private readonly initNotifications = void this.notificationFeed.refresh();
  private readonly initTools = void this.loadTools();

  readonly canSearchLeads = computed(
    () =>
      this.auth
        .user()
        ?.permissions.some((p) =>
          ['leads.read', 'contacts.read', 'units.read', 'contracts.read'].includes(p),
        ) ?? false,
  );
  readonly canNewLead = computed(
    () => this.auth.user()?.permissions.includes('leads.manage') ?? false,
  );
  /** Top-bar search goes to Leads (there is no global search endpoint yet). */
  readonly searchResults = signal<Array<{ id: string; name: string; type: string; route: string }>>(
    [],
  );
  readonly searchDone = signal(false);
  readonly savedViews = signal<
    Array<{ id: string; name: string; filters: Record<string, string>; version: number }>
  >([]);
  async loadTools() {
    if (
      this.auth.user()?.pool === 'company_user' &&
      !this.auth.user()?.permissions.includes('leads.read')
    )
      return;
    try {
      const [counts, views] = await Promise.all([
        this.auth.request('/api/v1/navigation-counts'),
        this.auth.request('/api/v1/saved-views'),
      ]);
      this.counts.set(counts);
      this.savedViews.set(views.items);
    } catch {}
  }
  async submitSearch(input: HTMLInputElement) {
    const q = input.value.trim();
    if (q.length < 2) return;
    try {
      const r = await this.auth.request('/api/v1/search?q=' + encodeURIComponent(q));
      this.searchResults.set(r.items);
      this.searchDone.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async removeSaved(v: { id: string; version: number }) {
    try {
      await this.auth.request('/api/v1/saved-views/' + v.id + '/delete', { version: v.version });
      await this.loadTools();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  openSaved(v: { filters: Record<string, string> }) {
    void this.router.navigate(['/company/leads'], { queryParams: v.filters });
  }
  newLead() {
    void this.router.navigate(['/company/leads'], { queryParams: { new: Date.now() } });
  }
  setLang(l: Lang) {
    this.ui.lang.set(l);
    void this.loadAnnouncements();
  }
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      const el = document.getElementById('company-search') as HTMLInputElement | null;
      if (el) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    }
  }

  readonly mobileNavOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly search = signal('');
  readonly unreadCount = computed(() => this.notificationFeed.unread());

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
    if (!this.notifOpen()) void this.loadAlerts();
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
