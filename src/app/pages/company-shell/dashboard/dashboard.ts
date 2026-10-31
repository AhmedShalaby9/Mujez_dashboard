import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CompanyInsightsApi,
  type Overview,
  volumePercent,
} from '../../../company-insights-api.service';
type Segment = 'all' | 'res' | 'com';
const ALERTS: Record<string, [string, string]> = {
  'overdue-tasks': ['Overdue open tasks', 'مهام مفتوحة متأخرة'],
  'missing-evidence': ['Contracts missing required evidence', 'عقود ينقصها مستند مطلوب'],
  'expiring-reservations': ['Reservations expiring within 24 hours', 'حجوزات تنتهي خلال ٢٤ ساعة'],
  'payable-commissions': ['Commissions ready for manual payment', 'عمولات مستحقة للدفع اليدوي'],
  'first-contact': ['Leads overdue for first contact', 'عملاء تجاوزوا مهلة التواصل الأول'],
  'routing-worker': ['Routing worker needs attention', 'عامل التوزيع يحتاج مراجعة'],
};
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  private readonly auth = inject(AuthService);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly segment = signal<Segment>('all');
  readonly segments: Segment[] = ['all', 'res', 'com'];
  readonly data = signal<Overview | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private generation = 0;
  constructor() {
    void this.load();
  }
  text(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  local(v: { en: string; ar: string } | null) {
    return v?.[this.ui.lang()] ?? '—';
  }
  segmentName(s: Segment) {
    return s === 'all'
      ? this.text('All', 'الكل')
      : s === 'res'
        ? this.text('Residential', 'سكني')
        : this.text('Commercial', 'تجاري');
  }
  /** "Good afternoon, Youssef" — Cairo clock, first name of the signed-in user. */
  readonly greeting = computed(() => {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
    );
    const hello =
      hour < 12
        ? this.text('Good morning', 'صباح الخير')
        : hour < 18
          ? this.text('Good afternoon', 'مساء الخير')
          : this.text('Good evening', 'مساء الخير');
    const u = this.auth.user();
    const first = (u?.workspace?.platformUserName ?? u?.name ?? '').split(' ')[0];
    return first ? hello + this.text(', ', ' يا ') + first : hello;
  });
  longDate(iso: string) {
    const d = new Date(iso + 'T12:00:00Z');
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }
  shortDate(iso: string) {
    const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      day: 'numeric',
      month: 'short',
    }).format(d);
  }
  initials(v: { en: string; ar: string } | null) {
    return (this.local(v) || '—')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
  priorityColor(p: string) {
    return p === 'high' ? '#E2553B' : p === 'med' ? '#D99A28' : '#C4C4BE';
  }
  priorityName(p: string) {
    return p === 'high'
      ? this.text('High', 'عالية')
      : p === 'med'
        ? this.text('Medium', 'متوسطة')
        : p === 'low'
          ? this.text('Low', 'منخفضة')
          : p;
  }
  scoreColor(n: number) {
    return n >= 85 ? '#B4442F' : n >= 75 ? '#B7791F' : '#6E6E73';
  }
  /** Signed-volume months as shares of the quarter, for the stacked bar. */
  readonly months = computed(() => {
    const rows = this.data()?.chart ?? [];
    const total = rows.reduce((n, r) => n + BigInt(r.valueMinor), 0n);
    const colors = ['#111113', '#8BB33A', '#C8F169', '#D9D9D2'];
    return rows.map((r, i) => ({
      ...r,
      color: colors[i % colors.length],
      pct: total === 0n ? '0%' : Number((BigInt(r.valueMinor) * 10000n) / total) / 100 + '%',
    }));
  });
  readonly kpiCount = computed(() => {
    const m = this.data()?.metrics;
    if (!m) return 0;
    return [m.pipeline, m.paidCommissionMtd, m.todayTasks, m.newLeads7d, m.projects].filter(
      (v) => v !== undefined,
    ).length;
  });
  alertName(k: string) {
    return ALERTS[k]?.[this.ar() ? 1 : 0] ?? k;
  }
  percent(v: string) {
    return volumePercent(v, this.data()?.chart ?? []);
  }
  async load(segment = this.segment()) {
    this.segment.set(segment);
    const n = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.data.set(null);
    try {
      const d = await this.api.get<Overview>(
        '/company-overview',
        segment === 'all' ? {} : { segment },
      );
      if (n === this.generation) this.data.set(d);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
}
