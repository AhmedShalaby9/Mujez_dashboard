import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Range = '30d' | '90d' | '12m' | 'custom';

interface Kpi {
  label: string;
  value: string;
  sub: string;
  fg?: string;
}

interface Alert {
  text: string;
  color: string;
}

interface GrowthRow {
  label: string;
  value: string;
  delta: string;
}

interface DonutSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  exportBtn: string;
  kpis: Kpi[];
  revenueTitle: string;
  ranges: Record<Range, string>;
  legendMrr: string;
  legendNew: string;
  legendExpansion: string;
  legendLost: string;
  planTitle: string;
  alertsTitle: string;
  growthTitle: string;
  alerts: Alert[];
  growth: GrowthRow[];
  planNames: string[];
}

// ---- fictional demo data (12 trailing months, EGP '000 MRR) ----
const MONTHS_EN = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const MONTHS_AR = ['نوف', 'ديس', 'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت'];
const MRR_SERIES = [1420, 1455, 1480, 1510, 1540, 1525, 1575, 1610, 1650, 1695, 1780, 1860];
const PLAN_COUNTS = [150, 128, 107, 43]; // Starter, Pro, Business, Enterprise — sums to total companies KPI
const PLAN_COLORS = ['#C3C5D6', '#3D4FD6', '#7E89E6', '#F5B841'];

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Overview',
    title: 'Dashboard',
    exportBtn: 'Export report',
    kpis: [
      { label: 'Total companies', value: '428', sub: 'All companies' },
      { label: 'Active', value: '391', sub: 'Currently active', fg: '#2F7A4F' },
      { label: 'Trial', value: '24', sub: 'In trial period' },
      { label: 'Suspended', value: '13', sub: 'Payment or security', fg: '#B4442F' },
      { label: 'CRM users', value: '6,284', sub: 'Across all companies' },
      { label: 'MRR', value: 'EGP 1.86M', sub: 'Monthly recurring revenue', fg: '#3D4FD6' },
      { label: 'ARR', value: 'EGP 22.3M', sub: 'Annualized', fg: '#3D4FD6' },
      { label: 'Churn', value: '2.1%', sub: 'Last 30 days', fg: '#B4442F' },
    ],
    revenueTitle: 'Revenue growth',
    ranges: { '30d': '30 days', '90d': '90 days', '12m': '12 months', custom: 'Custom' },
    legendMrr: 'MRR',
    legendNew: 'New',
    legendExpansion: 'Expansion',
    legendLost: 'Lost',
    planTitle: 'Plan distribution',
    alertsTitle: 'Alerts',
    growthTitle: 'Company growth',
    alerts: [
      { text: 'Al Qahira Developments — payment failed (3rd attempt)', color: '#B4442F' },
      { text: 'Nile View Realty — trial ends in 2 days', color: '#C8862E' },
      { text: 'Deira Properties — approaching 90% of unit limit', color: '#C8862E' },
      { text: 'New company created: Coastal Homes', color: '#3D4FD6' },
    ],
    growth: [
      { label: 'Al Qahira Developments', value: '+86 users', delta: '+18%' },
      { label: 'Nile View Realty', value: '+54 users', delta: '+12%' },
      { label: 'Deira Properties', value: '+41 users', delta: '+9%' },
      { label: 'Coastal Homes', value: '+33 users', delta: '+22%' },
      { label: 'Smart Spaces', value: '+28 users', delta: '+7%' },
    ],
    planNames: ['Starter', 'Pro', 'Business', 'Enterprise'],
  },
  ar: {
    eyebrow: 'نظرة عامة',
    title: 'لوحة التحكم',
    exportBtn: 'تصدير التقرير',
    kpis: [
      { label: 'إجمالي الشركات', value: '428', sub: 'كل الشركات' },
      { label: 'نشطة', value: '391', sub: 'نشطة حاليًا', fg: '#2F7A4F' },
      { label: 'تجريبية', value: '24', sub: 'في الفترة التجريبية' },
      { label: 'موقوفة', value: '13', sub: 'لأسباب دفع أو أمنية', fg: '#B4442F' },
      { label: 'مستخدمو CRM', value: '6,284', sub: 'عبر جميع الشركات' },
      { label: 'MRR', value: '1.86M ج.م', sub: 'الإيراد الشهري المتكرر', fg: '#3D4FD6' },
      { label: 'ARR', value: '22.3M ج.م', sub: 'الإيراد السنوي', fg: '#3D4FD6' },
      { label: 'التسرب', value: '2.1%', sub: 'آخر 30 يومًا', fg: '#B4442F' },
    ],
    revenueTitle: 'نمو الإيرادات',
    ranges: { '30d': '30 يومًا', '90d': '90 يومًا', '12m': '12 شهرًا', custom: 'مخصص' },
    legendMrr: 'الإيراد الشهري',
    legendNew: 'جديد',
    legendExpansion: 'توسّع',
    legendLost: 'مفقود',
    planTitle: 'توزيع الخطط',
    alertsTitle: 'التنبيهات',
    growthTitle: 'نمو الشركات',
    alerts: [
      { text: 'القاهرة للتطوير — فشل الدفع (المحاولة الثالثة)', color: '#B4442F' },
      { text: 'نايل فيو العقارية — تنتهي الفترة التجريبية خلال يومين', color: '#C8862E' },
      { text: 'ديرة العقارية — اقتربت من 90% من حد الوحدات', color: '#C8862E' },
      { text: 'تم إنشاء شركة جديدة: كوستال هومز', color: '#3D4FD6' },
    ],
    growth: [
      { label: 'القاهرة للتطوير', value: '+86 مستخدم', delta: '+18%' },
      { label: 'نايل فيو العقارية', value: '+54 مستخدم', delta: '+12%' },
      { label: 'ديرة العقارية', value: '+41 مستخدم', delta: '+9%' },
      { label: 'كوستال هومز', value: '+33 مستخدم', delta: '+22%' },
      { label: 'سمارت سبيسز', value: '+28 مستخدم', delta: '+7%' },
    ],
    planNames: ['أساسية', 'احترافية', 'أعمال', 'مؤسسات'],
  },
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly range = signal<Range>('12m');
  readonly ranges: Range[] = ['30d', '90d', '12m', 'custom'];

  readonly months = computed(() => (this.lang() === 'ar' ? MONTHS_AR : MONTHS_EN));

  private readonly chartMin = 1300;
  private readonly chartMax = 1900;
  private readonly chartTop = 20;
  private readonly chartBase = 165;

  private valueToY(v: number): number {
    const ratio = (v - this.chartMin) / (this.chartMax - this.chartMin);
    return this.chartBase - ratio * (this.chartBase - this.chartTop);
  }

  readonly bars = computed(() => {
    const months = this.months();
    return MRR_SERIES.map((v, i) => {
      const x = i * 50 + 7;
      const y = this.valueToY(v);
      const prev = i === 0 ? 1390 : MRR_SERIES[i - 1];
      return {
        x,
        y,
        w: 36,
        h: this.chartBase - y,
        c: v < prev ? '#C8862E' : '#3D4FD6',
        month: months[i],
      };
    });
  });

  readonly linePoints = computed(() =>
    this.bars()
      .map((b) => `${b.x + b.w / 2},${b.y}`)
      .join(' '),
  );

  readonly dots = computed(() => this.bars().map((b) => ({ cx: b.x + b.w / 2, cy: b.y })));

  readonly axisLabels = computed(() =>
    this.bars()
      .filter((_, i) => i % 2 === 0)
      .map((b, idx, arr) => ({
        x: b.x + b.w / 2,
        t: b.month,
        a: idx === 0 ? 'start' : idx === arr.length - 1 ? 'end' : 'middle',
      })),
  );

  readonly revenueLegend = computed(() => {
    const l = this.L();
    const newSum = MRR_SERIES.reduce((sum, v, i) => {
      const prev = i === 0 ? 1390 : MRR_SERIES[i - 1];
      return v > prev ? sum + (v - prev) : sum;
    }, 0);
    const lostSum = MRR_SERIES.reduce((sum, v, i) => {
      const prev = i === 0 ? 1390 : MRR_SERIES[i - 1];
      return v < prev ? sum + (prev - v) : sum;
    }, 0);
    return [
      { label: l.legendMrr, value: 'EGP 1.86M', color: '#16182A' },
      { label: l.legendNew, value: `EGP ${newSum}K`, color: '#3D4FD6' },
      { label: l.legendExpansion, value: 'EGP 62K', color: '#7E89E6' },
      { label: l.legendLost, value: `EGP ${lostSum}K`, color: '#C8862E' },
    ];
  });

  readonly donut = computed(() => {
    const total = PLAN_COUNTS.reduce((a, b) => a + b, 0);
    const circumference = 2 * Math.PI * 40;
    let offsetAcc = 0;
    const names = this.L().planNames;
    return PLAN_COUNTS.map((count, i): DonutSlice & { dash: string; off: number } => {
      const pct = Math.round((count / total) * 100);
      const dashLen = (count / total) * circumference;
      const slice = {
        label: names[i],
        count,
        pct,
        color: PLAN_COLORS[i],
        dash: `${dashLen} ${circumference - dashLen}`,
        off: -offsetAcc,
      };
      offsetAcc += dashLen;
      return slice;
    });
  });

  setRange(r: Range): void {
    this.range.set(r);
  }
}
