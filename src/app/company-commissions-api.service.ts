import { Injectable, inject } from '@angular/core';
import { CompanyFinanceApi } from './company-finance-api.service';
export interface CompanyCommission {
  id: string;
  contractId: string;
  leadId: string;
  deal: string;
  unit: string | null;
  contact: { en: string; ar: string };
  contractStatus: string;
  agreedValueMinor: string;
  grossMinor: string;
  rateBps: number;
  lines: Array<{
    payeeId: string | null;
    who: { en: string; ar: string };
    shareBps: number;
    amountMinor: string;
  }>;
  status: 'calculated' | 'approved' | 'payable' | 'paid' | 'canceled';
  forecast: boolean;
  needsRecalculation: boolean;
  version: number;
  sample: boolean;
  paymentReference: string | null;
  paidDate: string | null;
  paidAt: string | null;
  payableDocumentId: string | null;
  paidDocumentId: string | null;
  reason: string | null;
}
@Injectable({ providedIn: 'root' })
export class CompanyCommissionsApi {
  readonly api = inject(CompanyFinanceApi);
  get<T>(p: string, q: Record<string, string> = {}) {
    return this.api.get<T>(p, q);
  }
  write<T>(p: string, b: Record<string, unknown>) {
    return this.api.write<T>(p, b);
  }
  money(v: string) {
    return this.api.money(v);
  }
  download(id: string) {
    return this.api.downloadUrl(id);
  }
}
