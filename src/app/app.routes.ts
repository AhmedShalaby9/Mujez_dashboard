import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdminShell } from './pages/admin-shell/admin-shell';
import { Dashboard } from './pages/admin-shell/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'admin',
    component: AdminShell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
    ],
  },
];
