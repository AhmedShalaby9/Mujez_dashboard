import { AuthService } from '../../auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { Component, computed, signal, DestroyRef } from '@angular/core';
import { inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyUiState, type Lang } from './company-ui-state';

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
    notifEmpty: 'CRM notifications are not connected yet',
    nav: EN_NAV,
  },
  ar: {
    brand: 'مجاز',
    platformTag: 'نظام الشركة',
    searchPh: 'ابحث عن عملاء أو صفقات أو وحدات أو عقود…',
    otherLang: 'English',
    profileMenu: { profile: 'الملف الشخصي', settings: 'الإعدادات', signOut: 'تسجيل الخروج' },
    notifTitle: 'التنبيهات الحالية',
    notifEmpty: 'تنبيهات CRM غير متصلة بعد',
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
  readonly L = computed(() => COPY[this.ui.lang()]);
  readonly notifications = computed<Notification[]>(() => []);

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly companyName = computed(() => this.auth.user()?.company?.name[this.ui.lang()] ?? '');
  private readonly destroy = inject(DestroyRef);
  readonly currentPath = signal(this.router.url);
  readonly isPreview = computed(
    () =>
      !/^\/company\/(leads|pipeline|tasks|projects|units|reservations|contracts|documents|commissions|marketing|lead-routing)(?:[/?]|$)/.test(
        this.currentPath(),
      ),
  );
  constructor() {
    const subscription = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.currentPath.set(e.urlAfterRedirects);
    });
    this.destroy.onDestroy(() => subscription.unsubscribe());
  }
  readonly preview = computed(() =>
    this.ui.lang() === 'ar'
      ? 'باقي شاشات CRM معاينة للتصميم حاليًا. الأرقام والعمليات تجريبية ولا تُحفظ. تسجيل الدخول وبيانات الحساب والشركة متصلة بالنظام.'
      : 'Other CRM screens are currently design previews. Their figures and actions are sample data and changes are not saved. Login, account and company identity are connected.',
  );
  readonly error = signal('');
  get me() {
    const u = this.auth.user();
    return {
      name: u?.name ?? '',
      role: this.ui.lang() === 'ar' ? 'مالك الشركة' : 'Company Owner',
      initials: (u?.name ?? '')
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
