import { officeWorkspace } from '../../auth.service';
import { canCreateLead } from '../../auth.service';
import {
  aiModuleEnabled,
  financeModuleEnabled,
  hasAccountingAccess,
  hasAccountingSelf,
  hasPayrollAccess,
} from '../../auth.service';
import { hasFinanceAccess } from '../../auth.service';
import { visibleCompanyRoles } from '../../company-role-labels';
import { NavigationState, RouteSkeleton } from '../../route-skeleton';
import { NotificationsApi } from '../../notifications-api.service';
import {
  AuthService,
  hrModuleEnabled,
  hasCrmWorkspace,
  employeeArea,
  hasHrAccess,
  hasLeaveSelf,
  managesLeave,
} from '../../auth.service';
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
 * are checked separately when they depend on the workspace or assigned roles. */
const NAV_PERMISSION: Record<string, string> = {
  employee: 'leave.self',
  'my-leave': 'leave.self',
  'leave-approvals': 'leave.review',
  'hr/leave': 'leave.manage',
  'hr/employees': 'hr.read',
  'hr/departments': 'hr.read',
  'hr/documents': 'hr.read',
  pipeline: 'pipeline.read',
  leads: 'leads.read',
  'cold-calls': 'leads.read',
  contacts: 'contacts.read',
  calendar: 'calendar.read',
  tasks: 'tasks.read',
  'catalog/developers': 'projects.read',
  'catalog/compounds': 'projects.read',
  'catalog/units': 'units.read',
  projects: 'projects.read',
  'office/cities': 'leads.read',
  'office/dashboard': 'leads.read',
  'office/clients': 'leads.read',
  'office/properties': 'units.read',
  'office/bookings': 'reservations.read',
  'office/deals': 'reservations.read',
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
  employee: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0',
  'my-assets': 'M4 5h16v16H4zM8 5V3h8v2',
  'hr/assets': 'M4 5h16v16H4zM8 5V3h8v2',
  'my-advances': 'M3 6h18v12H3zM12 9v6M9 12h6',
  'hr/salary-advances': 'M3 6h18v12H3zM12 9v6M9 12h6',
  'my-attendance': 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  'team-attendance': 'M5 3h14v18H5zM8 12l3 3 5-6',
  'hr/attendance': 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
  'hr/work-schedules': 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
  'my-leave': 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
  'leave-approvals': 'M5 3h14v18H5zM8 12l3 3 5-6',
  'hr/leave': 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
  'hr/employees': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0',
  'hr/departments': 'M3 21h18M5 21V5h14v16M9 9h6M9 13h6',
  'hr/documents': 'M5 3h10l4 4v14H5zM9 12h6M9 16h6',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  pipeline: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  'cold-calls': 'M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 2-3 3-6 2C8 19 5 16 3 9 2 6 3 3 5 3',
  leads: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 7h5M19.5 4.5v5',
  contacts: 'M5 3h14v18H5zM3 7h4M3 12h4M3 17h4M10 8h5M10 12h5M10 16h3',
  calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2',
  tasks: 'M4 5h3v3H4zM11 6h9M4 12h3v3H4zM11 13h9M4 19h3M11 20h9',
  'my-team':
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 0 0 0-6M22 21a6 6 0 0 0-4-5.6',
  'catalog/developers': 'M3 21h18M5 21V5l7-2v18M12 9h7v12',
  'catalog/compounds': 'M3 10l9-7 9 7M5 9v12h14V9',
  'catalog/units': 'M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  projects: 'M3 21h18M5 21V5h6v16M11 9h8v12M8 8v1M8 12v1M15 12v1',
  developers: 'M3 21h18M5 21V5l7-2v18M12 9h7v12M8 8h1M8 12h1M8 16h1M15 13h1M15 17h1',
  compounds: 'M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  units: 'M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  reservations: 'M5 3h14v18l-7-4-7 4zM9 8h6M9 12h6',
  finance: 'M3 5h18v16H3zM7 9h3M7 13h10M7 17h10',
  'finance/settings': 'M3 5h18v16H3zM7 9h3M7 13h10M7 17h10',
  'finance/journals': 'M3 5h18v16H3zM7 9h3M7 13h10M7 17h10',
  'finance/treasury': 'M3 6h18v12H3zM12 9v6',
  'finance/receivables-payables': 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5',
  'finance/commissions': 'M12 3v18M6 8h12M6 16h12',
  'finance/expenses': 'M4 5h16v16H4zM8 9h8M8 13h8M8 17h5',
  'finance/reports': 'M4 21V3M4 21h17M8 17V9M13 17V5M18 17v-6',
  'my-finance': 'M5 3h14v18H5zM8 8h8M8 12h8',
  contracts: 'M5 3h10l4 4v14H5zM9 8h3M9 12h6M9 16h6',
  commissions: 'M12 3v18M17 7c-1-2-9-2-9 2s8 2 8 6-8 4-10 1',
  documents: 'M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h6',
  marketing: 'M4 10v4h3l7 4V6l-7 4zM18 9a4 4 0 0 1 0 6',
  reports: 'M5 20V11M12 20V5M19 20v-6',
  'ai-analytics': 'M5 20V11M12 20V5M19 20v-6M3 3l2 2M18 3l2 2',
  'lead-routing': 'M4 4h5v5H4zM15 15h5v5h-5zM15 4h5v5h-5zM9 6.5h6M6.5 9v8.5H15',
  'audit-log': 'M5 3h10l4 4v14H5zM9 12h6M9 16h6M9 8h3',
  'office/cities': 'M3 21h18M5 21V5h6v16M11 9h8v12',
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
  { kind: 'item', label: 'Cold calls', path: 'cold-calls' },
  { kind: 'item', label: 'Contacts', path: 'contacts' },
  { kind: 'item', label: 'Calendar', path: 'calendar' },
  { kind: 'item', label: 'Tasks', path: 'tasks' },
  { kind: 'item', label: 'My team', path: 'my-team' },
  { kind: 'head', label: 'Catalog' },
  { kind: 'item', label: 'Developers', path: 'catalog/developers' },
  { kind: 'item', label: 'Compounds', path: 'catalog/compounds' },
  { kind: 'item', label: 'Units', path: 'catalog/units' },
  { kind: 'head', label: 'Inventory' },
  { kind: 'item', label: 'Projects', path: 'projects' },
  { kind: 'item', label: 'Units', path: 'units' },
  { kind: 'item', label: 'Reservations', path: 'reservations' },
  { kind: 'head', label: 'Finance' },
  { kind: 'item', label: 'Finance overview', path: 'finance' },
  { kind: 'item', label: 'Journal entries', path: 'finance/journals' },
  { kind: 'item', label: 'Cash & banks', path: 'finance/treasury' },
  { kind: 'item', label: 'Receivables & payables', path: 'finance/receivables-payables' },
  { kind: 'item', label: 'Commission accounting', path: 'finance/commissions' },
  { kind: 'item', label: 'Expenses & cash custody', path: 'finance/expenses' },
  { kind: 'item', label: 'Financial reports', path: 'finance/reports' },
  { kind: 'item', label: 'Finance settings', path: 'finance/settings' },
  { kind: 'item', label: 'Payroll', path: 'payroll' },
  { kind: 'item', label: 'My financial statement', path: 'my-finance' },
  { kind: 'item', label: 'Contracts', path: 'contracts' },
  { kind: 'item', label: 'Commissions', path: 'commissions' },
  { kind: 'item', label: 'Documents', path: 'documents' },
  { kind: 'head', label: 'Growth' },
  { kind: 'item', label: 'Marketing', path: 'marketing' },
  { kind: 'item', label: 'Reports', path: 'reports' },
  { kind: 'item', label: 'AI analytics', path: 'ai-analytics' },
  { kind: 'head', label: 'People' },
  { kind: 'item', label: 'Employee area', path: 'employee' },
  { kind: 'item', label: 'My assets', path: 'my-assets' },
  { kind: 'item', label: 'My salary advances', path: 'my-advances' },
  { kind: 'item', label: 'Company assets', path: 'hr/assets' },
  { kind: 'item', label: 'Salary advances', path: 'hr/salary-advances' },
  { kind: 'item', label: 'My attendance', path: 'my-attendance' },
  { kind: 'item', label: 'Team attendance', path: 'team-attendance' },
  { kind: 'item', label: 'Attendance overview', path: 'hr/attendance' },
  { kind: 'item', label: 'Work schedules', path: 'hr/work-schedules' },
  { kind: 'item', label: 'My leave', path: 'my-leave' },
  { kind: 'item', label: 'Leave approvals', path: 'leave-approvals' },
  { kind: 'item', label: 'Leave management', path: 'hr/leave' },
  { kind: 'item', label: 'Employees', path: 'hr/employees' },
  { kind: 'item', label: 'Departments', path: 'hr/departments' },
  { kind: 'item', label: 'Employee documents', path: 'hr/documents' },
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
  { kind: 'item', label: 'المكالمات الباردة', path: 'cold-calls' },
  { kind: 'item', label: 'جهات الاتصال', path: 'contacts' },
  { kind: 'item', label: 'التقويم', path: 'calendar' },
  { kind: 'item', label: 'المهام', path: 'tasks' },
  { kind: 'item', label: 'فريقي', path: 'my-team' },
  { kind: 'head', label: 'الكتالوج' },
  { kind: 'item', label: 'المطوّرون', path: 'catalog/developers' },
  { kind: 'item', label: 'الكمباوندات', path: 'catalog/compounds' },
  { kind: 'item', label: 'الوحدات', path: 'catalog/units' },
  { kind: 'head', label: 'المخزون' },
  { kind: 'item', label: 'المشروعات', path: 'projects' },
  { kind: 'item', label: 'الوحدات', path: 'units' },
  { kind: 'item', label: 'الحجوزات', path: 'reservations' },
  { kind: 'head', label: 'الفوترة' },
  { kind: 'item', label: 'نظرة مالية عامة', path: 'finance' },
  { kind: 'item', label: 'القيود اليومية', path: 'finance/journals' },
  { kind: 'item', label: 'الخزينة والبنوك', path: 'finance/treasury' },
  { kind: 'item', label: 'المستحقات والالتزامات', path: 'finance/receivables-payables' },
  { kind: 'item', label: 'محاسبة العمولات', path: 'finance/commissions' },
  { kind: 'item', label: 'المصروفات والعهد النقدية', path: 'finance/expenses' },
  { kind: 'item', label: 'التقارير المالية', path: 'finance/reports' },
  { kind: 'item', label: 'إعدادات الحسابات', path: 'finance/settings' },
  { kind: 'item', label: 'الرواتب', path: 'payroll' },
  { kind: 'item', label: 'كشف حسابي', path: 'my-finance' },
  { kind: 'item', label: 'العقود', path: 'contracts' },
  { kind: 'item', label: 'العمولات', path: 'commissions' },
  { kind: 'item', label: 'المستندات', path: 'documents' },
  { kind: 'head', label: 'النمو' },
  { kind: 'item', label: 'التسويق', path: 'marketing' },
  { kind: 'item', label: 'التقارير', path: 'reports' },
  { kind: 'item', label: 'تحليلات الذكاء الاصطناعي', path: 'ai-analytics' },
  { kind: 'head', label: 'الموارد البشرية' },
  { kind: 'item', label: 'مساحة الموظف', path: 'employee' },
  { kind: 'item', label: 'عُهدي', path: 'my-assets' },
  { kind: 'item', label: 'سُلَفي', path: 'my-advances' },
  { kind: 'item', label: 'عُهد الشركة', path: 'hr/assets' },
  { kind: 'item', label: 'سُلَف الموظفين', path: 'hr/salary-advances' },
  { kind: 'item', label: 'حضوري', path: 'my-attendance' },
  { kind: 'item', label: 'حضور الفريق', path: 'team-attendance' },
  { kind: 'item', label: 'متابعة الحضور', path: 'hr/attendance' },
  { kind: 'item', label: 'جداول العمل', path: 'hr/work-schedules' },
  { kind: 'item', label: 'إجازاتي', path: 'my-leave' },
  { kind: 'item', label: 'مراجعة الإجازات', path: 'leave-approvals' },
  { kind: 'item', label: 'إدارة الإجازات', path: 'hr/leave' },
  { kind: 'item', label: 'الموظفون', path: 'hr/employees' },
  { kind: 'item', label: 'الأقسام', path: 'hr/departments' },
  { kind: 'item', label: 'مستندات الموظفين', path: 'hr/documents' },
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

  readonly leaveContext = signal<any>(null);
  readonly visibleNav = computed<NavEntry[]>(() => {
    const u = this.auth.user();
    const perms = this.auth.user()?.permissions ?? [];
    const all = this.L().nav.map((e) => ({ ...e }));
    const kept: NavEntry[] = [];
    const canSee = (item: NavItem) => {
      const u = this.auth.user();
      if (item.path === 'finance' || item.path.startsWith('finance/'))
        return hasAccountingAccess(u);
      if (item.path === 'payroll') return hasPayrollAccess(u);
      if (item.path === 'my-finance') return hasAccountingSelf(u);
      if (item.path === 'ai-analytics' && !aiModuleEnabled(u)) return false;
      if (item.path === 'dashboard') return hasCrmWorkspace(u);
      if (item.path === 'employee') return employeeArea(u);
      if (
        (item.path.startsWith('hr/') ||
          [
            'my-assets',
            'my-advances',
            'my-leave',
            'leave-approvals',
            'my-attendance',
            'team-attendance',
          ].includes(item.path)) &&
        !hrModuleEnabled(u)
      )
        return false;
      if (
        item.path === 'ai-analytics' &&
        (u?.pool !== 'company_admin' || u?.role !== 'company_owner' || u?.workspace)
      )
        return false;
      if (['my-assets', 'my-advances', 'my-attendance', 'my-leave'].includes(item.path))
        return (
          hasLeaveSelf(u) ||
          (!u?.workspace && u?.pool === 'company_admin' && !!this.leaveContext()?.self)
        );
      if (item.path === 'team-attendance') return !u?.workspace && !!this.leaveContext()?.isManager;
      if (item.path === 'leave-approvals') return !u?.workspace && !!this.leaveContext()?.isManager;
      if (item.path === 'hr/leave') return managesLeave(u);
      if (item.path === 'hr/salary-advances') return hasFinanceAccess(u);
      if (item.path.startsWith('hr/')) return hasHrAccess(u);
      const permission = NAV_PERMISSION[item.path];
      return !permission || perms.includes(permission);
    };
    if (officeWorkspace(this.auth.user())) {
      const map: Record<string, [string, string, string] | null> = {
        dashboard: ['office/dashboard', 'Office overview', 'ملخص المكتب'],
        leads: ['office/clients', 'Clients', 'العملاء'],
        projects: ['office/properties', 'Office properties', 'عقارات المكتب'],
        reservations: ['office/bookings', 'Bookings', 'الحجوزات'],
        pipeline: ['office/pipeline', 'Pipeline', 'مراحل العملاء'],
        'cold-calls': null,
        'my-team': null,
        units: null,
        contracts: null,
        commissions: null,
        documents: null,
        marketing: null,
        reports: null,
        'ai-analytics': null,
        'lead-routing': null,
      };
      for (let i = all.length - 1; i >= 0; i--) {
        const entry = all[i];
        if (entry.kind !== 'item') continue;
        if (
          entry.path === 'finance' ||
          entry.path.startsWith('finance/') ||
          entry.path === 'my-finance' ||
          entry.path === 'payroll'
        ) {
          all.splice(i, 1);
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(map, entry.path)) {
          const next = map[entry.path];
          if (!next) {
            all.splice(i, 1);
            continue;
          }
          all[i] = { ...entry, path: next[0], label: this.lang() === 'ar' ? next[2] : next[1] };
          if (entry.path === 'reservations')
            all.splice(i + 1, 0, {
              kind: 'item',
              path: 'office/deals',
              label: this.lang() === 'ar' ? 'الصفقات' : 'Deals',
            });
        }
      }
    }
    if (
      officeWorkspace(u) &&
      u?.pool === 'company_admin' &&
      u.role === 'company_owner' &&
      !u.workspace
    )
      all.push({
        kind: 'item',
        path: 'office/cities',
        label: this.lang() === 'ar' ? 'المدن' : 'Cities',
      });
    for (let i = 0; i < all.length; i++) {
      const entry = all[i];
      if (entry.kind === 'item') {
        if (!canSee(entry)) continue;
        const n = this.counts()[entry.path];
        kept.push(n ? { ...entry, count: String(n) } : entry);
      } else {
        // Drop a head if nothing in its group survived filtering.
        const next = all.slice(i + 1).findIndex((e) => e.kind === 'head');
        const group = all.slice(i + 1, next === -1 ? undefined : i + 1 + next);
        const hasVisible = group.some((e) => e.kind === 'item' && canSee(e));
        if (hasVisible)
          kept.push(
            ['Finance', 'المالية'].includes(entry.label) && !financeModuleEnabled(this.auth.user())
              ? {
                  ...entry,
                  label: this.lang() === 'ar' ? 'العقود والعمولات' : 'Contracts & commissions',
                }
              : entry,
          );
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
      hr_officer: { en: 'HR Officer', ar: 'مسؤول الموارد البشرية' },
      hr_manager: { en: 'HR Manager', ar: 'مدير الموارد البشرية' },
      accountant: { en: 'Accountant', ar: 'محاسب' },
      finance_manager: { en: 'Finance Manager', ar: 'مدير مالي' },
      payroll_officer: { en: 'Payroll Officer', ar: 'مسؤول الرواتب' },
    };
    const role = ws
      ? (ws.platformRoleName?.[this.ui.lang()] ??
        (this.ui.lang() === 'ar' ? 'مدير منصة' : 'Platform Admin'))
      : u?.roles?.length && u.pool === 'company_user'
        ? visibleCompanyRoles(u.roles)
            .map((r) => roleLabels[r]?.[this.ui.lang()] ?? r)
            .join(' · ')
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
      void this.loadLeaveContext();
      void this.loadAlerts();
      void this.loadAnnouncements();
      void this.notificationFeed.refresh();
      void this.loadTools();
    });
  private readonly navCleanup = inject(DestroyRef).onDestroy(() => this.navSub.unsubscribe());
  async loadLeaveContext() {
    try {
      if (this.auth.user()?.workspace || !hrModuleEnabled(this.auth.user())) {
        this.leaveContext.set(null);
        return;
      }
      this.leaveContext.set(await this.auth.request('/api/v1/leave/context'));
    } catch {
      this.leaveContext.set(null);
    }
  }
  private readonly initLeave = void this.loadLeaveContext();
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
  readonly isOffice = computed(() => officeWorkspace(this.auth.user()));
  readonly canNewLead = computed(() => canCreateLead(this.auth.user()));
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
    if (!this.canNewLead()) return;
    void this.router.navigate([this.isOffice() ? '/company/office/clients' : '/company/leads'], {
      queryParams: { new: Date.now() },
    });
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
