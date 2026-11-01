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
  detail(id: string) {
    return this.auth.request('/admin/api/v1/companies/' + encodeURIComponent(id));
  }
  drafts(){return this.auth.request('/admin/api/v1/companies/drafts');}
  draft(id:string){return this.auth.request('/admin/api/v1/companies/drafts/'+encodeURIComponent(id));}
  saveDraft(body:unknown,id?:string){return this.auth.request('/admin/api/v1/companies/drafts'+(id?'/'+encodeURIComponent(id):''),body);}
  quote(body:unknown){return this.auth.request('/admin/api/v1/companies/quote',body);}
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
