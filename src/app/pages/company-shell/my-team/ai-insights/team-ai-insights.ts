import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SalesApi, salesMoney, STAGE_NAMES, SOURCE_NAMES } from '../../../../sales-api.service';
import { compactNumber } from '../../../../compact-numbers';
import { CompanyUiState } from '../../company-ui-state';
interface Metric {
  id: string;
  label: { en: string; ar: string };
  value: string;
  unit: 'count' | 'money' | 'percent' | 'days';
  memberKey?: string;
}
interface Member {
  key: string;
  id: string;
  name: string;
  status: string;
  role: string;
  openLeads: number;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  won: number;
  lost: number;
  wonSalesMinor: string;
}
interface Snapshot {
  team: { id: string; name: string };
  days: number;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  timeZone: string;
  asOf: string;
  members: Member[];
  focusMembers: string[];
  metrics: Metric[];
  stages: { stage: string; count: number; saleMinor: string }[];
  sources: { source: string; count: number; won: number }[];
  series: { date: string; newLeads: number; won: number; lost: number; completedTasks: number }[];
  hasData: boolean;
}
interface Insight {
  category?: string;
  tone?: string;
  priority?: string;
  title: string;
  explanation: string;
  metricIds: string[];
  memberKeys: string[];
}
interface Run {
  id: string;
  status: 'processing' | 'succeeded' | 'failed' | 'stale';
  error: { code: string; message: string } | null;
  result: {
    report: { summary: string; insights: Insight[]; actions: Insight[]; limitations: string[] };
    snapshot: Snapshot;
    generatedAt: string;
    thinkingEnabled: boolean;
  } | null;
}
@Component({
  selector: 'app-team-ai-insights',
  imports: [FormsModule],
  templateUrl: './team-ai-insights.html',
  styleUrl: './team-ai-insights.scss',
})
export class TeamAiInsights {
  readonly days = input(30);
  readonly daysChange = output<string>();
  private readonly api = inject(SalesApi);
  private readonly ui = inject(CompanyUiState);
  private readonly destroy = inject(DestroyRef);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly snapshot = signal<Snapshot | null>(null);
  readonly run = signal<Run | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly busy = computed(
    () => this.loading() || this.starting() || this.run()?.status === 'processing',
  );
  readonly data = computed(() => this.run()?.result?.snapshot ?? this.snapshot());
  readonly money = salesMoney;
  readonly number = compactNumber;
  readonly cards = [
    'team.open_leads',
    'pipeline.sale_value',
    'team.overdue_tasks',
    'period.win_rate',
    'period.newLeads',
    'period.activities',
  ];
  readonly comparisons = [
    { now: 'period.newLeads', before: 'previous.newLeads' },
    { now: 'period.won', before: 'previous.won' },
    { now: 'period.lost', before: 'previous.lost' },
    { now: 'period.completedTasks', before: 'previous.completedTasks' },
    { now: 'period.won_sales', before: 'previous.won_sales' },
  ];
  private serial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private requestId = '';
  private signature = '';
  constructor() {
    effect(() => {
      void this.load(this.days(), this.ar() ? 'ar' : 'en');
    });
    this.destroy.onDestroy(() => {
      this.serial++;
      clearTimeout(this.timer);
    });
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  label(m: Metric) {
    return m.memberKey
      ? this.metricField(m.id.split('.').at(-1)!)
      : m.id.startsWith('stage.')
        ? this.stage(m.id.slice(6))
        : m.id.startsWith('source.')
          ? this.source(m.id.slice(7))
          : this.ar()
            ? m.label.ar
            : m.label.en;
  }
  metricField(s: string) {
    const labels: Record<string, [string, string]> = {
      openLeads: ['Open leads', 'عملاء مفتوحون'],
      newLeads: ['New leads', 'عملاء جدد'],
      won: ['Won leads', 'عملاء ناجحون'],
      lost: ['Lost leads', 'عملاء خاسرون'],
      openTasks: ['Open tasks', 'مهام مفتوحة'],
      overdueTasks: ['Overdue tasks', 'مهام متأخرة'],
      completedTasks: ['Completed tasks', 'مهام مكتملة'],
      wonSalesMinor: ['Won sales value', 'قيمة المبيعات الناجحة'],
    };
    return labels[s] ? this.t(...labels[s]) : s;
  }
  stage(s: string) {
    return (STAGE_NAMES[this.ar() ? 'ar' : 'en'] as Record<string, string>)[s] ?? s;
  }
  source(s: string) {
    const n = SOURCE_NAMES[s as keyof typeof SOURCE_NAMES];
    return n ? this.t(n[0], n[1]) : s;
  }
  metric(id: string) {
    return this.data()?.metrics.find((m) => m.id === id);
  }
  value(m: Metric | undefined) {
    if (!m) return '—';
    return m.unit === 'money'
      ? this.money(m.value)
      : m.unit === 'percent'
        ? m.value + '%'
        : this.number(m.value) + (m.unit === 'days' ? this.t(' days', ' يومًا') : '');
  }
  member(key: string) {
    return this.data()?.members.find((m) => m.key === key)?.name ?? key;
  }
  category(s: string | undefined) {
    const n: Record<string, [string, string]> = {
      pipeline: ['Pipeline', 'مسار المبيعات'],
      tasks: ['Tasks', 'المهام'],
      conversion: ['Conversion', 'التحويل'],
      workload: ['Workload', 'توزيع العمل'],
      activity: ['Activity', 'النشاط'],
      high: ['High priority', 'أولوية عالية'],
      medium: ['Medium priority', 'أولوية متوسطة'],
      low: ['Low priority', 'أولوية منخفضة'],
    };
    return s && n[s] ? this.t(...n[s]) : '';
  }
  bar(n: number, rows: { count: number }[]) {
    return Math.max(1, (n / Math.max(1, ...rows.map((r) => r.count))) * 100) + '%';
  }
  private setRun(r: Run | null, n: number) {
    if (n !== this.serial) return;
    clearTimeout(this.timer);
    this.run.set(r);
    if (r?.status === 'processing') this.timer = setTimeout(() => void this.refresh(), 5000);
  }
  async load(days = this.days(), language = this.ar() ? 'ar' : 'en') {
    const n = ++this.serial;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.snapshot.set(null);
    this.run.set(null);
    this.error.set('');
    this.requestId = '';
    this.signature = '';
    try {
      const [s, r] = await Promise.all([
        this.api.get('team/my-team/ai-insights/snapshot', { days: String(days) }),
        this.api.get('team/my-team/ai-insights', { days: String(days), language }),
      ]);
      if (n !== this.serial) return;
      this.snapshot.set(s);
      this.setRun(r.run, n);
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  async refresh() {
    const n = this.serial,
      r = this.run();
    if (!r) return;
    try {
      this.setRun(await this.api.get('team/my-team/ai-insights/' + r.id), n);
      if (n === this.serial) this.error.set('');
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    }
  }
  async generate() {
    if (this.busy() || !this.snapshot()?.hasData) return;
    const n = this.serial;
    this.starting.set(true);
    this.error.set('');
    const b = { days: this.days(), language: this.ar() ? 'ar' : 'en' };
    const signature = JSON.stringify(b);
    if (
      !this.requestId ||
      this.signature !== signature ||
      ['failed', 'stale', 'succeeded'].includes(this.run()?.status ?? '')
    ) {
      this.requestId = crypto.randomUUID();
      this.signature = signature;
    }
    this.run.set(null);
    try {
      this.setRun(
        await this.api.write('team/my-team/ai-insights', { ...b, requestId: this.requestId }),
        n,
      );
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    } finally {
      if (n === this.serial) this.starting.set(false);
    }
  }
}
