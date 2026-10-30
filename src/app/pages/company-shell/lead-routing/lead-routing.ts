import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { CompanyGrowthApi, type RoutingRule } from '../../../company-growth-api.service';
import { AuthService } from '../../../auth.service';
import { SOURCE_NAMES, minorAmount, majorAmount } from '../../../sales-api.service';
type Strategy = RoutingRule['strategy'];
type Rule = RoutingRule;
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  strategyNames: Record<Strategy, string>;
  thPriority: string;
  thMatch: string;
  thStrategy: string;
  thTarget: string;
  thSla: string;
  thActive: string;
  minutes: string;
  simTitle: string;
  simSource: string;
  simSegment: string;
  simBudget: string;
  simBtn: string;
  simResultPrefix: string;
  simRulePrefix: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Lead Routing',
    sub: 'First eligible matching rule assigns new leads. Periodic SLA reassignment requires an eligible alternate and stops after three attempts.',
    strategyNames: {
      round_robin: 'Round robin',
      weighted: 'Weighted',
      specific_user: 'Specific user',
      team: 'Team',
    },
    thPriority: '#',
    thMatch: 'Match',
    thStrategy: 'Strategy',
    thTarget: 'Target',
    thSla: 'SLA',
    thActive: 'Active',
    minutes: 'min',
    simTitle: 'Simulator — preview which agent a sample lead would go to',
    simSource: 'Source',
    simSegment: 'Segment',
    simBudget: 'Budget (EGP)',
    simBtn: 'Simulate',
    simResultPrefix: 'Would be assigned to',
    simRulePrefix: 'via rule',
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'توزيع العملاء',
    sub: 'أول قاعدة مطابقة مؤهلة توزع العملاء الجدد. إعادة الإسناد الدوري تتطلب بديلاً مؤهلاً وتتوقف بعد ثلاث محاولات.',
    strategyNames: {
      round_robin: 'دوري',
      weighted: 'مرجّح',
      specific_user: 'مستخدم محدد',
      team: 'فريق',
    },
    thPriority: '#',
    thMatch: 'التطابق',
    thStrategy: 'الإستراتيجية',
    thTarget: 'الهدف',
    thSla: 'المهلة',
    thActive: 'نشطة',
    minutes: 'د',
    simTitle: 'محاكاة — معاينة الوكيل الذي سيُسند له عميل تجريبي',
    simSource: 'المصدر',
    simSegment: 'القطاع',
    simBudget: 'الميزانية (جنيه)',
    simBtn: 'محاكاة',
    simResultPrefix: 'سيُسند إلى',
    simRulePrefix: 'عبر القاعدة',
  },
};

