import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
export interface OverviewAlert {
  id: string;
  kind: string;
  severity: 'high' | 'med' | 'low';
  nameEn: string;
  nameAr: string;
  value: string;
  path: string;
}
export interface OverviewData {
  asOf: string;
  window: { range: string; from: string; to: string; bucket: string };
  companies: null | {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    archived: number;
    added: number;
    crmUsers: string;
  };
  finance: null | {
    currency: string;
    mrrMinor: string;
    arrMinor: string;
    grossMinor: string;
    refundMinor: string;
    netMinor: string;
    series: Array<{ date: string; grossMinor: string; refundMinor: string; netMinor: string }>;
  };
  plans: Array<{ key: string; name: { en: string; ar: string }; companies: number }>;
  growth: Array<{ id: string; name: { en: string; ar: string }; createdAt: string; users: number }>;
  alerts: OverviewAlert[];
  sampleDataIncluded: boolean;
  capabilities: { companies: boolean; finance: boolean; historicalMrr: boolean; churn: boolean };
}
export function overviewMoney(value: string, lang = 'en') {
  const n = BigInt(value),
    a = n < 0n ? -n : n;
  return (
    (n < 0n ? '-' : '') +
    'EGP ' +
    (a / 100n).toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB') +
    '.' +
    String(a % 100n).padStart(2, '0')
  );
}
export function overviewAlertText(a: OverviewAlert, lang = 'en') {
  const name = lang === 'ar' ? a.nameAr : a.nameEn;
  const label: Record<string, [string, string]> = {
    invoice_overdue: ['Overdue invoice balance', 'رصيد فاتورة متأخرة'],
    trial_ending: ['Trial ends soon', 'الفترة التجريبية تنتهي قريبًا'],
    support_overdue: ['Support ticket overdue SLA', 'تذكرة دعم تجاوزت موعد الخدمة'],
    user_limit: ['Approaching user quota', 'اقتراب عدد المستخدمين من الحد'],
    company_created: ['Company registered', 'تم تسجيل شركة'],
  };
  return (
    name +
    ' — ' +
    (label[a.kind]?.[lang === 'ar' ? 1 : 0] ?? a.kind) +
    (a.kind === 'invoice_overdue' ? ' · ' + overviewMoney(a.value, lang) : '')
  );
}
@Injectable({ providedIn: 'root' })
export class OverviewApi {
  private readonly auth = inject(AuthService);
  readonly alerts = signal<OverviewAlert[]>([]);
  readonly alertError = signal('');
  private owner: string | undefined;
  private identity() {
    const id = this.auth.user()?.id;
    if (this.owner !== id) {
      this.owner = id;
      this.alerts.set([]);
      this.alertError.set('');
    }
    return id;
  }
  async load(params: Record<string, string>): Promise<OverviewData> {
    const owner = this.identity();
    const data = await this.auth.request('/admin/api/v1/overview?' + new URLSearchParams(params));
    if (owner === this.auth.user()?.id) {
      this.alerts.set(data.alerts);
      this.alertError.set('');
    }
    return data;
  }
  async refreshAlerts() {
    const owner = this.identity();
    try {
      const r = await this.auth.request('/admin/api/v1/overview/alerts');
      if (owner === this.auth.user()?.id) {
        this.alerts.set(r.items);
        this.alertError.set('');
      }
    } catch (e) {
      if (owner === this.auth.user()?.id) this.alertError.set((e as Error).message);
    }
  }
}
