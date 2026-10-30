import { inject, Injectable, signal } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { RUNTIME_CONFIG } from './runtime-config';
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName?: { en: string; ar: string };
  permissions: string[];
  pool: string;
  companyId?: string;
  company?: { id: string; slug: string; name: { en: string; ar: string }; status: string };
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
  async request(path: string, body?: unknown) {
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
  async restore() {
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
    return this.user()?.pool === 'platform' ? '/admin/dashboard' : '/company/dashboard';
  }
  async logout() {
    await this.request('/api/v1/auth/logout', {});
    this.user.set(null);
  }
}
export const adminGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/']);
  if (auth.user()?.pool !== 'platform') return router.createUrlTree(['/company/dashboard']);
  const permission = route.data['permission'];
  return !permission || auth.user()?.permissions.includes(permission)
    ? true
    : router.createUrlTree(['/admin/dashboard']);
};

export const companyGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/']);
  if (auth.user()?.pool === 'platform') return router.createUrlTree(['/admin/dashboard']);
  return auth.user()?.pool === 'company_admin' &&
    auth.user()?.role === 'company_owner' &&
    auth.user()?.permissions.includes('workspace.view')
    ? !route.data['permission'] || auth.user()?.permissions.includes(route.data['permission'])
      ? true
      : router.createUrlTree(['/company/dashboard'])
    : router.createUrlTree(['/']);
};