@Component({
  selector: 'app-lead-routing',
  imports: [FormsModule],
  templateUrl: './lead-routing.html',
  styleUrl: './lead-routing.scss',
})
export class LeadRouting implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyGrowthApi);
  readonly auth = inject(AuthService);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly advancedAvailable = signal(false);
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('routing.manage') ?? false,
  );
  rules = signal<Rule[]>([]);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  loaded = signal(false);
  worker = signal<{ lastSeenAt: string | null; healthy: boolean } | null>(null);
  showArchived = false;
  visible = computed(() => this.rules().filter((r) => this.includeArchived() || !r.archivedAt));
  includeArchived = signal(false);
  users = signal<any[]>([]);
  formOpen = signal(false);
  editing = signal<Rule | null>(null);
  sources = Object.keys(SOURCE_NAMES);
  strategies: Strategy[] = ['round_robin', 'weighted', 'specific_user', 'team'];
  form: any = {
    name: '',
    nameAr: '',
    source: '',
    segment: '',
    minBudget: '',
    strategy: 'round_robin',
    teamName: '',
    teamNameAr: '',
    slaMinutes: 20,
    active: false,
    targets: [],
  };
  simSource = signal('website');
  simSegment = signal<'res' | 'com'>('res');
  simBudget = signal('');
  simResult = signal<any>(null);
  requestId = crypto.randomUUID();
  private serial = 0;
  private simSerial = 0;
  constructor() {
    void this.reload();
  }
  ngOnDestroy() {
    this.serial++;
    this.simSerial++;
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  changed() {
    this.requestId = crypto.randomUUID();
  }
  sourceName(key: string) {
    return SOURCE_NAMES[key]?.[this.ar() ? 1 : 0] ?? key;
  }
  match(r: Rule) {
    return (
      [
        r.source ? this.sourceName(r.source) : '',
        r.segment
          ? r.segment === 'res'
            ? this.t('Residential', 'سكني')
            : this.t('Commercial', 'تجاري')
          : '',
        r.minBudgetMinor !== null ? '≥ ' + this.api.money(r.minBudgetMinor) : '',
      ]
        .filter(Boolean)
        .join(' · ') || this.t('All leads', 'كل العملاء')
    );
  }
  target(r: Rule) {
    return (
      (r.teamName ? r.teamName[this.lang()] + ' · ' : '') +
        r.targets
          .map(
            (t) =>
              t.name +
              (r.strategy === 'weighted' ? ' (' + t.weight + ')' : '') +
              (!t.active ? ' · ' + this.t('Inactive', 'غير نشط') : ''),
          )
          .join(', ') || this.t('Configure a user roster', 'اضبط قائمة المستخدمين')
    );
  }
  canUp(r: Rule) {
    return (
      this.rules()
        .filter((r) => !r.archivedAt)
        .findIndex((x) => x.id === r.id) > 0
    );
  }
  canDown(r: Rule) {
    const rows = this.rules().filter((r) => !r.archivedAt);
    return rows.findIndex((x) => x.id === r.id) < rows.length - 1;
  }
  date(v: string | null) {
    return v
      ? new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Africa/Cairo',
        }).format(new Date(v))
      : '—';
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get<any>('routing');
      if (n !== this.serial) return;
      this.rules.set(r.items);
      this.advancedAvailable.set(!!r.advancedAvailable);
      this.worker.set(r.worker);
      this.loaded.set(true);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  async edit(r: Rule | null = null) {
    this.changed();
    this.error.set('');
    this.editing.set(r);
    this.form = r
      ? {
          name: r.name.en,
          nameAr: r.name.ar,
          source: r.source ?? '',
          segment: r.segment ?? '',
          minBudget: r.minBudgetMinor === null ? '' : majorAmount(r.minBudgetMinor),
          strategy: r.strategy,
          teamName: r.teamName?.en ?? '',
          teamNameAr: r.teamName?.ar ?? '',
          slaMinutes: r.slaMinutes,
          active: r.active,
          targets: r.targets.map((t) => ({ userId: t.userId, weight: t.weight })),
        }
      : {
          name: '',
          nameAr: '',
          source: '',
          segment: '',
          minBudget: '',
          strategy: 'round_robin',
          teamName: '',
          teamNameAr: '',
          slaMinutes: 20,
          active: false,
          targets: [],
        };
    this.formOpen.set(true);
    try {
      const o = await this.api.get<any>('routing/options');
      if (!this.formOpen()) return;
      this.users.set(o.users);
      if (
        !r &&
        !this.form.targets.length &&
        o.users.some((u: any) => u.id === this.auth.user()?.id)
      )
        this.form.targets = [{ userId: this.auth.user()!.id, weight: 1 }];
    } catch (e: any) {
      this.error.set(e.message);
    }
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = this.editing(),
        f = this.form;
      await this.api.write('routing' + (r ? '/' + r.id + '/update' : ''), {
        requestId: this.requestId,
        name: f.name,
        nameAr: f.nameAr || undefined,
        source: f.source || null,
        segment: f.segment || null,
        minBudgetMinor: minorAmount(f.minBudget, true),
        strategy: f.strategy,
        teamName: f.strategy === 'team' ? f.teamName : undefined,
        teamNameAr: f.teamNameAr || undefined,
        slaMinutes: Number(f.slaMinutes),
        active: !!f.active,
        targets: f.targets.map((t: any) => ({ userId: t.userId, weight: Number(t.weight) })),
        ...(r ? { version: r.version } : {}),
      });
      this.formOpen.set(false);
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  async action(r: Rule, action: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('routing/' + r.id + '/action', {
        requestId: crypto.randomUUID(),
        version: r.version,
        action,
      });
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  moveUp(r: Rule) {
    void this.action(r, 'up');
  }
  moveDown(r: Rule) {
    void this.action(r, 'down');
  }
  toggleActive(r: Rule) {
    void this.action(r, r.active ? 'disable' : 'enable');
  }
  async simulate() {
    const n = ++this.simSerial;
    this.error.set('');
    try {
      const r = await this.api.write('routing/simulate', {
        source: this.simSource(),
        segment: this.simSegment(),
        budgetMinor: minorAmount(this.simBudget(), true),
      });
      if (n === this.simSerial) this.simResult.set(r);
    } catch (e: any) {
      if (n === this.simSerial) this.error.set(e.message);
    }
  }
  resultAgent() {
    const r = this.simResult();
    return r?.assignment?.userName ?? r?.fallback?.userName ?? '';
  }
  resultRule() {
    const r = this.simResult();
    return (
      r?.assignment?.ruleName?.[this.lang()] ??
      this.t('Default owner — no eligible rule', 'المسؤول الافتراضي — لا توجد قاعدة مؤهلة')
    );
  }
}
