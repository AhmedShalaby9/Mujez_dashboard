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
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(RUNTIME_CONFIG);
  readonly user = signal<User | null>(null);
  async request(path: string, body?: unknown) {
    const response = await fetch(this.config.apiUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || 'Request failed (' + response.status + ')',
      );
    }
    return response.json();
  }
  async restore() {
    try {
      const user = await this.request('/admin/api/v1/auth/session');
      if (user.pool !== 'platform') throw new Error('403');
      this.user.set(user);
      return true;
    } catch {
      this.user.set(null);
      return false;
    }
  }
  async login(email: string, password: string, remember: boolean) {
    await this.request('/admin/api/v1/auth/login', { email, password, remember });
    if (!(await this.restore())) throw new Error('401');
  }
  async logout() {
    await this.request('/admin/api/v1/auth/logout', {});
    this.user.set(null);
  }
}
export const adminGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService),
    router = inject(Router);
  if (!(await auth.restore())) return router.createUrlTree(['/']);
  const permission = route.data['permission'];
  return !permission || auth.user()?.permissions.includes(permission)
    ? true
    : router.createUrlTree(['/admin/dashboard']);
};
