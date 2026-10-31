import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';
import { AuthService } from '../../../auth.service';
import {
  OverviewApi,
  overviewMoney,
  overviewAlertText,
  type OverviewData,
  type OverviewAlert,
} from '../../../overview-api.service';
type Range = '30d' | '90d' | '12m' | 'custom';
const COLORS = ['#111113', '#8BB33A', '#C8F169', '#D9D9D2', '#5B78E5', '#D99A28'];
const ALERT_ICONS: Record<string, string> = {
  invoice_overdue: 'M3 6h18v12H3zM3 10h18',
  trial_ending: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  support_overdue: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  user_limit:
    'M4 7c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3zM4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 12c0 2 3.6 3 8 3s8-1 8-3',
  company_created: 'M3 21h18M5 21V5l7-2v18M12 9h7v12M8 8h1M8 12h1M8 16h1M15 13h1M15 17h1',
};
const SEVERITY: Record<string, [string, string]> = {
  high: ['#FBE7E3', '#A23624'],
  med: ['#FCF2DE', '#83570C'],
  low: ['#EAEFFD', '#2E47A8'],
};
const COPY = {
  en: {
    eyebrow: 'Overview',
    title: 'Dashboard',
    exportBtn: 'Export',
    refresh: 'Refresh',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    mrr: 'Monthly recurring revenue',
    arr: 'ARR',
    arpc: 'Avg / active company',
    heroBars: 'Recorded net per period',
    revSub: 'Recorded payments per period, EGP',
    attention: 'Needs attention',
    review: 'Review',
    recent: 'Recent companies',
    viewAll: 'View all',
    colCompany: 'Company',
    colUsers: 'CRM accounts',
    colCreated: 'Registered',
    companiesLc: 'companies',
    revenueTitle: 'Recorded payments',
    ranges: { '30d': '30 days', '90d': '90 days', '12m': '12 months', custom: 'Custom' },
    planTitle: 'Plan mix',
    alertsTitle: 'Needs attention',
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
    exportBtn: 'تصدير',
    refresh: 'تحديث',
    morning: 'صباح الخير',
    afternoon: 'مساء الخير',
    evening: 'مساء الخير',
    mrr: 'الإيراد الشهري المتكرر',
    arr: 'السنوي',
    arpc: 'متوسط الشركة النشطة',
    heroBars: 'صافي السجلات لكل فترة',
    revSub: 'المدفوعات المسجلة لكل فترة، بالجنيه',
    attention: 'تحتاج إلى متابعة',
    review: 'مراجعة',
    recent: 'أحدث الشركات',
    viewAll: 'عرض الكل',
    colCompany: 'الشركة',
    colUsers: 'حسابات CRM',
    colCreated: 'تاريخ التسجيل',
    companiesLc: 'شركة',
    revenueTitle: 'المدفوعات المسجلة',
    ranges: { '30d': '30 يومًا', '90d': '90 يومًا', '12m': '12 شهرًا', custom: 'مخصص' },
    planTitle: 'توزيع الباقات',
    alertsTitle: 'تحتاج إلى متابعة',
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
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly data = signal<OverviewData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly range = signal<Range>('12m');
  readonly ranges: Range[] = ['30d', '90d', '12m', 'custom'];
  readonly planTotal = computed(() =>
    (this.data()?.plans ?? []).reduce((n, p) => n + p.companies, 0),
  );
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
  /** Revenue chart: one column per bucket, height = recorded payments (gross). */
  readonly hoverBar = signal<number | null>(null);
  readonly bars = computed(() => {
    const rows = this.data()?.finance?.series ?? [];
    const max = Math.max(1, ...rows.map((r) => Number(r.grossMinor)));
    const monthly = this.data()?.window.bucket === 'month';
    return rows.map((r, i) => {
      const d = new Date(r.date + 'T12:00:00Z');
      return {
        i,
        h: Math.max(0, (Number(r.grossMinor) / max) * 100).toFixed(1) + '%',
        last: i === rows.length - 1,
        label: this.date(r.date + 'T12:00:00Z'),
        short: new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
          timeZone: 'Africa/Cairo',
          ...(monthly ? { month: 'short' } : { day: 'numeric', month: 'short' }),
        }).format(d),
        gross: r.grossMinor,
        refund: r.refundMinor,
        net: r.netMinor,
      };
    });
  });
  /** Label every bucket when there are few, otherwise thin the axis to ~8 labels. */
  readonly labelEvery = computed(() => Math.max(1, Math.ceil(this.bars().length / 8)));
  readonly gridLines = computed(() => {
    const rows = this.data()?.finance?.series ?? [];
    const max = Math.max(1, ...rows.map((r) => Number(r.grossMinor)));
    if (max <= 1) return [];
    return [0.25, 0.5, 0.75].map((f) => ({
      b: f * 100 + '%',
      v: this.compact(String(Math.round(max * f))),
    }));
  });
  /** Dark hero mini-chart: recorded net per bucket. */
  readonly heroBars = computed(() => {
    const rows = this.data()?.finance?.series ?? [];
    const nets = rows.map((r) => Number(r.netMinor));
    const max = Math.max(1, ...nets);
    return rows.map((r, i) => ({
      h: Math.max(4, (Math.max(0, Number(r.netMinor)) / max) * 100).toFixed(0) + '%',
      last: i === rows.length - 1,
      tip: this.date(r.date + 'T12:00:00Z') + ' · ' + this.money(r.netMinor),
    }));
  });
  readonly greeting = computed(() => {
    const L = this.L();
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
    );
    const first = (this.auth.user()?.name ?? '').split(' ')[0];
    const hello = hour < 12 ? L.morning : hour < 18 ? L.afternoon : L.evening;
    return first ? hello + (this.lang() === 'ar' ? ' يا ' : ', ') + first : hello;
  });
  readonly today = computed(() =>
    new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date()),
  );
  /** Companies split bar: active / trial / suspended / pending as shares of total. */
  readonly companySplit = computed(() => {
    const c = this.data()?.companies;
    if (!c || !c.total) return [];
    return [
      [c.active, '#2FA35F'],
      [c.trial, '#5B78E5'],
      [c.pending, '#D99A28'],
      [c.suspended, '#E2553B'],
    ]
      .filter(([v]) => Number(v) > 0)
      .map(([v, color]) => ({ w: ((Number(v) / c.total) * 100).toFixed(1) + '%', color }));
  });
  readonly arpc = computed(() => {
    const d = this.data();
    if (!d?.finance || !d.companies?.active) return null;
    return this.money(String(BigInt(d.finance.mrrMinor) / BigInt(d.companies.active)));
  });
  compact(minor: string) {
    const v = Number(BigInt(minor)) / 100,
      a = Math.abs(v);
    const s =
      a >= 1e6
        ? (a / 1e6).toFixed(2) + 'M'
        : a >= 1e4
          ? (a / 1e3).toFixed(1) + 'K'
          : a.toLocaleString('en-GB', { maximumFractionDigits: 0 });
    return (v < 0 ? '−' : '') + s;
  }
  alertIcon(a: OverviewAlert) {
    return ALERT_ICONS[a.kind] ?? ALERT_ICONS['company_created'];
  }
  alertTone(a: OverviewAlert) {
    return SEVERITY[a.severity] ?? SEVERITY['low'];
  }
  alertTitle(a: OverviewAlert) {
    return this.lang() === 'ar' ? a.nameAr : a.nameEn;
  }
  alertSub(a: OverviewAlert) {
    const full = this.alert(a),
      name = this.alertTitle(a);
    return full.startsWith(name + ' — ') ? full.slice(name.length + 3) : full;
  }
  readonly revenueLegend = computed(() => {
    const f = this.data()?.finance;
    if (!f) return [];
    const ar = this.lang() === 'ar';
    return [
      {
        label: ar ? 'مدفوعات مسجلة' : 'Recorded payments',
        value: this.money(f.grossMinor),
        color: '#111113',
        fg: '#111113',
      },
      {
        label: ar ? 'مبالغ مستردة مسجلة' : 'Recorded refunds',
        value: this.money(f.refundMinor),
        color: '#E2553B',
        fg: '#A23624',
      },
      {
        label: ar ? 'صافي السجلات' : 'Recorded net',
        value: this.money(f.netMinor),
        color: '#2FA35F',
        fg: '#1E6B3E',
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
        w: (fraction * 100).toFixed(1) + '%',
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
