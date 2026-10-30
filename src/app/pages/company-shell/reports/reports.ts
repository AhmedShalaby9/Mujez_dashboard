import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';
import {
  CompanyInsightsApi,
  type CompanyReport,
  volumePercent,
} from '../../../company-insights-api.service';
import { AuthService } from '../../../auth.service';
import { SOURCE_NAMES, STAGE_NAMES } from '../../../sales-api.service';
type Period = 'month' | 'quarter' | 'ytd';
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  periodNames: Record<Period, string>;
  exportBtn: string;
  volumeTitle: string;
  funnelTitle: string;
  sourcesTitle: string;
  agentsTitle: string;
  thSource: string;
  thLeads: string;
  thConversion: string;
  thAgent: string;
  thDeals: string;
  thRevenue: string;
  toastExported: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Growth',
    title: 'Reports',
    sub: 'Current signed sales and retained lead cohorts, including archived leads. Cairo calendar dates.',
    periodNames: { month: 'This month', quarter: 'This quarter', ytd: 'YTD' },
    exportBtn: 'Export CSV',
    volumeTitle: 'Currently signed sale value by month',
    funnelTitle: 'Current cohort stages (exclusive)',
    sourcesTitle: 'Lead sources',
    agentsTitle: 'Current assignees / contract owners (top 100)',
    thSource: 'Source',
    thLeads: 'Leads',
    thConversion: 'Conversion',
    thAgent: 'Agent',
    thDeals: 'Deals',
    thRevenue: 'Signed sale value',
    toastExported: 'Report exported.',
  },
  ar: {
    eyebrow: 'النمو',
    title: 'التقارير',
    sub: 'العقود الموقعة حاليًا والعملاء خلال الفترة بما فيهم المؤرشفون. بتوقيت القاهرة.',
    periodNames: { month: 'هذا الشهر', quarter: 'هذا الربع', ytd: 'منذ بداية السنة' },
    exportBtn: 'تصدير CSV',
    volumeTitle: 'قيمة المبيعات الموقعة شهريًا',
    funnelTitle: 'المرحلة الحالية للعملاء خلال الفترة',
    sourcesTitle: 'مصادر العملاء',
    agentsTitle: 'المسند إليهم وملاك العقود (أول ١٠٠)',
    thSource: 'المصدر',
    thLeads: 'العملاء',
    thConversion: 'التحويل',
    thAgent: 'الوكيل',
    thDeals: 'الصفقات',
    thRevenue: 'قيمة البيع الموقّع',
    toastExported: 'تم تصدير التقرير.',
  },
};

@Component({ selector: 'app-reports', templateUrl: './reports.html', styleUrl: './reports.scss' })
export class Reports {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  readonly auth = inject(AuthService);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly ar = computed(() => this.lang() === 'ar');
  readonly L = computed(() => COPY[this.lang()]);
  readonly period = signal<Period>('quarter');
  readonly periods: Period[] = ['month', 'quarter', 'ytd'];
  readonly data = signal<CompanyReport | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly canExport = computed(() => !!this.auth.user()?.permissions.includes('reports.export'));
  private generation = 0;
  constructor() {
    void this.load();
  }
  async load(period = this.period()) {
    this.period.set(period);
    const n = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.data.set(null);
    try {
      const d = await this.api.get<CompanyReport>('/reports', { period });
      if (n === this.generation) this.data.set(d);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
  readonly maxFunnel = computed(() =>
    Math.max(1, ...(this.data()?.funnel ?? []).map((f) => f.count)),
  );
  percent(v: string) {
    return volumePercent(v, this.data()?.volume ?? []);
  }
  sourceName(k: string) {
    return SOURCE_NAMES[k]?.[this.ar() ? 1 : 0] ?? k;
  }
  stageName(k: string) {
    return (STAGE_NAMES[this.lang()] as Record<string, string>)[k] ?? k;
  }
  async exportCsv() {
    if (this.exporting() || !this.canExport()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      const r = await this.api.exportReport(this.period(), this.lang());
      const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.exporting.set(false);
    }
  }
}
