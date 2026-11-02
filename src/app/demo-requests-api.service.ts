import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
export type DemoStatus = 'new' | 'contacted' | 'closed';
export interface DemoRequest {
  id: string;
  reference: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  plan: string | null;
  cycle: 'monthly' | 'annual';
  status: DemoStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface DemoPage {
  items: DemoRequest[];
  total: number;
  page: number;
  limit: number;
  summary: Record<'all' | DemoStatus, number>;
}
@Injectable({ providedIn: 'root' })
export class DemoRequestsApi {
  private readonly auth = inject(AuthService);
  list(page: number, status: 'all' | DemoStatus, q: string): Promise<DemoPage> {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (status !== 'all') params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    return this.auth.request('/admin/api/v1/demo-requests?' + params);
  }
  status(row: DemoRequest, status: DemoStatus) {
    return this.auth.request(
      '/admin/api/v1/demo-requests/' + encodeURIComponent(row.id) + '/status',
      { version: row.version, status },
    );
  }
}
