import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CompanyInsightsApi,
  type CompanyReport,
  type Overview,
} from '../../../company-insights-api.service';
import { SalesApi, SALES_STAGES, STAGE_NAMES, type SalesStage } from '../../../sales-api.service';
import type { CalendarEvent } from '../../../calendar-api.service';
type Segment = 'all' | 'res' | 'com';
const ALERTS: Record<string, [string, string]> = {
  'overdue-tasks': ['Overdue open tasks', 'مهام مفتوحة متأخرة'],
  'missing-evidence': ['Contracts missing required evidence', 'عقود ينقصها مستند مطلوب'],
  'expiring-reservations': ['Reservations expiring within 24 hours', 'حجوزات تنتهي خلال ٢٤ ساعة'],
  'payable-commissions': ['Commissions ready for manual payment', 'عمولات مستحقة للدفع اليدوي'],
  'first-contact': ['Leads overdue for first contact', 'عملاء تجاوزوا مهلة التواصل الأول'],
  'routing-worker': ['Routing worker needs attention', 'عامل التوزيع يحتاج مراجعة'],
};
const OPEN_STAGES: SalesStage[] = ['new', 'qualified', 'viewing', 'offer', 'contract'];
const STAGE_COLOR: Record<string, string> = {
  new: '#C4C4BE',
  qualified: '#5B78E5',
  viewing: '#D99A28',
  offer: '#8BB33A',
  contract: '#111113',
  won: '#2FA35F',
  lost: '#E2553B',
};
const EVENT_COLOR: Record<string, string> = {
  viewing: '#D99A28',
  call: '#5B78E5',
  meeting: '#111113',
  inspection: '#8BB33A',
  signing: '#2FA35F',
};
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './dashboard.scss',
  ],
})
export class Dashboard {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  private readonly sales = inject(SalesApi);
  private readonly auth = inject(AuthService);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly segment = signal<Segment>('all');
  readonly segments: Segment[] = ['all', 'res', 'com'];
  readonly data = signal<Overview | null>(null);
  /** Per-stage counts / sale value from GET /pipeline (all segments). */
  readonly stageStats = signal<Array<{
    stage: SalesStage;
    count: number;
    saleMinor: string;
  }> | null>(null);
  /** Today's calendar events (Cairo day). */
  readonly events = signal<CalendarEvent[] | null>(null);
  /** This quarter's owners from GET /reports, for the team leaderboard. */
  readonly report = signal<CompanyReport | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private generation = 0;
  private has(p: string) {
    return this.auth.user()?.permissions.includes(p) ?? false;
  }
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
  time(iso: string) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }
  initials(v: { en: string; ar: string } | string | null) {
    const s = typeof v === 'string' ? v : this.local(v);
    return (s || '—')
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
  stageName(s: string) {
    return (STAGE_NAMES[this.ui.lang()] as Record<string, string>)[s] ?? s;
  }
  eventColor(t: string) {
    return EVENT_COLOR[t] ?? '#111113';
  }
  /** Design pipeline card: open stages, value + count, bar sized by sale value. */
  readonly stages = computed(() => {
    const st = this.stageStats();
    if (!st) return null;
    const rows = OPEN_STAGES.map((s) => {
      const r = st.find((x) => x.stage === s);
      return { key: s, count: r?.count ?? 0, value: r?.saleMinor ?? '0', color: STAGE_COLOR[s] };
    });
    const total = rows.reduce((a, r) => a + BigInt(r.value), 0n);
    const totalCount = rows.reduce((a, r) => a + r.count, 0);
    return {
      total: total.toString(),
      count: totalCount,
      rows: rows.map((r) => ({
        ...r,
        // Fall back to deal counts when no sale values are recorded yet.
        pct:
          total > 0n
            ? Number((BigInt(r.value) * 10000n) / total) / 100 + '%'
            : totalCount
              ? (r.count / totalCount) * 100 + '%'
              : '0%',
      })),
    };
  });
  /** KPI strip; each card has an optional fill bar (share of a meaningful whole). */
  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const m = d.metrics;
    const out: Array<{
      label: string;
      value: string;
      sub: string;
      route: string;
      bar: number | null;
    }> = [];
    if (m.pipeline)
      out.push({
        label: this.text('Open pipeline', 'الصفقات المفتوحة'),
        value: this.api.money(m.pipeline.saleValueMinor),
        sub:
          m.pipeline.saleCount +
          this.text(' sales · ', ' بيع · ') +
          m.pipeline.leaseCount +
          this.text(' leases (not in value)', ' إيجار (خارج القيمة)'),
        route: '/company/pipeline',
        bar: null,
      });
    if (m.newLeads7d !== undefined)
      out.push({
        label: this.text('New leads · 7 days', 'عملاء جدد · 7 أيام'),
        value: String(m.newLeads7d),
        sub: this.segmentName(this.segment()),
        route: '/company/leads',
        bar: null,
      });
    if (m.todayTasks !== undefined)
      out.push({
        label: this.text('Tasks due today', 'مهام اليوم'),
        value: String(m.todayTasks),
        sub: this.text('open', 'مفتوحة'),
        route: '/company/tasks',
        bar: null,
      });
    if (m.paidCommissionMtd !== undefined)
      out.push({
        label: this.text('Paid commission · MTD', 'العمولات المصروفة · الشهر'),
        value: this.api.money(m.paidCommissionMtd),
        sub: this.text('recorded as paid', 'مسجلة كمصروفة'),
        route: '/company/commissions',
        bar: null,
      });
    if (d.inventory) {
      const inv = d.inventory;
      const total = Object.values(inv).reduce((a, n) => a + n, 0);
      out.push({
        label: this.text('Units available', 'وحدات متاحة'),
        value: String(inv['available'] ?? 0),
        sub: this.text('of ' + total + ' units', 'من ' + total + ' وحدة'),
        route: '/company/units',
        bar: total ? ((inv['available'] ?? 0) / total) * 100 : 0,
      });
    } else if (m.projects !== undefined)
      out.push({
        label: this.text('Active projects', 'المشروعات النشطة'),
        value: String(m.projects),
        sub: this.text('not archived', 'غير مؤرشفة'),
        route: '/company/projects',
        bar: null,
      });
    return out.slice(0, 4);
  });
  /** Team leaderboard (company admins with reports access): this quarter's signed volume. */
  readonly team = computed(() => {
    const owners = (this.report()?.owners ?? []).filter((o) => o.id);
    const max = owners.reduce(
      (m, o) => (BigInt(o.saleValueMinor) > m ? BigInt(o.saleValueMinor) : m),
      0n,
    );
    return [...owners]
      .sort(
        (a, b) =>
          (BigInt(b.saleValueMinor) > BigInt(a.saleValueMinor) ? 1 : -1) || b.deals - a.deals,
      )
      .slice(0, 6)
      .map((o, i) => ({
        rank: i + 1,
        name: o.name ?? '—',
        deals: o.deals,
        vol: this.api.money(o.saleValueMinor),
        w: max > 0n ? Number((BigInt(o.saleValueMinor) * 10000n) / max) / 100 + '%' : '0%',
      }));
  });
  alertName(k: string) {
    return ALERTS[k]?.[this.ar() ? 1 : 0] ?? k;
  }
  /** Cairo-day bounds for today's events. */
  private todayRange(today: string) {
    // Cairo observes DST, so read the real offset for that day instead of assuming +02:00.
    const noon = new Date(today + 'T12:00:00Z');
    const cairoHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        hour12: false,
      }).format(noon),
    );
    const offsetH = cairoHour - 12;
    const start = new Date(Date.parse(today + 'T00:00:00Z') - offsetH * 3600 * 1000);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  async load(segment = this.segment()) {
    this.segment.set(segment);
    const n = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      const d = await this.api.get<Overview>(
        '/company-overview',
        segment === 'all' ? {} : { segment },
      );
      if (n !== this.generation) return;
      this.data.set(d);
      const range = this.todayRange(d.today);
      const [stats, events, report] = await Promise.all([
        this.has('pipeline.read')
          ? this.sales
              .get('pipeline', { page: '1', limit: '1' })
              .then((r: any) => r.stats)
              .catch(() => null)
          : Promise.resolve(null),
        this.has('calendar.read')
          ? this.sales
              .get('events', range)
              .then((r: any) =>
                (r.items as CalendarEvent[])
                  .filter((e) => e.status !== 'canceled')
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
              )
              .catch(() => null)
          : Promise.resolve(null),
        this.has('reports.read')
          ? this.api
              .get<CompanyReport>('/reports', {
                period: 'quarter',
                ...(segment === 'all' ? {} : { segment }),
              })
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      if (n !== this.generation) return;
      this.stageStats.set(stats);
      this.events.set(events);
      this.report.set(report);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
}
