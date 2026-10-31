import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export const CONTACT_TYPES = [
  'buyer',
  'seller',
  'landlord',
  'tenant',
  'investor',
  'developer',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export interface Contact {
  id: string;
  reference: string;
  type: ContactType;
  name: { en: string; ar: string };
  companyName: string;
  phones: string[];
  emails: string[];
  area: string;
  tags: string[];
  owner: { id: string; name: string } | null;
  clientSince: string | null;
  notes: string;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sample: boolean;
}
@Injectable({ providedIn: 'root' })
export class ContactsApi {
  readonly sales = inject(SalesApi);
  list(q: Record<string, string>) {
    return this.sales.get('contacts', q);
  }
  options() {
    return this.sales.get('contacts/options');
  }
  get(id: string) {
    return this.sales.get('contacts/' + id);
  }
  activity(id: string, page = 1) {
    return this.sales.get('contacts/' + id + '/activities', { page: String(page) });
  }
  write(path: string, body: Record<string, unknown>) {
    return this.sales.write('contacts' + path, body);
  }
}
