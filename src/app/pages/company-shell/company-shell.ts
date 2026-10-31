import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';
import { Component, DestroyRef, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyUiState, type Lang } from './company-ui-state';

/** Nav item -> permission required to see it. Items without an entry here
 * (e.g. the dashboard) are always shown to any signed-in tenant principal. */
const NAV_PERMISSION: Record<string, string> = {
  pipeline: 'pipeline.read',
  leads: 'leads.read',
  contacts: 'contacts.read',
  calendar: 'calendar.read',
  tasks: 'tasks.read',
  projects: 'projects.read',
  units: 'units.read',
  reservations: 'reservations.read',
  contracts: 'contracts.read',
  commissions: 'commissions.read',
  documents: 'documents.read',
  marketing: 'marketing.read',
  reports: 'reports.read',
  'lead-routing': 'routing.read',
  'audit-log': 'audit.read',
  team: 'team.read',
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
  { kind: 'head', label: 'Inventory' },
  { kind: 'item', label: 'Projects', path: 'projects' },
  { kind: 'item', label: 'Units', path: 'units' },
  { kind: 'item', label: 'Reservations', path: 'reservations' },
  { kind: 'head', label: 'Finance' },
  { kind: 'item', label: 'Contracts', path: 'contracts' },
  { kind: 'item', label: 'Commissions', path: 'commissions' },
  { kind: 'item', label: 'Documents', path: 'documents' },
  { kind: 'head', label: 'Growth' },
  { kind: 'item', label: 'Marketing', path: 'marketing' },
  { kind: 'item', label: 'Reports', path: 'reports' },
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
  { kind: 'head', label: 'المخزون' },
  { kind: 'item', label: 'المشروعات', path: 'projects' },
  { kind: 'item', label: 'الوحدات', path: 'units' },
  { kind: 'item', label: 'الحجوزات', path: 'reservations' },
  { kind: 'head', label: 'الفوترة' },
  { kind: 'item', label: 'العقود', path: 'contracts' },
  { kind: 'item', label: 'العمولات', path: 'commissions' },
  { kind: 'item', label: 'المستندات', path: 'documents' },
  { kind: 'head', label: 'النمو' },
  { kind: 'item', label: 'التسويق', path: 'marketing' },
  { kind: 'item', label: 'التقارير', path: 'reports' },
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './company-shell.html',
  styleUrl: './company-shell.scss',
})
export class CompanyShell {
  private readonly ui = inject(CompanyUiState);

  readonly dir = this.ui.dir;
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.ui.lang()]);
  readonly notifications = computed<Notification[]>(() => []);

  readonly visibleNav = computed<NavEntry[]>(() => {
    const perms = this.auth.user()?.permissions ?? [];
    const all = this.L().nav;
    const kept: NavEntry[] = [];
    for (let i = 0; i < all.length; i++) {
      const entry = all[i];
      if (entry.kind === 'item') {
        const permission = NAV_PERMISSION[entry.path];
        if (permission && !perms.includes(permission)) continue;
        kept.push(entry);
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
    const role = ws
      ? (ws.platformRoleName?.[this.ui.lang()] ??
        (this.ui.lang() === 'ar' ? 'مدير منصة' : 'Platform Admin'))
      : (u?.roleName?.[this.ui.lang()] ??
        (this.ui.lang() === 'ar' ? 'مالك الشركة' : 'Company Owner'));
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

  async exitWorkspace(): Promise<void> {
    if (this.wsBusy()) return;
    this.wsBusy.set(true);
    try {
      await this.auth.request('/api/v1/workspace-session/exit', {});
      await this.router.navigateByUrl('/admin/dashboard');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.wsBusy.set(false);
    }
  }

  switchWorkspace(): void {
    void this.router.navigateByUrl('/admin/companies');
  }

  readonly mobileNavOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly search = signal('');
  readonly unreadCount = computed(() => this.notifications().filter((n) => n.attention).length);

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
