import { Activate } from './activate';
import { adminGuard } from './auth.service';
import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminShell } from './pages/admin-shell/admin-shell';
import { Dashboard } from './pages/admin-shell/dashboard/dashboard';
import { Companies } from './pages/admin-shell/companies/companies';
import { Onboarding } from './pages/admin-shell/onboarding/onboarding';
import { SubscriptionPlans } from './pages/admin-shell/subscription-plans/subscription-plans';
import { Subscriptions } from './pages/admin-shell/subscriptions/subscriptions';
import { Billing } from './pages/admin-shell/billing/billing';
import { Payments } from './pages/admin-shell/payments/payments';
import { FeatureManagement } from './pages/admin-shell/feature-management/feature-management';
import { UsageLimits } from './pages/admin-shell/usage-limits/usage-limits';
import { Integrations } from './pages/admin-shell/integrations/integrations';
import { SystemHealth } from './pages/admin-shell/system-health/system-health';
import { SupportTickets } from './pages/admin-shell/support-tickets/support-tickets';
import { Announcements } from './pages/admin-shell/announcements/announcements';
import { PlatformUsers } from './pages/admin-shell/platform-users/platform-users';
import { RolesPermissions } from './pages/admin-shell/roles-permissions/roles-permissions';
import { AuditLogs } from './pages/admin-shell/audit-logs/audit-logs';
import { Settings } from './pages/admin-shell/settings/settings';
import { CompanyShell } from './pages/company-shell/company-shell';
import { Dashboard as CompanyDashboard } from './pages/company-shell/dashboard/dashboard';
import { Pipeline } from './pages/company-shell/pipeline/pipeline';
import { Leads } from './pages/company-shell/leads/leads';
import { Tasks } from './pages/company-shell/tasks/tasks';
import { Projects } from './pages/company-shell/projects/projects';
import { Units } from './pages/company-shell/units/units';
import { Reservations } from './pages/company-shell/reservations/reservations';
import { Contracts } from './pages/company-shell/contracts/contracts';
import { Commissions } from './pages/company-shell/commissions/commissions';
import { Documents } from './pages/company-shell/documents/documents';
import { Marketing } from './pages/company-shell/marketing/marketing';
import { Reports } from './pages/company-shell/reports/reports';
import { LeadRouting } from './pages/company-shell/lead-routing/lead-routing';
import { AuditLog } from './pages/company-shell/audit-log/audit-log';

export const routes: Routes = [
  { path: 'activate', component: Activate },
  { path: '', component: Login },
  {
    path: 'admin',
    component: AdminShell,
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'companies', data: { permission: 'co.view' }, component: Companies },
      { path: 'onboarding', data: { permission: 'co.create' }, component: Onboarding },
      { path: 'subscription-plans', data: { permission: 'plans' }, component: SubscriptionPlans },
      { path: 'subscriptions', data: { permission: 'sub.manage' }, component: Subscriptions },
      { path: 'billing', data: { permission: 'billing' }, component: Billing },
      { path: 'payments', data: { permission: 'billing' }, component: Payments },
      {
        path: 'feature-management',
        data: { permission: 'features' },
        component: FeatureManagement,
      },
      { path: 'usage-limits', data: { permission: 'usage' }, component: UsageLimits },
      { path: 'integrations', data: { permission: 'integrations' }, component: Integrations },
      { path: 'system-health', data: { permission: 'health' }, component: SystemHealth },
      { path: 'support-tickets', data: { permission: 'support' }, component: SupportTickets },
      { path: 'announcements', data: { permission: 'ann' }, component: Announcements },
      { path: 'platform-users', data: { permission: 'admins' }, component: PlatformUsers },
      { path: 'roles-permissions', data: { permission: 'admins' }, component: RolesPermissions },
      { path: 'audit-logs', data: { permission: 'audit' }, component: AuditLogs },
      { path: 'settings', data: { permission: 'settings' }, component: Settings },
    ],
  },
  {
    path: 'company',
    component: CompanyShell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: CompanyDashboard },
      { path: 'pipeline', component: Pipeline },
      { path: 'leads', component: Leads },
      { path: 'tasks', component: Tasks },
      { path: 'projects', component: Projects },
      { path: 'units', component: Units },
      { path: 'reservations', component: Reservations },
      { path: 'contracts', component: Contracts },
      { path: 'commissions', component: Commissions },
      { path: 'documents', component: Documents },
      { path: 'marketing', component: Marketing },
      { path: 'reports', component: Reports },
      { path: 'lead-routing', component: LeadRouting },
      { path: 'audit-log', component: AuditLog },
    ],
  },
];
