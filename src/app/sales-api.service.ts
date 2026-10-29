import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
export const SALES_STAGES = [
  'new',
  'qualified',
  'viewing',
  'offer',
  'contract',
  'won',
  'lost',
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];
export interface SalesLead {
  id: string;
  reference: string;
  name: { en: string; ar: string };
  phone: string;
  segment: 'res' | 'com';
  want: { en: string; ar: string };
  budgetMinor: string | null;
  currency: string;
  source: string;
  owner: { id: string; name: string } | null;
  stage: SalesStage;
  score: number | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sample: boolean;
  opportunity: {
    id: string;
    reference: string;
    title: { en: string; ar: string };
    valueMinor: string;
    type: 'sale' | 'lease';
    version: number;
  } | null;
  related?: Array<{
    id: string;
    reference: string;
    name: { en: string; ar: string };
    archivedAt: string | null;
  }>;
}
export interface SalesDeal {
  id: string;
  reference: string;
  leadId: string;
  leadReference: string;
  title: { en: string; ar: string };
  contact: { en: string; ar: string };
  valueMinor: string;
  type: 'sale' | 'lease';
  owner: { id: string; name: string } | null;
  stage: SalesStage;
  version: number;
  leadVersion: number;
  sample: boolean;
}
export interface SalesActivity {
  id: string;
  kind: string;
  details: Record<string, any>;
  at: string;
  actor: string | null;
}
export const STAGE_NAMES = {
  en: {
    new: 'New',
    qualified: 'Qualified',
    viewing: 'Viewing',
    offer: 'Offer',
    contract: 'Contract',
    won: 'Won',
    lost: 'Lost',
  },
  ar: {
    new: 'جديد',
    qualified: 'مؤهّل',
    viewing: 'معاينة',
    offer: 'عرض',
    contract: 'عقد',
    won: 'مغلق',
    lost: 'فاقد',
  },
};
export const SOURCE_NAMES: Record<string, [string, string]> = {
  manual: ['Manual', 'يدوي'],
  referral: ['Referral', 'توصية'],
  website: ['Website', 'الموقع'],
  phone: ['Phone', 'الهاتف'],
  walk_in: ['Walk-in', 'زيارة'],
  social: ['Social media', 'التواصل الاجتماعي'],
  other: ['Other', 'أخرى'],
};
export function salesMoney(value: string | null) {
  if (value === null) return '—';
  const n = BigInt(value);
  return 'EGP ' + (n / 100n).toLocaleString('en-GB') + '.' + String(n % 100n).padStart(2, '0');
}
export function majorAmount(value: string | null) {
  if (value === null) return '';
  const n = BigInt(value);
  return String(n / 100n) + '.' + String(n % 100n).padStart(2, '0');
}
export function minorAmount(value: string, optional = false) {
  const s = value.trim();
  if (!s && optional) return null;
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(s))
    throw Error('Enter an EGP amount with up to two decimal places');
  const [a, b = ''] = s.split('.');
  return (BigInt(a) * 100n + BigInt(b.padEnd(2, '0'))).toString();
}
@Injectable({ providedIn: 'root' })
export class SalesApi {
  private readonly auth = inject(AuthService);
  get(path: string, query: Record<string, string> = {}) {
    const suffix = new URLSearchParams(query).toString();
    return this.auth.request('/api/v1/' + path + (suffix ? '?' + suffix : ''));
  }
  write(path: string, body: Record<string, unknown>) {
    return this.auth.request('/api/v1/' + path, {
      ...body,
      requestId: body['requestId'] ?? crypto.randomUUID(),
    });
  }
}
