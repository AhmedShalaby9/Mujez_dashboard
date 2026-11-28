import {
  adminGuard,
  companyGuard,
  passwordChangeGuard,
  brokerageReservationsRedirect,
  brokerageUnitsRedirect,
} from './auth.service';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'change-password',
    canActivate: [passwordChangeGuard],
    loadComponent: () => import('./change-password').then((m) => m.ChangePassword),
  },
  { path: 'activate/company', loadComponent: () => import('./activate').then((m) => m.Activate) },
  { path: 'activate/team', loadComponent: () => import('./activate').then((m) => m.Activate) },
  { path: 'activate', loadComponent: () => import('./activate').then((m) => m.Activate) },
  { path: '', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin-shell/admin-shell').then((m) => m.AdminShell),
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'employee',
        data: { employeeView: true },
        loadComponent: () =>
          import('./pages/company-shell/employee/employee').then((m) => m.Employee),
      },
      {
        path: 'developers',
        data: { permission: 'co.view', view: 'devs' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'developers/:id',
        data: { permission: 'co.view', view: 'dev' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'compounds',
        data: { permission: 'co.view', view: 'cos' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'compounds/:id',
        data: { permission: 'co.view', view: 'co' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'units',
        data: { permission: 'co.view', view: 'units' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'units/:id',
        data: { permission: 'co.view', view: 'unit' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin-shell/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'companies',
        data: { permission: 'co.view' },
        loadComponent: () =>
          import('./pages/admin-shell/companies/companies').then((m) => m.Companies),
      },
      {
        path: 'demo-requests',
        data: { permission: 'co.view' },
        loadComponent: () =>
          import('./pages/admin-shell/demo-requests/demo-requests').then((m) => m.DemoRequests),
      },
      {
        path: 'onboarding/new',
        data: { permission: 'co.create' },
        loadComponent: () =>
          import('./pages/admin-shell/create-company/create-company').then((m) => m.CreateCompany),
      },
      {
        path: 'onboarding',
        data: { permission: 'co.create' },
        loadComponent: () =>
          import('./pages/admin-shell/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: 'subscription-plans',
        data: { permission: 'plans' },
        loadComponent: () =>
          import('./pages/admin-shell/subscription-plans/subscription-plans').then(
            (m) => m.SubscriptionPlans,
          ),
      },
      {
        path: 'subscriptions',
        data: { permission: 'sub.manage' },
        loadComponent: () =>
          import('./pages/admin-shell/subscriptions/subscriptions').then((m) => m.Subscriptions),
      },
      {
        path: 'billing',
        data: { permission: 'billing' },
        loadComponent: () => import('./pages/admin-shell/billing/billing').then((m) => m.Billing),
      },
      {
        path: 'payments',
        data: { permission: 'billing' },
        loadComponent: () =>
          import('./pages/admin-shell/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'feature-management',
        data: { permission: 'features' },
        loadComponent: () =>
          import('./pages/admin-shell/feature-management/feature-management').then(
            (m) => m.FeatureManagement,
          ),
      },
      {
        path: 'usage-limits',
        data: { permission: 'usage' },
        loadComponent: () =>
          import('./pages/admin-shell/usage-limits/usage-limits').then((m) => m.UsageLimits),
      },
      {
        path: 'integrations',
        data: { permission: 'integrations' },
        loadComponent: () =>
          import('./pages/admin-shell/integrations/integrations').then((m) => m.Integrations),
      },
      {
        path: 'system-health',
        data: { permission: 'health' },
        loadComponent: () =>
          import('./pages/admin-shell/system-health/system-health').then((m) => m.SystemHealth),
      },
      {
        path: 'support-tickets',
        data: { permission: 'support' },
        loadComponent: () =>
          import('./pages/admin-shell/support-tickets/support-tickets').then(
            (m) => m.SupportTickets,
          ),
      },
      {
        path: 'announcements',
        data: { permission: 'ann' },
        loadComponent: () =>
          import('./pages/admin-shell/announcements/announcements').then((m) => m.Announcements),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/admin-shell/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'platform-users',
        data: { permission: 'admins' },
        loadComponent: () =>
          import('./pages/admin-shell/platform-users/platform-users').then((m) => m.PlatformUsers),
      },
      {
        path: 'roles-permissions',
        data: { permission: 'admins' },
        loadComponent: () =>
          import('./pages/admin-shell/roles-permissions/roles-permissions').then(
            (m) => m.RolesPermissions,
          ),
      },
      {
        path: 'audit-logs',
        data: { permission: 'audit' },
        loadComponent: () =>
          import('./pages/admin-shell/audit-logs/audit-logs').then((m) => m.AuditLogs),
      },
      {
        path: 'settings',
        data: { permission: 'settings' },
        loadComponent: () =>
          import('./pages/admin-shell/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  {
    path: 'company',
    canActivate: [companyGuard],
    canActivateChild: [companyGuard],
    loadComponent: () => import('./pages/company-shell/company-shell').then((m) => m.CompanyShell),
    children: [
      {
        path: 'office/cities',
        data: { officeView: 'cities', ownerOnly: true, permission: 'leads.read' },
        loadComponent: () =>
          import('./pages/company-shell/office/cities/cities').then((m) => m.Cities),
      },
      {
        path: 'office/my-team',
        data: { officeView: 'my-team', permission: 'team.self.read' },
        loadComponent: () =>
          import('./pages/company-shell/office/office-my-team').then((m) => m.OfficeMyTeam),
      },
      {
        path: 'office/pipeline',
        data: { officeView: 'pipeline', permission: 'leads.read' },
        loadComponent: () =>
          import('./pages/company-shell/office/office-pipeline').then((m) => m.OfficePipeline),
      },
      {
        path: 'office/dashboard',
        data: { officeView: 'dashboard', permission: 'leads.read' },
        loadComponent: () => import('./pages/company-shell/office/office').then((m) => m.Office),
      },
      {
        path: 'office/clients',
        data: { officeView: 'clients', permission: 'leads.read' },
        loadComponent: () => import('./pages/company-shell/office/office').then((m) => m.Office),
      },
      {
        path: 'office/properties',
        data: { officeView: 'properties', permission: 'units.read' },
        loadComponent: () => import('./pages/company-shell/office/office').then((m) => m.Office),
      },
      {
        path: 'office/bookings',
        data: { officeView: 'bookings', permission: 'reservations.read' },
        loadComponent: () => import('./pages/company-shell/office/office').then((m) => m.Office),
      },
      {
        path: 'office/deals',
        data: { officeView: 'deals', permission: 'reservations.read' },
        loadComponent: () => import('./pages/company-shell/office/office').then((m) => m.Office),
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'employee',
        data: { employeeView: true },
        loadComponent: () =>
          import('./pages/company-shell/employee/employee').then((m) => m.Employee),
      },
      {
        path: 'payroll',
        data: { accountingView: 'payroll' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance',
        data: { accountingView: 'overview' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/settings',
        data: { accountingView: 'settings' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/journals',
        data: { accountingView: 'journals' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/treasury',
        data: { accountingView: 'treasury' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/receivables-payables',
        data: { accountingView: 'obligations' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/commissions',
        data: { accountingView: 'commissions' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/expenses',
        data: { accountingView: 'expenses' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'finance/reports',
        data: { accountingView: 'reports' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'my-finance',
        data: { accountingView: 'self' },
        loadComponent: () =>
          import('./pages/company-shell/accounting/accounting').then((m) => m.Accounting),
      },
      {
        path: 'my-assets',
        data: { resourcesView: 'my-assets' },
        loadComponent: () =>
          import('./pages/company-shell/hr-resources/hr-resources').then((m) => m.HrResources),
      },
      {
        path: 'hr/assets',
        data: { resourcesView: 'assets', hrAccess: true },
        loadComponent: () =>
          import('./pages/company-shell/hr-resources/hr-resources').then((m) => m.HrResources),
      },
      {
        path: 'my-advances',
        data: { resourcesView: 'my-advances' },
        loadComponent: () =>
          import('./pages/company-shell/hr-resources/hr-resources').then((m) => m.HrResources),
      },
      {
        path: 'hr/salary-advances',
        data: { resourcesView: 'advances', financeAccess: true },
        loadComponent: () =>
          import('./pages/company-shell/hr-resources/hr-resources').then((m) => m.HrResources),
      },
      {
        path: 'my-attendance',
        data: { attendanceView: 'my' },
        loadComponent: () =>
          import('./pages/company-shell/attendance/attendance').then((m) => m.Attendance),
      },
      {
        path: 'team-attendance',
        data: { attendanceView: 'team' },
        loadComponent: () =>
          import('./pages/company-shell/attendance/attendance').then((m) => m.Attendance),
      },
      {
        path: 'hr/attendance',
        data: { attendanceView: 'company', hrAccess: true },
        loadComponent: () =>
          import('./pages/company-shell/attendance/attendance').then((m) => m.Attendance),
      },
      {
        path: 'hr/work-schedules',
        data: { attendanceView: 'schedules', hrAccess: true },
        loadComponent: () =>
          import('./pages/company-shell/attendance/attendance').then((m) => m.Attendance),
      },
      {
        path: 'my-leave',
        data: { leaveView: 'my' },
        loadComponent: () => import('./pages/company-shell/leave/leave').then((m) => m.Leave),
      },
      {
        path: 'leave-approvals',
        data: { leaveView: 'approvals' },
        loadComponent: () => import('./pages/company-shell/leave/leave').then((m) => m.Leave),
      },
      {
        path: 'hr/leave',
        data: { hrAccess: true, leaveView: 'manage' },
        loadComponent: () => import('./pages/company-shell/leave/leave').then((m) => m.Leave),
      },
      {
        path: 'hr/employees',
        data: { hrAccess: true, hrView: 'employees' },
        loadComponent: () => import('./pages/company-shell/hr/hr').then((m) => m.Hr),
      },
      {
        path: 'hr/departments',
        data: { hrAccess: true, hrView: 'departments' },
        loadComponent: () => import('./pages/company-shell/hr/hr').then((m) => m.Hr),
      },
      {
        path: 'hr/documents',
        data: { hrAccess: true, hrView: 'documents' },
        loadComponent: () => import('./pages/company-shell/hr/hr').then((m) => m.Hr),
      },
      {
        path: 'hr/onboarding',
        redirectTo: 'hr/employees',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        data: { crmView: true },
        loadComponent: () =>
          import('./pages/company-shell/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'pipeline',
        data: { permission: 'pipeline.read' },
        loadComponent: () =>
          import('./pages/company-shell/pipeline/pipeline').then((m) => m.Pipeline),
      },
      {
        path: 'cold-calls',
        data: { permission: 'leads.read', crmView: true },
        loadComponent: () =>
          import('./pages/company-shell/cold-calls/cold-calls').then((m) => m.ColdCalls),
      },
      {
        path: 'leads',
        data: { permission: 'leads.read' },
        loadComponent: () => import('./pages/company-shell/leads/leads').then((m) => m.Leads),
      },
      {
        path: 'contacts',
        data: { permission: 'contacts.read' },
        loadComponent: () =>
          import('./pages/company-shell/contacts/contacts').then((m) => m.Contacts),
      },
      {
        path: 'calendar',
        data: { permission: 'calendar.read' },
        loadComponent: () =>
          import('./pages/company-shell/calendar/calendar').then((m) => m.Calendar),
      },
      {
        path: 'tasks',
        data: { permission: 'tasks.read' },
        loadComponent: () => import('./pages/company-shell/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'catalog/developers',
        data: { permission: 'projects.read', view: 'devs' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'catalog/developers/:id',
        data: { permission: 'projects.read', view: 'dev' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'catalog/compounds',
        data: { permission: 'projects.read', view: 'cos' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'catalog/compounds/:id',
        data: { permission: 'projects.read', view: 'co' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'catalog/units',
        data: { permission: 'units.read', view: 'units' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'catalog/units/:id',
        data: { permission: 'units.read', view: 'unit' },
        loadComponent: () =>
          import('./pages/company-shell/inventory/inventory').then((m) => m.Inventory),
      },
      { path: 'catalog', redirectTo: 'catalog/developers', pathMatch: 'full' },
      { path: 'developers', redirectTo: 'catalog/developers', pathMatch: 'full' },
      { path: 'developers/:id', redirectTo: 'catalog/developers/:id', pathMatch: 'full' },
      { path: 'compounds', redirectTo: 'catalog/compounds', pathMatch: 'full' },
      { path: 'compounds/:id', redirectTo: 'catalog/compounds/:id', pathMatch: 'full' },
      { path: 'units/:id', redirectTo: 'catalog/units/:id', pathMatch: 'full' },
      { path: 'inventory', redirectTo: 'projects', pathMatch: 'full' },
      {
        path: 'inventory/developers',
        data: { permission: 'projects.read' },
        loadComponent: () =>
          import('./pages/company-shell/brokerage-developers/brokerage-developers').then(
            (m) => m.BrokerageDevelopers,
          ),
      },
      {
        path: 'projects',
        data: { permission: 'projects.read' },
        loadComponent: () =>
          import('./pages/company-shell/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'units',
        canActivate: [brokerageUnitsRedirect],
        data: { permission: 'units.read' },
        loadComponent: () => import('./pages/company-shell/units/units').then((m) => m.Units),
      },
      {
        path: 'reservations',
        canActivate: [brokerageReservationsRedirect],
        data: { permission: 'reservations.read' },
        loadComponent: () =>
          import('./pages/company-shell/reservations/reservations').then((m) => m.Reservations),
      },
      {
        path: 'deals',
        data: { permission: 'leads.read' },
        loadComponent: () => import('./pages/company-shell/deals/deals').then((m) => m.Deals),
      },
      {
        path: 'deal-commissions',
        data: { permission: 'leads.read' },
        loadComponent: () =>
          import('./pages/company-shell/deal-commissions/deal-commissions').then(
            (m) => m.DealCommissions,
          ),
      },
      {
        path: 'commission-scheme',
        data: { permission: 'commissions.read' },
        loadComponent: () =>
          import('./pages/company-shell/commission-scheme/commission-scheme').then(
            (m) => m.CommissionScheme,
          ),
      },
      {
        path: 'contracts',
        data: { permission: 'contracts.read' },
        loadComponent: () =>
          import('./pages/company-shell/contracts/contracts').then((m) => m.Contracts),
      },
      {
        path: 'commissions',
        data: { permission: 'commissions.read' },
        loadComponent: () =>
          import('./pages/company-shell/commissions/commissions').then((m) => m.Commissions),
      },
      {
        path: 'documents',
        data: { permission: 'documents.read' },
        loadComponent: () =>
          import('./pages/company-shell/documents/documents').then((m) => m.Documents),
      },
      {
        path: 'marketing',
        data: { permission: 'marketing.read' },
        loadComponent: () =>
          import('./pages/company-shell/marketing/marketing').then((m) => m.Marketing),
      },
      {
        path: 'ai-analytics',
        data: { permission: 'reports.read', ownerOnly: true, aiView: true },
        loadComponent: () =>
          import('./pages/company-shell/company-ai-analytics/company-ai-analytics').then(
            (m) => m.CompanyAiAnalytics,
          ),
      },
      {
        path: 'reports',
        data: { permission: 'reports.read' },
        loadComponent: () => import('./pages/company-shell/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'lead-routing',
        data: { permission: 'routing.read' },
        loadComponent: () =>
          import('./pages/company-shell/lead-routing/lead-routing').then((m) => m.LeadRouting),
      },
      {
        path: 'audit-log',
        data: { permission: 'audit.read' },
        loadComponent: () =>
          import('./pages/company-shell/audit-log/audit-log').then((m) => m.AuditLog),
      },
      {
        path: 'my-team',
        data: { permission: 'team.self.read' },
        loadComponent: () => import('./pages/company-shell/my-team/my-team').then((m) => m.MyTeam),
      },
      {
        path: 'team',
        data: { permission: 'team.read' },
        loadComponent: () => import('./pages/company-shell/team/team').then((m) => m.Team),
      },
    ],
  },
];
