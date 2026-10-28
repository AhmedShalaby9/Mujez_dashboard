import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  readonly counts = signal<{ companies?: number; onboarding?: number }>({});
  private readonly auth = inject(AuthService);
  async list<T>(onboarding = false): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    while (true) {
      const result = await this.auth.request(
        '/admin/api/v1/companies?page=' +
          page +
          '&limit=100' +
          (onboarding ? '&onboarding=true' : ''),
      );
      items.push(...result.items);
      if (items.length >= result.total || !result.items.length) {
        this.counts.update((c) => ({
          ...c,
          [onboarding ? 'onboarding' : 'companies']: items.length,
        }));
        return items;
      }
      page++;
    }
  }
  create(body: unknown) {
    return this.auth.request('/admin/api/v1/companies', body);
  }
  change(id: string, action: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/companies/' + encodeURIComponent(id) + '/' + action,
      body,
    );
  }
}
