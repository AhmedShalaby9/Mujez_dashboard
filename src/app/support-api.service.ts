import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
@Injectable({ providedIn: 'root' })
export class SupportApi {
  private readonly auth = inject(AuthService);
  readonly count = signal<number | undefined>(undefined);
  readonly kpis = signal({ open: 0, waiting: 0, overdue: 0, resolved: 0, active: 0 });
  async summary() {
    try {
      const s = await this.auth.request('/admin/api/v1/support-tickets/summary');
      this.count.set(s.active);
      this.kpis.set(s);
    } catch {
      this.count.set(undefined);
    }
  }
  async list<T>() {
    const items: T[] = [];
    let page = 1;
    while (true) {
      const r = await this.auth.request(
        '/admin/api/v1/support-tickets?page=' + page + '&limit=100',
      );
      items.push(...r.items);
      this.count.set(r.kpis.active);
      this.kpis.set(r.kpis);
      if (items.length >= r.total || !r.items.length) return items;
      page++;
    }
  }
  options() {
    return this.auth.request('/admin/api/v1/support-tickets/options');
  }
  detail<T>(id: string): Promise<T> {
    return this.auth.request('/admin/api/v1/support-tickets/' + encodeURIComponent(id));
  }
  create(body: unknown) {
    return this.auth.request('/admin/api/v1/support-tickets', body);
  }
  change(id: string, action: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/support-tickets/' + encodeURIComponent(id) + '/' + action,
      body,
    );
  }
}
