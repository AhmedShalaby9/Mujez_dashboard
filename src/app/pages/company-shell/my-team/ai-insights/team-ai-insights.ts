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
  teamKey?: string;
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
  newLeads?: number;
  openSaleMinor?: string;
  signedSalesMinor?: string;
  signedContracts?: number;
  winRate?: string;
  teamId?: string | null;
}
interface Snapshot {
  team?: { id: string; name: string };
  teams?: Array<Member & { memberCount: number }>;
  focusTeams?: string[];
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
  teamKeys?: string[];
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
  readonly scope = input<'team' | 'company'>('team');
  readonly company = computed(() => this.scope() === 'company');
  readonly base = computed(() =>
    this.company() ? 'company-ai-insights' : 'team/my-team/ai-insights',
  );
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
  readonly cards = computed(() => [
    this.company() ? 'company.open_leads' : 'team.open_leads',
    'pipeline.sale_value',
    this.company() ? 'company.overdue_tasks' : 'team.overdue_tasks',
    'period.win_rate',
    'period.newLeads',
    this.company() ? 'period.signed_sales' : 'period.activities',
  ]);
  readonly comparisons = computed(() => [
    { now: 'period.newLeads', before: 'previous.newLeads' },
    { now: 'period.won', before: 'previous.won' },
    { now: 'period.lost', before: 'previous.lost' },
    { now: 'period.completedTasks', before: 'previous.completedTasks' },
    { now: 'period.won_sales', before: 'previous.won_sales' },
    ...(this.company() ? [{ now: 'period.signed_sales', before: 'previous.signed_sales' }] : []),
  ]);
  readonly comparisonSort = signal('wonSalesMinor');
  readonly sortOptions = [
    'wonSalesMinor',
    'signedSalesMinor',
    'openSaleMinor',
    'openLeads',
    'overdueTasks',
    'completedTasks',
  ];
  readonly salespeople = computed(() =>
    this.sorted(
      (this.data()?.members ?? []).filter((m) => ['agent', 'team_lead'].includes(m.role)),
    ),
  );
  readonly companyTeams = computed(() => this.sorted(this.data()?.teams ?? []));
  private sorted<T>(rows: T[]) {
    const key = this.comparisonSort();
    return [...rows].sort((a: any, b: any) => {
      const x = BigInt(a[key] ?? 0),
        y = BigInt(b[key] ?? 0);
      return x > y ? -1 : x < y ? 1 : a.key.localeCompare(b.key);
    });
  }
  memberTeam(m: Member) {
    return this.data()?.teams?.find((t) => t.id === m.teamId)?.key ?? 'T00';
  }
  teamName(key: string) {
    const t = this.data()?.teams?.find((t) => t.key === key);
    return t?.id === null
      ? this.t('No team / unassigned', 'دون فريق / دون مسؤول')
      : (t?.name ?? key);
  }
  statusLabel(s: string) {
    const labels: Record<string, [string, string]> = {
      active: ['Active', 'نشط'],
      invited: ['Invited', 'مدعو'],
      disabled: ['Disabled', 'معطّل'],
      locked: ['Locked', 'مقفل'],
      deleted: ['Deleted', 'محذوف'],
    };
    return labels[s] ? this.t(...labels[s]) : s;
  }
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
    if (this.company() && m.teamKey)
      return this.teamName(m.teamKey) + ' · ' + this.metricField(m.id.split('.').at(-1)!);
    if (this.company() && m.memberKey)
      return this.member(m.memberKey) + ' · ' + this.metricField(m.id.split('.').at(-1)!);
    return m.memberKey || m.teamKey
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
      memberCount: ['Team members', 'أعضاء الفريق'],
      signedSalesMinor: ['Signed sale value', 'قيمة البيع الموقّع'],
      signedContracts: ['Signed sale contracts', 'عقود البيع الموقعة'],
      openSaleMinor: ['Open sale pipeline', 'قيمة البيع المفتوحة'],
      winRate: ['Won share of won/lost', 'نسبة النجاح من الناجحين والخاسرين'],
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
      teams: ['Teams', 'الفرق'],
      sales: ['Salespeople', 'مندوبو المبيعات'],
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
        this.api.get(this.base() + '/snapshot', { days: String(days) }),
        this.api.get(this.base(), { days: String(days), language }),
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
      this.setRun(await this.api.get(this.base() + '/' + r.id), n);
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
    const signature = JSON.stringify({ base: this.base(), ...b });
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
      this.setRun(await this.api.write(this.base(), { ...b, requestId: this.requestId }), n);
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    } finally {
      if (n === this.serial) this.starting.set(false);
    }
  }
}
