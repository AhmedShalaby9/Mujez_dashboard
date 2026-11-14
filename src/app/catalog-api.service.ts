import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
export type CatalogKind = 'developers' | 'compounds' | 'units';
export interface Bi {
  en: string;
  ar: string;
}
export interface CatalogPreference {
  followed: boolean;
  favorite: boolean;
  muted: boolean;
  alerts: { units: boolean; price: boolean; launch: boolean; news: boolean };
}
export interface CatalogData {
  description?: Bi;
  location?: Bi;
  type?: string;
  listing?: string;
  top?: boolean;
  verified?: boolean;
  founded?: number;
  delivered?: number;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  cover?: string;
  photos?: string[];
  floorPlan?: string;
  video?: string;
  brochure?: string;
  masterPlan?: string;
  map?: string;
  bathrooms?: number;
  floor?: number;
  deliveryYear?: number;
  finishing?: Bi;
  acreage?: number;
  facilities?: Bi[];
  faqs?: { question: Bi; answer: Bi }[];
  phases?: { name: Bi; deliveryYear?: number }[];
  paymentPlans?: { name: Bi; downPercent: number; years: number }[];
  seller?: { name: string; phone: string };
}
export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  parentId: string | null;
  name: Bi;
  status: string;
  priceMinor: string | null;
  area: string | null;
  bedrooms: number | null;
  data: CatalogData;
  version: number;
  followers: number;
  children: number;
  available: number;
  fromPriceMinor: string | null;
  preference: CatalogPreference;
  parent?: { id: string; kind: CatalogKind; name: Bi; parentId: string | null } | null;
}
export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
}
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly auth = inject(AuthService);
  list(kind: CatalogKind, query: Record<string, string> = {}): Promise<CatalogPage> {
    return this.auth.request('/api/v1/catalog/' + kind + '?' + new URLSearchParams(query));
  }
  detail(kind: CatalogKind, id: string): Promise<CatalogItem> {
    return this.auth.request('/api/v1/catalog/' + kind + '/' + id);
  }
  save(kind: CatalogKind, body: Record<string, unknown>, id?: string): Promise<CatalogItem> {
    return this.auth.request('/api/v1/catalog/' + kind + (id ? '/' + id + '/update' : ''), body);
  }
  archive(item: CatalogItem) {
    return this.auth.request('/api/v1/catalog/' + item.kind + '/' + item.id + '/archive', {
      version: item.version,
    });
  }
  preference(item: CatalogItem, body: Partial<CatalogPreference>): Promise<CatalogPreference> {
    return this.auth.request('/api/v1/catalog/' + item.kind + '/' + item.id + '/preference', body);
  }
}
