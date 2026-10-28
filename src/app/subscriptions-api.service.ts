import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
@Injectable({ providedIn: 'root' })
export class SubscriptionsApi {
  private readonly auth = inject(AuthService);
  readonly count = signal<number | undefined>(undefined);
  plans(options = false) {
    return this.auth.request('/admin/api/v1/' + (options ? 'plan-options' : 'plans'));
  }
  async subscriptions<T>(): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    while (true) {
      const data = await this.auth.request(
        '/admin/api/v1/subscriptions?page=' + page + '&limit=100',
      );
      items.push(...data.items);
      if (items.length >= data.total || !data.items.length) {
        this.count.set(items.length);
        return items;
      }
      page++;
    }
  }
  savePlan(body: unknown, key?: string) {
    return this.auth.request('/admin/api/v1/plans' + (key ? '/' + key + '/update' : ''), body);
  }
  archive(key: string, version: number, archived: boolean) {
    return this.auth.request('/admin/api/v1/plans/' + key + '/archive', { version, archived });
  }
  create(body: unknown) {
    return this.auth.request('/admin/api/v1/subscriptions', body);
  }
  action(id: string, action: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/subscriptions/' + encodeURIComponent(id) + '/' + action,
      body,
    );
  }
}
