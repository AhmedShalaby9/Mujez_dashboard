import { inject, Injectable, signal } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { RUNTIME_CONFIG } from './runtime-config';
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  rolesVersion?: number;
  roleName?: { en: string; ar: string };
  permissions: string[];
  pool: string;
  mustChangePassword?: boolean;
  companyId?: string;
  company?: {
    id: string;
    slug: string;
    name: { en: string; ar: string };
    status: string;
    hrEnabled?: boolean;
    financeEnabled?: boolean;
    aiEnabled?: boolean;
    type?: string;
  };
  /** Present only when this session is a platform admin inside a controlled workspace session. */
  workspace?: {
    sessionId: string;
    mode: 'read' | 'manage';
    reason: string | null;
    startedAt: string;
    manageExpiresAt: string | null;
    platformUserName: string;
    platformRoleName?: { en: string; ar: string };
    company: {
      id: string;
      uuid: string;
      type?: string;
      slug: string;
      name: { en: string; ar: string };
      status: string;
    };
  };
}
export function officeWorkspace(u: User | null | undefined) {
  return (u?.company?.type ?? u?.workspace?.company?.type) === 'real_estate_office';
}
export const brokerageReservationsRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (auth.user()?.company?.type ?? auth.user()?.workspace?.company?.type) === 'brokerage'
    ? router.createUrlTree(['/company/deals'])
    : true;
};
export function hrModuleEnabled(u: User | null | undefined) {
  return !!u && u.company?.hrEnabled !== false;
}
/** Brokerage and office sales users can create leads; other workspaces retain their existing rule. */
export function canCreateLead(u: User | null | undefined) {
  if (!u?.permissions.includes('leads.manage')) return false;
  const companyType = u.company?.type ?? u.workspace?.company?.type;
  if (officeWorkspace(u) || companyType === 'brokerage') return true;
  const roles = u.roles ?? [u.role];
  return !(u.pool === 'company_user' && roles.includes('agent') && !roles.includes('team_lead'));
}
export function hasCrmWorkspace(u: User | null | undefined) {
  return !!u && (u.pool === 'company_admin' || u.permissions.includes('leads.read'));
}
export function employeeArea(u: User | null | undefined) {
  return !!u && u.pool === 'company_user' && (u.roles ?? [u.role]).includes('employee');
}
export function companyHomePath(u: User | null | undefined) {
  if (officeWorkspace(u) && hasCrmWorkspace(u)) return '/company/office/dashboard';
  if (u?.pool === 'company_user' && !u.permissions.includes('leads.read')) {
    if (hasAccountingAccess(u)) return '/company/finance';
    if (hasPayrollAccess(u)) return '/company/payroll';
    if (hasHrAccess(u)) return '/company/hr/employees';
    if (employeeArea(u)) return '/company/employee';
  }
  return '/company/dashboard';
}
/** HR company access is an explicit module grant; CRM scope stays personal. */
export function hasHrAccess(u: User | null | undefined) {
  if (!u || u.workspace || !hrModuleEnabled(u)) return false;
  if (u.pool === 'company_admin' && u.role === 'company_owner')
    return u.permissions.includes('workspace.view');
  return (
    u.pool === 'company_user' &&
    u.permissions.includes('hr.read') &&
    (u.roles ?? [u.role]).some((r) => r === 'hr_manager' || r === 'hr_officer')
  );
}
export function aiModuleEnabled(u: User | null | undefined) {
  return !!u && u.company?.aiEnabled !== false;
}
export function financeModuleEnabled(u: User | null | undefined) {
  return !!u && u.company?.financeEnabled !== false;
}
export function hasAccountingAccess(u: User | null | undefined, permission = 'finance.read') {
  if (!u || u.workspace || !financeModuleEnabled(u)) return false;
  if (u.pool === 'company_admin' && u.role === 'company_owner')
    return u.permissions.includes('workspace.view');
  return (
    u.pool === 'company_user' &&
    (u.roles ?? [u.role]).some((r) => r === 'accountant' || r === 'finance_manager') &&
    u.permissions.includes(permission)
  );
}
export function hasPayrollAccess(u: User | null | undefined) {
  if (!financeModuleEnabled(u)) return false;
  return (
    hasAccountingAccess(u) ||
    (!!u &&
      !u.workspace &&
      u.pool === 'company_user' &&
      (u.roles ?? [u.role]).includes('payroll_officer') &&
      u.permissions.includes('payroll.read'))
  );
}
export function hasAccountingSelf(u: User | null | undefined) {
  if (!financeModuleEnabled(u)) return false;
  return (
    !!u &&
    !u.workspace &&
    u.pool === 'company_user' &&
    (u.roles ?? [u.role]).some((r) => r === 'agent' || r === 'team_lead') &&
    u.permissions.includes('commissions.read')
  );
}
export function hasFinanceAccess(u: User | null | undefined) {
  if (!u || u.workspace || !hrModuleEnabled(u)) return false;
  if (u.pool === 'company_admin' && u.role === 'company_owner')
    return u.permissions.includes('workspace.view');
  return (
    u.pool === 'company_user' &&
    (u.roles ?? [u.role]).includes('hr_manager') &&
    u.permissions.includes('leave.approve') &&
    u.permissions.includes('leave.manage')
  );
}
export function hasLeaveSelf(u: User | null | undefined) {
  return (
    !!u &&
    hrModuleEnabled(u) &&
    !u.workspace &&
    u.pool === 'company_user' &&
    (u.roles ?? [u.role]).includes('employee') &&
    u.permissions.includes('leave.self')
  );
}
export function managesLeave(u: User | null | undefined) {
  return (
    hasHrAccess(u) &&
    ((u?.role === 'company_owner' && u?.pool === 'company_admin') ||
      !!u?.permissions.includes('leave.manage'))
  );
}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly details: Record<string, any>,
  ) {
    super(
      Array.isArray(details['message'])
        ? details['message'].join(', ')
        : details['message'] || 'Request failed (' + status + ')',
    );
  }
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(RUNTIME_CONFIG);
  readonly user = signal<User | null>(null);
  /** Number of in-flight GET requests (excluding session checks). */
  readonly pending = signal(0);
  /** Requests started while a navigation is being watched (page's initial data). */
  readonly watched = signal(0);
  watching = false;
  async request(path: string, body?: unknown) {
    const track = body === undefined && !path.includes('/auth/session');
    const watch = track && this.watching;
    if (track) this.pending.update((n) => n + 1);
    if (watch) this.watched.update((n) => n + 1);
    try {
      return await this.rawRequest(path, body);
    } finally {
      if (track) this.pending.update((n) => Math.max(0, n - 1));
      if (watch) this.watched.update((n) => Math.max(0, n - 1));
    }
  }
  private async rawRequest(path: string, body?: unknown) {
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const response = await fetch(this.config.apiUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: body === undefined || multipart ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined
        ? {}
        : { body: multipart ? (body as FormData) : JSON.stringify(body) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(response.status, body);
    }
    return response.json();
  }
  async restore(allowCached = false) {
    if (allowCached && this.user()) {
      void this.restore(); // refresh in background
      return true;
    }
    try {
      const user = await this.request('/api/v1/auth/session');
      if (!['platform', 'company_admin', 'company_user'].includes(user.pool))
        throw new Error('403');
      this.user.set(user);
      return true;
    } catch {
      this.user.set(null);
      return false;
    }
  }
  async login(email: string, password: string, remember: boolean) {
    await this.request('/api/v1/auth/login', { email, password, remember });
    if (!(await this.restore())) throw new Error('401');
  }
  homePath() {
    return this.user()?.mustChangePassword
      ? '/change-password'
      : this.user()?.pool === 'platform'
        ? '/admin/dashboard'
        : companyHomePath(this.user());
  }
  async logout() {
    await this.request('/api/v1/auth/logout', {});
    this.user.set(null);
  }
}
export const adminGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore(true))) return router.createUrlTree(['/']);
  if (auth.user()?.mustChangePassword) return router.createUrlTree(['/change-password']);
  if (auth.user()?.pool !== 'platform') return router.createUrlTree(['/company/dashboard']);
  const permission = route.data['permission'];
  return !permission || auth.user()?.permissions.includes(permission)
    ? true
    : router.createUrlTree(['/admin/dashboard']);
};

