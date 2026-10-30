import { Injectable, inject } from '@angular/core';
import { InventoryApi } from './inventory-api.service';
export interface CompanyReservation {
  id: string;
  reference: string;
  unitId: string;
  unit: string;
  leadId: string;
  contact: { en: string; ar: string };
  leadReference: string;
  leadArchived: boolean;
  assignee: { id: string; name: string } | null;
  status: 'hold' | 'reserved' | 'converted' | 'expired' | 'canceled';
  expiresAt: string;
  depositMinor: string | null;
  confirmedAt: string | null;
  canceledAt: string | null;
  reason: string | null;
  version: number;
  sample: boolean;
  asOf: string;
}
@Injectable({ providedIn: 'root' })
export class ReservationsApi {
  readonly api = inject(InventoryApi);
  list(q: Record<string, string>) {
    return this.api.get<{ items: CompanyReservation[]; total: number; asOf: string }>(
      'reservations',
      q,
    );
  }
  write(path: string, b: Record<string, unknown>) {
    return this.api.write<CompanyReservation>(path, b);
  }
}
