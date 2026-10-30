import { Injectable, inject } from '@angular/core';
import { InventoryApi } from './inventory-api.service';
export interface Campaign {
  id: string;
  name: { en: string; ar: string };
  source: string;
  projectId: string | null;
  project: { en: string; ar: string } | null;
  status: 'draft' | 'active' | 'ended';
  spendMinor: string;
  leads: number;
  deals: number;
  saleValueMinor: string;
  cplMinor: string | null;
  version: number;
  archivedAt: string | null;
  sample: boolean;
}
export interface RoutingRule {
  id: string;
  name: { en: string; ar: string };
  source: string | null;
  segment: string | null;
  minBudgetMinor: string | null;
  strategy: 'round_robin' | 'weighted' | 'specific_user' | 'team';
  teamName: { en: string; ar: string } | null;
  slaMinutes: number;
  active: boolean;
  priority: string;
  version: number;
  archivedAt: string | null;
  sample: boolean;
  targets: Array<{ userId: string; name: string; weight: number; active: boolean }>;
}
@Injectable({ providedIn: 'root' })
export class CompanyGrowthApi {
  readonly api = inject(InventoryApi);
  get<T>(p: string, q: Record<string, string> = {}) {
    return this.api.get<T>(p, q);
  }
  write<T>(p: string, b: Record<string, unknown>) {
    return this.api.write<T>(p, b);
  }
  money(v: string | null) {
    return this.api.money(v);
  }
}
