import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
export function toMinor(value: string): string {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Enter a positive amount with at most two decimal places');
  const [whole, fraction = ''] = value.trim().split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result <= 0n || result > 1000000000000n)
    throw new Error('Amount is outside the allowed range');
  return String(result);
}
@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly auth = inject(AuthService);
  readonly counts = signal<{ invoices?: number; payments?: number }>({});
  async list<T>(resource: 'invoices' | 'payments'): Promise<T[]> {
    const list: T[] = [];
    let page = 1;
    while (true) {
      const result = await this.auth.request(
        '/admin/api/v1/' + resource + '?page=' + page + '&limit=100',
      );
      list.push(...result.items);
      if (list.length >= result.total || !result.items.length) {
        this.counts.update((c) => ({ ...c, [resource]: list.length }));
        return list;
      }
      page++;
    }
  }
  details(resource: string, id: string) {
    return this.auth.request('/admin/api/v1/' + resource + '/' + encodeURIComponent(id));
  }
  create(body: unknown) {
    return this.auth.request('/admin/api/v1/invoices', body);
  }
  invoice(id: string, action: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/invoices/' + encodeURIComponent(id) + '/' + action,
      body,
    );
  }
  payment(id: string, action: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/payments/' + encodeURIComponent(id) + '/' + action,
      body,
    );
  }
}
