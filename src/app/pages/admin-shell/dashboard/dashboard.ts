import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';
import {
  OverviewApi,
  overviewMoney,
  overviewAlertText,
  type OverviewData,
  type OverviewAlert,
} from '../../../overview-api.service';
type Range = '30d' | '90d' | '12m' | 'custom';
const COLORS = ['#a1a1a6', '#111113', '#8BB33A', '#c8f169', '#1e6b3e', '#d99a28'];
const COPY = {
  en: {
    eyebrow: 'Overview',
    title: 'Dashboard',
    exportBtn: 'Export report',
    revenueTitle: 'Recorded payments and refunds',
    ranges: { '30d': '30 days', '90d': '90 days', '12m': '12 months', custom: 'Custom' },
    planTitle: 'Current subscriptions by plan',
    alertsTitle: 'Current alerts',
    growthTitle: 'Recently registered companies in selected range',
    emptyAlerts: 'No current alerts in your permitted modules',
    emptyGrowth: 'No companies registered in this range',
    sample:
      'Includes initial sample records; sample payments represent test entries, not external collections.',
    method:
      'MRR/ARR are current active contract values. The chart shows recorded payments and refunds, not historical MRR. Historical churn is not available.',
    emptyFinance: 'No recorded payments or refunds in this range',
    noFinance: 'Billing permission is required to view financial figures.',
    planNote:
      'Unexpired active, trial, past-due and suspended contracts for non-archived companies. Companies without a current contract are excluded.',
  },
  ar: {
    eyebrow: 'نظرة عامة',
    title: 'لوحة التحكم',
    exportBtn: 'تصدير التقرير',
    revenueTitle: 'المدفوعات والمبالغ المستردة المسجلة',
    ranges: { '30d': '30 يومًا', '90d': '90 يومًا', '12m': '12 شهرًا', custom: 'مخصص' },
    planTitle: 'الاشتراكات الحالية حسب الباقة',
    alertsTitle: 'التنبيهات الحالية',
    growthTitle: 'الشركات المسجلة حديثًا خلال الفترة المحددة',
    emptyAlerts: 'لا توجد تنبيهات حالية في الوحدات المسموح بها',
    emptyGrowth: 'لا توجد شركات جديدة خلال الفترة',
    sample: 'تشمل بيانات أولية تجريبية. المدفوعات التجريبية سجلات اختبار وليست تحصيلات خارجية.',
    method:
      'MRR وARR يعكسان العقود النشطة الحالية. الرسم يعرض المدفوعات والمبالغ المستردة المسجلة، وليس سجل MRR. التسرب التاريخي غير متاح.',
    emptyFinance: 'لا توجد مدفوعات أو مبالغ مستردة مسجلة في الفترة',
    noFinance: 'يلزم إذن الفوترة لعرض البيانات المالية.',
    planNote:
      'العقود غير المنتهية للشركات غير المؤرشفة، بما فيها التجريبية والمتأخرة والمعلقة. تستبعد الشركات دون عقد حالي.',
  },
};
@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly api = inject(OverviewApi);
  private readonly ui = inject(AdminUiState);
  private readonly destroy = inject(DestroyRef);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly data = signal<OverviewData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly range = signal<Range>('12m');
  readonly ranges: Range[] = ['30d', '90d', '12m', 'custom'];
  readonly from = signal('');
  readonly to = signal('');
  private serial = 0;
  constructor() {
    void this.reload();
    const timer = setInterval(() => {
      if (this.range() !== 'custom' || (this.from() && this.to())) void this.reload();
    }, 60000);
    this.destroy.onDestroy(() => {
      clearInterval(timer);
      this.serial++;
    });
  }
  async reload() {
    if (this.range() === 'custom' && (!this.from() || !this.to())) {
      this.error.set(
        this.lang() === 'ar' ? 'اختر بداية ونهاية الفترة' : 'Choose start and end dates',
      );
      return;
    }
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const d = await this.api.load({
        range: this.range(),
        ...(this.range() === 'custom' ? { from: this.from(), to: this.to() } : {}),
      });
      if (serial === this.serial) this.data.set(d);
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  setRange(r: Range) {
    this.range.set(r);
    if (r !== 'custom') void this.reload();
  }
  money(v: string) {
    return overviewMoney(v, this.lang());
  }
  date(v: string) {
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
    }).format(new Date(v));
  }
  alert(a: OverviewAlert) {
    return overviewAlertText(a, this.lang());
  }
  color(a: OverviewAlert) {
    return a.severity === 'high'
      ? '#e2553b'
      : a.severity === 'med'
        ? '#d99a28'
        : 'var(--platform-primary, #111113)';
  }
  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const ar = this.lang() === 'ar';
    const c = d.companies,
      f = d.finance;
    return [
      ...(c
        ? [
            {
              label: ar ? 'إجمالي الشركات' : 'Total companies',
              value: String(c.total),
              sub: ar ? 'يشمل المؤرشفة' : 'Includes archived',
            },
            {
              label: ar ? 'قيد الإعداد' : 'Pending onboarding',
              value: String(c.pending),
              sub: ar ? 'الحالة الحالية' : 'Current company status',
            },
            {
              label: ar ? 'نشطة' : 'Active',
              value: String(c.active),
              sub: ar ? 'الحالة الحالية' : 'Current company status',
            },
            {
              label: ar ? 'تجريبية' : 'Trial',
              value: String(c.trial),
              sub: ar ? 'الحالة الحالية' : 'Current company status',
            },
            {
              label: ar ? 'معلقة' : 'Suspended',
              value: String(c.suspended),
              sub: ar ? 'الحالة الحالية' : 'Current company status',
            },
            {
              label: ar ? 'حسابات CRM' : 'CRM accounts',
              value: c.crmUsers,
              sub: ar
                ? 'دون المحذوفة والمعطلة والشركات المؤرشفة'
                : 'Excludes deleted/disabled and archived companies',
            },
            {
              label: ar ? 'شركات جديدة' : 'New companies',
              value: String(c.added),
              sub: ar ? 'خلال الفترة المحددة' : 'Selected date range',
            },
          ]
        : []),
      ...(f
        ? [
            {
              label: 'MRR',
              value: this.money(f.mrrMinor),
              sub: ar ? 'العقود النشطة الحالية' : 'Current active contracts, monthly normalized',
            },
            {
              label: 'ARR',
              value: this.money(f.arrMinor),
              sub: ar ? 'القيمة السنوية للعقود النشطة' : 'Current active contracts, annualized',
            },
          ]
        : []),
    ];
  });
  readonly bars = computed(() => {
    const rows = this.data()?.finance?.series ?? [];
    const values = rows.flatMap((r) => [Number(r.grossMinor), Number(r.netMinor)]);
    const low = Math.min(0, ...values),
      high = Math.max(1, ...values);
    const y = (v: number) => 165 - ((v - low) / (high - low)) * 145;
    const step = 600 / Math.max(1, rows.length);
    return rows.map((r, i) => ({
      x: i * step + step * 0.14,
      w: step * 0.72,
      y: y(Number(r.grossMinor)),
      h: y(0) - y(Number(r.grossMinor)),
      netY: y(Number(r.netMinor)),
      zero: y(0),
      label: this.date(r.date + 'T12:00:00Z'),
      gross: r.grossMinor,
      refund: r.refundMinor,
      net: r.netMinor,
      c: 'var(--platform-primary, #111113)',
    }));
  });
  readonly linePoints = computed(() =>
    this.bars()
      .map((b) => `${b.x + b.w / 2},${b.netY}`)
      .join(' '),
  );
  readonly dots = computed(() => this.bars().map((b) => ({ cx: b.x + b.w / 2, cy: b.netY })));
  readonly axisLabels = computed(() => {
    const bars = this.bars(),
      interval = Math.max(1, Math.ceil(bars.length / 6));
    return bars
      .filter((_, i) => i % interval === 0 || i === bars.length - 1)
      .map((b, i, a) => ({
        x: b.x + b.w / 2,
        t: b.label,
        a: i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle',
      }));
  });
  readonly revenueLegend = computed(() => {
    const f = this.data()?.finance;
    if (!f) return [];
    const ar = this.lang() === 'ar';
    return [
      {
        label: ar ? 'مدفوعات مسجلة' : 'Recorded payments',
        value: this.money(f.grossMinor),
        color: 'var(--platform-primary, #111113)',
      },
      {
        label: ar ? 'مبالغ مستردة مسجلة' : 'Recorded refunds',
        value: this.money(f.refundMinor),
        color: '#d99a28',
      },
      {
        label: ar ? 'صافي السجلات' : 'Recorded net',
        value: this.money(f.netMinor),
        color: '#111113',
      },
    ];
  });
  readonly donut = computed(() => {
    const plans = this.data()?.plans ?? [],
      total = plans.reduce((n, p) => n + p.companies, 0),
      circumference = 2 * Math.PI * 40;
    let offset = 0;
    return plans.map((p, i) => {
      const fraction = total ? p.companies / total : 0;
      const result = {
        key: p.key,
        label: p.name[this.lang()],
        count: p.companies,
        pct: Math.round(fraction * 100),
        color: COLORS[i % COLORS.length],
        dash: `${fraction * circumference} ${circumference * (1 - fraction)}`,
        off: -offset,
      };
      offset += fraction * circumference;
      return result;
    });
  });
  readonly noPayments = computed(() => {
    const f = this.data()?.finance;
    return !f || f.series.every((r) => r.grossMinor === '0' && r.refundMinor === '0');
  });
  exportReport() {
    const d = this.data();
    if (!d) return;
    const rows: string[][] = [
      ['Mujez overview', 'value'],
      ['as_of_utc', d.asOf],
      ['from_cairo', d.window.from],
      ['to_cairo', d.window.to],
      ['sample_data_included', String(d.sampleDataIncluded)],
    ];
    if (d.companies)
      for (const [k, v] of Object.entries(d.companies)) rows.push(['companies_' + k, String(v)]);
    if (d.finance) {
      for (const k of ['mrrMinor', 'arrMinor', 'grossMinor', 'refundMinor', 'netMinor'] as const)
        rows.push([k, d.finance[k]]);
      rows.push(
        [],
        ['bucket_cairo', 'recorded_payments_minor', 'recorded_refunds_minor', 'recorded_net_minor'],
      );
      for (const r of d.finance.series)
        rows.push([r.date, r.grossMinor, r.refundMinor, r.netMinor]);
    }
    const csv =
      '\uFEFF' +
      rows.map((row) => row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mujez-overview-' + d.window.from + '-' + d.window.to + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
