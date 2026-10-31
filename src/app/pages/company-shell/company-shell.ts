import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';
import { Component, DestroyRef, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyUiState, type Lang } from './company-ui-state';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

const ICONS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  pipeline: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/>',
  leads: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  contacts: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  projects: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/>',
  units: '<rect x="3" y="7" width="7" height="14"/><rect x="14" y="3" width="7" height="18"/><path d="M6 11h1M6 15h1M17 7h1M17 11h1M17 15h1"/>',
  reservations: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  contracts: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>',
  commissions: '<circle cx="12" cy="12" r="10"/><path d="M12 6v12M15.5 9a3.5 3.5 0 0 0-3.5-1.5 3 3 0 0 0 0 6c2 0 3.5 1 3.5 3a3.5 3.5 0 0 1-3.5 1.5 3.5 3.5 0 0 1-3.5-2" />',
  documents: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/>',
  marketing: '<path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/>',
  reports: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  'lead-routing':
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M9 6h4a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4"/><path d="M21 16l-3 2 3 2"/>',
  'audit-log': '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v2h6V3M8 11h8M8 15h5"/>',
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
  collapse: string;
  expand: string;
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
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
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
    collapse: 'طي القائمة',
    expand: 'توسيع القائمة',
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
      ? (ws.platformRoleName?.[this.ui.lang()] ?? (this.ui.lang() === 'ar' ? 'مدير منصة' : 'Platform Admin'))
      : this.ui.lang() === 'ar'
        ? 'مالك الشركة'
        : 'Company Owner';
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
      this.wsError.set(this.ui.lang() === 'ar' ? 'يجب ألا يقل السبب عن 10 أحرف.' : 'Reason must be at least 10 characters.');
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
  readonly collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  private readonly sanitizer = inject(DomSanitizer);
  private readonly iconCache = new Map<string, SafeHtml>();
  navIcon(path: string): SafeHtml {
    let html = this.iconCache.get(path);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(ICONS[path] ?? ICONS['dashboard']);
      this.iconCache.set(path, html);
    }
    return html;
  }

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
