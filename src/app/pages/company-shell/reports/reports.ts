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

@Component({
  selector: 'app-reports',
  templateUrl: './reports.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './reports.scss',
  ],
})
export class Reports {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  readonly auth = inject(AuthService);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly ar = computed(() => this.lang() === 'ar');
  readonly L = computed(() => COPY[this.lang()]);
  readonly period = signal<Period>('quarter');
  readonly periods: Period[] = ['month', 'quarter', 'ytd'];
  /** Residential / Commercial filter — supported by GET /reports and the export. */
  readonly segment = signal<'all' | 'res' | 'com'>('all');
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
      const q: Record<string, string> = { period };
      if (this.segment() !== 'all') q['segment'] = this.segment();
      const d = await this.api.get<CompanyReport>('/reports', q);
      if (n === this.generation) this.data.set(d);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  setSegment(s: 'all' | 'res' | 'com') {
    this.segment.set(s);
    void this.load();
  }
  money(v: string | null) {
    return this.api.money(v);
  }
  pct(n: number, d: number) {
    return d ? Math.round((n / d) * 1000) / 10 + '%' : '—';
  }
  readonly stageColor: Record<string, string> = {
    new: '#C4C4BE',
    qualified: '#5B78E5',
    viewing: '#D99A28',
    offer: '#8BB33A',
    contract: '#111113',
    won: '#2FA35F',
    lost: '#E2553B',
  };
  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const s = d.summary;
    const won = d.sources.reduce((a, x) => a + x.won, 0);
    const avg = s.signedSales
      ? (BigInt(s.signedSaleValueMinor) / BigInt(s.signedSales)).toString()
      : null;
    return [
      {
        label: this.t('Signed sale value', 'قيمة المبيعات الموقعة'),
        value: this.money(s.signedSaleValueMinor),
        sub: this.t('sale contracts signed in the period', 'عقود بيع موقعة خلال الفترة'),
      },
      {
        label: this.t('Deals signed', 'صفقات موقعة'),
        value: String(s.signedSales),
        sub: avg ? this.t('avg ', 'متوسط ') + this.money(avg) : '—',
      },
      {
        label: this.t('Paid commission', 'العمولات المصروفة'),
        value:
          s.recordedPaidCommissionMinor === null ? '—' : this.money(s.recordedPaidCommissionMinor),
        sub:
          s.recordedPaidCommissionMinor === null
            ? this.t('needs commissions access', 'يتطلب صلاحية العمولات')
            : this.t('recorded as paid', 'مسجلة كمصروفة'),
      },
      {
        label: this.t('Lead → won', 'تحويل العميل لمكسوب'),
        value: this.pct(won, s.leads),
        sub: this.t(s.leads + ' leads in the period', s.leads + ' عميل خلال الفترة'),
      },
    ];
  });
  readonly maxVolume = computed(() =>
    Math.max(1, ...(this.data()?.volume ?? []).map((v) => Number(v.valueMinor))),
  );
  barHeight(v: string) {
    return (Number(v) / this.maxVolume()) * 170 + 'px';
  }
  month(m: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(m.slice(0, 7) + '-15T00:00:00Z'));
  }
  /**
   * Funnel from current stage counts: leads at or beyond each open stage (lost excluded).
   * The API returns exclusive current stages, not stage history.
   */
  readonly funnel = computed(() => {
    const f = (this.data()?.funnel ?? []).filter((x) => x.key !== 'lost');
    const reached = f.map((_, i) => f.slice(i).reduce((a, x) => a + x.count, 0));
    const top = Math.max(1, reached[0] ?? 0);
    return f.map((x, i) => ({
      key: x.key,
      n: reached[i],
      w: (reached[i] / top) * 100 + '%',
      conv: i && reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) + '%' : '',
    }));
  });
  readonly lost = computed(() => this.data()?.funnel.find((x) => x.key === 'lost')?.count ?? 0);
  readonly sourceRows = computed(() => {
    const src = (this.data()?.sources ?? []).filter((s) => s.leads > 0);
    const total = src.reduce((a, s) => a + s.leads, 0);
    const max = Math.max(1, ...src.map((s) => s.leads));
    return [...src]
      .sort((a, b) => b.leads - a.leads)
      .map((s) => ({
        ...s,
        share: this.pct(s.leads, total),
        bar: (s.leads / max) * 100 + '%',
      }));
  });
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
      const seg = this.segment();
      const r = await this.api.exportReport(
        this.period(),
        this.lang(),
        seg === 'all' ? undefined : seg,
      );
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
