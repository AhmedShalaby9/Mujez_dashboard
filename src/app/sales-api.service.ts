import { compactMoney, compactAmountInput, parseCompactAmount } from './compact-numbers';
import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
export const SALES_STAGES = [
  'new',
  'attempting',
  'contacted',
  'qualified',
  'nurturing',
  'unresponsive',
  'viewing',
  'offer',
  'contract',
  'won',
  'lost',
  'unqualified',
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];
export const BROKERAGE_LEAD_STATUSES = [
  'new_lead',
  'call_back',
  'hot_case',
  'low_budget',
  'no_answer',
  'non_potential',
  'potential',
  'resale',
  'wrong_number',
  'switched_off',
  'whatsapp',
  'closed_deal',
  'closed_outside',
  'eoi',
  'meeting_scheduled',
  'meeting_done',
] as const;
export type BrokerageLeadStatus = (typeof BROKERAGE_LEAD_STATUSES)[number];
/** Stages that take a lead out of the active pipeline. */
export const CLOSED_STAGES: readonly SalesStage[] = ['won', 'lost', 'unqualified'];
export const isClosedStage = (s: string) => (CLOSED_STAGES as readonly string[]).includes(s);
export interface SalesLead {
  id: string;
  reference: string;
  name: { en: string; ar: string };
  phone: string;
  email?: string | null;
  lastActivityAt?: string | null;
  stageChangedAt?: string | null;
  segment: 'res' | 'com';
  want: { en: string; ar: string };
  budgetMinor: string | null;
  currency: string;
  source: string;
  campaign?: { id: string; name: { en: string; ar: string } } | null;
  assignedAt?: string | null;
  slaDueAt?: string | null;
  routingAttempts?: number;
  routingRule?: { id: string; name: { en: string; ar: string } } | null;
  owner: { id: string; name: string } | null;
  stage: SalesStage;
  brokerageStatus?: BrokerageLeadStatus | null;
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
  segment?: 'res' | 'com';
  stageChangedAt?: string | null;
  id: string;
  opportunityId?: string | null;
  reference: string;
  leadId: string;
  leadReference: string;
  title: { en: string; ar: string } | null;
  contact: { en: string; ar: string };
  valueMinor: string | null;
  type: 'sale' | 'lease' | null;
  owner: { id: string; name: string } | null;
  stage: SalesStage;
  brokerageStatus?: BrokerageLeadStatus | null;
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
    attempting: 'Attempting Contact',
    contacted: 'Contacted',
    qualified: 'Qualified',
    nurturing: 'Nurturing',
    unresponsive: 'Unresponsive',
    viewing: 'Viewing Scheduled',
    offer: 'Negotiation',
    contract: 'Contract',
    won: 'Won',
    lost: 'Lost',
    unqualified: 'Unqualified',
    new_lead: 'New Lead',
    call_back: 'Call Back',
    hot_case: 'Hot Case',
    low_budget: 'Low Budget',
    no_answer: 'No Answer',
    non_potential: 'Non Potential',
    potential: 'Potential',
    resale: 'Resale',
    wrong_number: 'Wrong Number',
    switched_off: 'Switched Off',
    whatsapp: 'WhatsApp',
    closed_deal: 'Closed Deal',
    closed_outside: 'Closed Outside',
    eoi: 'EOI',
    meeting_scheduled: 'Meeting Scheduled',
    meeting_done: 'Meeting Done',
  },
  ar: {
    new: 'جديد',
    attempting: 'محاولة تواصل',
    contacted: 'تم التواصل',
    qualified: 'مؤهّل',
    nurturing: 'قيد المتابعة',
    unresponsive: 'لا يرد',
    viewing: 'معاينة مجدولة',
    offer: 'تفاوض',
    contract: 'عقد',
    won: 'مغلق',
    lost: 'فاقد',
    unqualified: 'غير مؤهّل',
    new_lead: 'عميل جديد',
    call_back: 'إعادة اتصال',
    hot_case: 'حالة مهمة',
    low_budget: 'ميزانية منخفضة',
    no_answer: 'لا يرد',
    non_potential: 'غير محتمل',
    potential: 'محتمل',
    resale: 'إعادة بيع',
    wrong_number: 'رقم خاطئ',
    switched_off: 'الهاتف مغلق',
    whatsapp: 'واتساب',
    closed_deal: 'صفقة مغلقة',
    closed_outside: 'أُغلقت خارج المكتب',
    eoi: 'إبداء اهتمام',
    meeting_scheduled: 'اجتماع مجدول',
    meeting_done: 'تم الاجتماع',
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
  return compactMoney(value);
}
export function majorAmount(value: string | null) {
  return value === null ? '' : compactAmountInput(value);
}
export function minorAmount(value: string, optional = false) {
  if (!value.trim() && optional) return null;
  return parseCompactAmount(value);
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
