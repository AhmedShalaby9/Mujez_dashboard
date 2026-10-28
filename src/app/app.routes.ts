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

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'admin',
    component: AdminShell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'companies', component: Companies },
      { path: 'onboarding', component: Onboarding },
      { path: 'subscription-plans', component: SubscriptionPlans },
      { path: 'subscriptions', component: Subscriptions },
      { path: 'billing', component: Billing },
      { path: 'payments', component: Payments },
      { path: 'feature-management', component: FeatureManagement },
      { path: 'usage-limits', component: UsageLimits },
      { path: 'integrations', component: Integrations },
      { path: 'system-health', component: SystemHealth },
    ],
  },
];
