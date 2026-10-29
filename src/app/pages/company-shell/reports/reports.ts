import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type Period = 'month' | 'quarter' | 'ytd';

interface MonthVolume {
  label: string;
  value: number;
}

interface FunnelStage {
  key: string;
  name: string;
  nameAr: string;
  count: number;
}

interface SourceRow {
  source: string;
  sourceAr: string;
  leads: number;
  conversion: number;
}

interface AgentRow {
  agent: string;
  agentAr: string;
  leads: number;
  deals: number;
  revenue: number;
}

const VOLUME: MonthVolume[] = [
  { label: 'May', value: 42 },
  { label: 'Jun', value: 58 },
  { label: 'Jul', value: 51 },
  { label: 'Aug', value: 66 },
  { label: 'Sep', value: 74 },
  { label: 'Oct', value: 81 },
];

const FUNNEL: FunnelStage[] = [
  { key: 'new', name: 'New', nameAr: 'جديد', count: 420 },
  { key: 'qualified', name: 'Qualified', nameAr: 'مؤهّل', count: 260 },
  { key: 'viewing', name: 'Viewing', nameAr: 'معاينة', count: 140 },
  { key: 'offer', name: 'Offer', nameAr: 'عرض', count: 76 },
  { key: 'contract', name: 'Contract', nameAr: 'عقد', count: 48 },
  { key: 'won', name: 'Won', nameAr: 'مغلق', count: 34 },
];

const SOURCES: SourceRow[] = [
  { source: 'Property Finder', sourceAr: 'بروبرتي فايندر', leads: 310, conversion: 11 },
  { source: 'Facebook', sourceAr: 'فيسبوك', leads: 420, conversion: 8 },
  { source: 'Referral', sourceAr: 'توصية', leads: 95, conversion: 24 },
  { source: 'Google Ads', sourceAr: 'جوجل', leads: 180, conversion: 10 },
  { source: 'Instagram', sourceAr: 'انستجرام', leads: 260, conversion: 5 },
  { source: 'Walk-in', sourceAr: 'زيارة مباشرة', leads: 40, conversion: 15 },
];

const AGENTS: AgentRow[] = [
  { agent: 'Dina El Sayed', agentAr: 'دينا السيد', leads: 112, deals: 14, revenue: 68_400_000 },
  { agent: 'Youssef Mansour', agentAr: 'يوسف منصور', leads: 98, deals: 11, revenue: 42_100_000 },
  { agent: 'Khaled Nabil', agentAr: 'خالد نبيل', leads: 86, deals: 9, revenue: 51_200_000 },
  { agent: 'Rana Farouk', agentAr: 'رنا فاروق', leads: 74, deals: 6, revenue: 19_800_000 },
];

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
    sub: 'Closed volume, conversion funnel, lead sources and agent performance.',
    periodNames: { month: 'This month', quarter: 'This quarter', ytd: 'YTD' },
    exportBtn: 'Export CSV',
    volumeTitle: 'Closed volume by month',
    funnelTitle: 'Conversion funnel by stage',
    sourcesTitle: 'Lead sources',
    agentsTitle: 'Agent performance',
    thSource: 'Source',
    thLeads: 'Leads',
    thConversion: 'Conversion',
    thAgent: 'Agent',
    thDeals: 'Deals',
    thRevenue: 'Revenue',
    toastExported: 'Report exported.',
  },
  ar: {
    eyebrow: 'النمو',
    title: 'التقارير',
    sub: 'حجم المبيعات وقمع التحويل ومصادر العملاء وأداء الوكلاء.',
    periodNames: { month: 'هذا الشهر', quarter: 'هذا الربع', ytd: 'منذ بداية السنة' },
    exportBtn: 'تصدير CSV',
    volumeTitle: 'حجم الإغلاق شهريًا',
    funnelTitle: 'قمع التحويل حسب المرحلة',
    sourcesTitle: 'مصادر العملاء',
    agentsTitle: 'أداء الوكلاء',
    thSource: 'المصدر',
    thLeads: 'العملاء',
    thConversion: 'التحويل',
    thAgent: 'الوكيل',
    thDeals: 'الصفقات',
    thRevenue: 'الإيرادات',
    toastExported: 'تم تصدير التقرير.',
  },
};

@Component({
  selector: 'app-reports',
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly period = signal<Period>('quarter');
  readonly periods: Period[] = ['month', 'quarter', 'ytd'];

  readonly volume = VOLUME;
  readonly maxVolume = Math.max(...VOLUME.map((v) => v.value));
  readonly funnel = FUNNEL;
  readonly maxFunnel = FUNNEL[0].count;
  readonly sources = SOURCES;
  readonly agents = AGENTS;

  funnelName(f: FunnelStage): string {
    return this.ar() ? f.nameAr : f.name;
  }
  sourceName(s: SourceRow): string {
    return this.ar() ? s.sourceAr : s.source;
  }
  agentName(a: AgentRow): string {
    return this.ar() ? a.agentAr : a.agent;
  }
  money(n: number): string {
    if (n >= 1_000_000) return 'EGP ' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    return 'EGP ' + n.toLocaleString('en-US');
  }

  readonly toast = signal<string | null>(null);
  exportCsv(): void {
    this.toast.set(this.L().toastExported);
    setTimeout(() => this.toast.set(null), 2600);
  }
}