export const companyGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore(true))) return router.createUrlTree(['/']);
  if (auth.user()?.mustChangePassword) return router.createUrlTree(['/change-password']);
  const u = auth.user();
  if (officeWorkspace(u) && hasCrmWorkspace(u) && !route.data['officeView']) {
    const segment = route.routeConfig?.path ?? '';
    const targets: Record<string, string> = {
      dashboard: 'dashboard',
      leads: 'clients',
      pipeline: 'pipeline',
      'my-team': 'my-team',
      projects: 'properties',
      units: 'properties',
      reservations: 'bookings',
      contracts: 'deals',
      commissions: 'dashboard',
      documents: 'deals',
      reports: 'dashboard',
      'ai-analytics': 'clients',
      'lead-routing': 'clients',
    };
    if (targets[segment]) return router.parseUrl('/company/office/' + targets[segment]);
    if (segment === 'finance' || segment.startsWith('finance/'))
      return router.parseUrl('/company/office/dashboard');
  }
  if (route.data['aiView'] && !aiModuleEnabled(u)) return router.parseUrl(companyHomePath(u));
  if (u?.pool === 'platform' && !u?.workspace) return router.createUrlTree(['/admin/dashboard']);
  const isOwner =
    u?.pool === 'company_admin' &&
    u?.role === 'company_owner' &&
    u?.permissions.includes('workspace.view');
  const isWorkspace = u?.pool === 'company_admin' && !!u?.workspace;
  const isEmployee = u?.pool === 'company_user';
  if (
    route.data['accountingView'] &&
    !(route.data['accountingView'] === 'self'
      ? hasAccountingSelf(u)
      : route.data['accountingView'] === 'payroll'
        ? hasPayrollAccess(u)
        : hasAccountingAccess(u))
  )
    return router.parseUrl(companyHomePath(u));
  if (route.data['employeeView'] && !employeeArea(u)) return router.parseUrl(companyHomePath(u));
  if (route.data['officeView'] && (!officeWorkspace(u) || !hasCrmWorkspace(u)))
    return router.parseUrl(companyHomePath(u));
  if (route.data['crmView'] && !hasCrmWorkspace(u)) return router.parseUrl(companyHomePath(u));
  if (
    (route.data['hrAccess'] ||
      route.data['leaveView'] ||
      route.data['attendanceView'] ||
      route.data['resourcesView']) &&
    !hrModuleEnabled(u)
  )
    return router.parseUrl(companyHomePath(u));
  if (route.data['financeAccess'] && !hasFinanceAccess(u))
    return router.parseUrl(companyHomePath(u));
  if (String(route.data['resourcesView'] ?? '').startsWith('my-') && !hasLeaveSelf(u) && !isOwner)
    return router.parseUrl(companyHomePath(u));
  if (route.data['attendanceView'] === 'my' && !hasLeaveSelf(u) && !isOwner)
    return router.parseUrl(companyHomePath(u));
  if (route.data['attendanceView'] === 'team') {
    try {
      const c = await auth.request('/api/v1/attendance/context');
      if (!c.isManager) return router.parseUrl(companyHomePath(u));
    } catch {
      return router.parseUrl(companyHomePath(u));
    }
  }
  if (route.data['leaveView'] === 'manage' && !managesLeave(u))
    return router.parseUrl(companyHomePath(u));
  if (route.data['leaveView'] === 'my' && !hasLeaveSelf(u) && !isOwner)
    return router.parseUrl(companyHomePath(u));
  if (route.data['leaveView'] === 'approvals') {
    try {
      const c = await auth.request('/api/v1/leave/context');
      if (!c.isManager && !c.canFinalize) return router.parseUrl(companyHomePath(u));
    } catch {
      return router.parseUrl(companyHomePath(u));
    }
  }
  if (route.data['hrAccess'] && !hasHrAccess(u)) return router.parseUrl(companyHomePath(u));
  if (route.data['ownerOnly'] && (!isOwner || isWorkspace))
    return router.parseUrl(companyHomePath(u));
  return isOwner || isWorkspace || isEmployee
    ? !route.data['permission'] || u?.permissions.includes(route.data['permission'])
      ? true
      : router.parseUrl(companyHomePath(u))
    : router.createUrlTree(['/']);
};

export const passwordChangeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/']);
  return auth.user()?.pool === 'company_admin' &&
    auth.user()?.role === 'company_owner' &&
    auth.user()?.mustChangePassword
    ? true
    : router.parseUrl(auth.homePath());
};
