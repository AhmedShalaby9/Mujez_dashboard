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

export const routes: Routes = [
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
    ],
  },
];
