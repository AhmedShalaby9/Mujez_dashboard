import { Injectable, inject } from '@angular/core';
import { InventoryApi } from './inventory-api.service';
export interface Volume {
  month: string;
  deals: number;
  valueMinor: string;
}
export interface CompanyReport {
  asOf: string;
  from: string;
  to: string;
  timeZone: string;
  volume: Volume[];
  funnel: { key: string; count: number }[];
  sources: { key: string; leads: number; won: number; conversion: number | null }[];
  owners: {
    id: string | null;
    name: string | null;
    leads: number;
    deals: number;
    saleValueMinor: string;
  }[];
  summary: {
    leads: number;
    signedSales: number;
    signedSaleValueMinor: string;
    recordedPaidCommissionMinor: string | null;
  };
}
export interface AuditEntry {
  id: string;
  actor: { id: string; name: string | null } | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  at: string;
}
export interface AuditPage {
  items: AuditEntry[];
  total: number;
  nextCursor: string | null;
  asOf: string;
  timeZone: string;
}
export interface Overview {
  asOf: string;
  today: string;
  timeZone: string;
  segment: string;
  metrics: {
    pipeline?: { saleValueMinor: string; saleCount: number; leaseCount: number };
    newLeads7d?: number;
    todayTasks?: number;
    paidCommissionMtd?: string;
    projects?: number;
  };
  todayTasks:
    | {
        id: string;
        title: { en: string; ar: string };
        priority: string;
        leadId: string | null;
        assignee: string | null;
      }[]
    | null;
  scoredLeads:
    | {
        id: string;
        reference: string;
        name: { en: string; ar: string };
        want: { en: string; ar: string };
        budgetMinor: string | null;
        score: number;
        owner: string | null;
      }[]
    | null;
  keyDates:
    | {
        id: string;
        reference: string;
        title: { en: string; ar: string };
        valueMinor: string;
        date: string;
        status: string;
        owner: string | null;
      }[]
    | null;
  attentionLeads:
    { id: string; reference: string; name: { en: string; ar: string }; attempts: number }[] | null;
  inventory: Record<string, number> | null;
  chart: Volume[] | null;
  alerts: { id: string; count: number; route: string }[];
}
export function volumePercent(value: string, rows: Volume[]): number {
  const max = rows.reduce((m, r) => (BigInt(r.valueMinor) > m ? BigInt(r.valueMinor) : m), 0n);
  return max === 0n ? 0 : Number((BigInt(value) * 10000n) / max) / 100;
}
@Injectable({ providedIn: 'root' })
export class CompanyInsightsApi {
  readonly api = inject(InventoryApi);
  get<T>(path: string, query: Record<string, string> = {}) {
    return this.api.get<T>(path.replace(/^\//, ''), query);
  }
  money(v: string | null) {
    return this.api.money(v);
  }
  exportReport(period: string, lang: string) {
    return this.api.write<{ fileName: string; content: string }>('reports/export', {
      period,
      lang,
    });
  }
}
