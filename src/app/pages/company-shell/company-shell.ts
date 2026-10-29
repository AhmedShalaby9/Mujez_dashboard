import { Component, computed, signal } from '@angular/core';
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
  switcherLabel: string;
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
  { kind: 'item', label: 'Pipeline', path: 'pipeline', count: '41' },
  { kind: 'item', label: 'Leads', path: 'leads', count: '58' },
  { kind: 'item', label: 'Tasks', path: 'tasks', count: '12' },
  { kind: 'head', label: 'Inventory' },
  { kind: 'item', label: 'Projects', path: 'projects' },
  { kind: 'item', label: 'Units', path: 'units', count: '246' },
  { kind: 'item', label: 'Reservations', path: 'reservations', count: '9' },
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
  { kind: 'item', label: 'مراحل الصفقات', path: 'pipeline', count: '41' },
  { kind: 'item', label: 'العملاء المحتملون', path: 'leads', count: '58' },
  { kind: 'item', label: 'المهام', path: 'tasks', count: '12' },
  { kind: 'head', label: 'المخزون' },
  { kind: 'item', label: 'المشروعات', path: 'projects' },
  { kind: 'item', label: 'الوحدات', path: 'units', count: '246' },
  { kind: 'item', label: 'الحجوزات', path: 'reservations', count: '9' },
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

const EN_NOTIFS: Notification[] = [
  {
    id: 'n1',
    path: '/company/reservations',
    title: 'Hold on HB-P2-B1-3A expires in 40 minutes',
    time: '40m left',
    attention: true,
  },
  {
    id: 'n2',
    path: '/company/leads',
    title: 'Lead "Nour Adel" unassigned for 12 minutes — SLA in 3 minutes',
    time: '3m to SLA',
    attention: true,
  },
  {
    id: 'n3',
    path: '/company/commissions',
    title: 'Commission on deal MJ-0418 is payable',
    time: '1h ago',
    attention: false,
  },
];

const AR_NOTIFS: Notification[] = [
  {
    id: 'n1',
    path: '/company/reservations',
    title: 'ينتهي حجز HB-P2-B1-3A بعد 40 دقيقة',
    time: 'باقي 40 د',
    attention: true,
  },
  {
    id: 'n2',
    path: '/company/leads',
    title: 'العميل "نور عادل" بدون إسناد منذ 12 دقيقة — المهلة بعد 3 دقائق',
    time: 'المهلة بعد 3 د',
    attention: true,
  },
  {
    id: 'n3',
    path: '/company/commissions',
    title: 'عمولة الصفقة MJ-0418 جاهزة للصرف',
    time: 'منذ ساعة',
    attention: false,
  },
];

const COPY: Record<Lang, Copy> = {
  en: {
    brand: 'Mujez',
    platformTag: 'Company CRM',
    switcherLabel: 'Horizon Realty',
    searchPh: 'Search leads, deals, units, contracts…',
    otherLang: 'العربية',
    profileMenu: { profile: 'Profile', settings: 'Settings', signOut: 'Sign out' },
    notifTitle: 'Current alerts',
    notifEmpty: 'No current alerts',
    nav: EN_NAV,
  },
  ar: {
    brand: 'مجاز',
    platformTag: 'نظام الشركة',
    switcherLabel: 'هورايزن للعقارات',
    searchPh: 'ابحث عن عملاء أو صفقات أو وحدات أو عقود…',
    otherLang: 'English',
    profileMenu: { profile: 'الملف الشخصي', settings: 'الإعدادات', signOut: 'تسجيل الخروج' },
    notifTitle: 'التنبيهات الحالية',
    notifEmpty: 'لا توجد تنبيهات حالية',
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
  readonly notifications = computed(() => (this.ui.lang() === 'ar' ? AR_NOTIFS : EN_NOTIFS));

  readonly me = { name: 'Mona Sami', role: 'Managing Broker', initials: 'MS' };

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
