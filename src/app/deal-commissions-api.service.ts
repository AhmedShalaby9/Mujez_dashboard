import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export interface CommissionEntry {
  id: string;
  dealId: string;
  userId: string;
  userName: string;
  amountMinor: string;
  note: string;
  createdAt: string;
  clientName: string;
  unitValueMinor: string;
  posted: boolean;
}
export interface CommissionOptions {
  deals: { id: string; clientName: string; unitValueMinor: string }[];
  people: { id: string; name: string }[];
  canManage: boolean;
}
@Injectable({ providedIn: 'root' })
export class DealCommissionsApi {
  private readonly api = inject(SalesApi);
  options() {
    return this.api.get('brokerage/commissions/options') as Promise<CommissionOptions>;
  }
  list(q: Record<string, string> = {}) {
    return this.api.get('brokerage/commissions', q) as Promise<{
      items: CommissionEntry[];
      total: number;
      page: number;
      limit: number;
      canManage: boolean;
    }>;
  }
  create(dealId: string, entries: { userId: string; amountMinor: string; note?: string }[]) {
    return this.api.write('brokerage/commissions', { dealId, entries }) as Promise<{
      ids: string[];
    }>;
  }
}
