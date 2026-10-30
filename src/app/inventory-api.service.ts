import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export interface LocalName {
  en: string;
  ar: string;
}
export interface Building {
  id: string;
  code: string;
  name: LocalName;
  floors: number;
  version: number;
}
export interface Phase {
  id: string;
  code: string;
  name: LocalName;
  deliveryYear: number;
  version: number;
  buildings: Building[];
}
export interface Project {
  id: string;
  code: string;
  name: LocalName;
  developer: LocalName;
  location: LocalName;
  segment: 'res' | 'com';
  version: number;
  archivedAt: string | null;
  sample: boolean;
  total: number;
  available: number;
  heldOrReserved: number;
  sold: number;
  underContract: number;
  fromPriceMinor: string | null;
  currency: string;
  phases: Phase[];
}
export interface InventoryUnit {
  id: string;
  code: string;
  buildingId: string | null;
  building: LocalName | null;
  phaseId: string | null;
  phase: LocalName | null;
  projectId: string | null;
  project: LocalName;
  projectArchived: boolean;
  listing: 'primary' | 'resale' | 'rental';
  location: LocalName;
  type: 'apt' | 'villa' | 'office' | 'retail';
  bedrooms: number | null;
  area: string;
  view: LocalName;
  floor: number | null;
  priceMinor: string;
  currency: string;
  status: 'available' | 'hold' | 'reserved' | 'under_contract' | 'sold';
  version: number;
  archivedAt: string | null;
  sample: boolean;
}
@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly api = inject(SalesApi);
  get<T>(path: string, query: Record<string, string> = {}) {
    return this.api.get(path, query) as Promise<T>;
  }
  write<T>(path: string, body: Record<string, unknown>) {
    return this.api.write(path, body) as Promise<T>;
  }
  money(v: string | null) {
    if (v === null) return '—';
    const n = BigInt(v);
    return (
      'EGP ' + (n / 100n).toLocaleString('en-US') + '.' + (n % 100n).toString().padStart(2, '0')
    );
  }
}
