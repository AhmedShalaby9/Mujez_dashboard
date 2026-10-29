import { adminGuard, companyGuard } from './auth.service';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'activate/company', loadComponent: () => import('./activate').then((m) => m.Activate) },
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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
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
        path: 'leads',
        data: { permission: 'leads.read' },
        loadComponent: () => import('./pages/company-shell/leads/leads').then((m) => m.Leads),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/company-shell/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/company-shell/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'units',
        loadComponent: () => import('./pages/company-shell/units/units').then((m) => m.Units),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./pages/company-shell/reservations/reservations').then((m) => m.Reservations),
      },
      {
        path: 'contracts',
        loadComponent: () =>
          import('./pages/company-shell/contracts/contracts').then((m) => m.Contracts),
      },
      {
        path: 'commissions',
        loadComponent: () =>
          import('./pages/company-shell/commissions/commissions').then((m) => m.Commissions),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./pages/company-shell/documents/documents').then((m) => m.Documents),
      },
      {
        path: 'marketing',
        loadComponent: () =>
          import('./pages/company-shell/marketing/marketing').then((m) => m.Marketing),
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/company-shell/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'lead-routing',
        loadComponent: () =>
          import('./pages/company-shell/lead-routing/lead-routing').then((m) => m.LeadRouting),
      },
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./pages/company-shell/audit-log/audit-log').then((m) => m.AuditLog),
      },
    ],
  },
];
