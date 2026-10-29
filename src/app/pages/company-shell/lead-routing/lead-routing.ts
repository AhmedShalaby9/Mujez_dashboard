import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type Strategy = 'round_robin' | 'weighted' | 'specific_user' | 'team';

interface Rule {
  id: string;
  match: string;
  matchAr: string;
  strategy: Strategy;
  target: string;
  targetAr: string;
  slaMinutes: number;
  active: boolean;
}

const SEED: Rule[] = [
  { id: 'r1', match: 'Source = Referral', matchAr: 'المصدر = توصية', strategy: 'specific_user', target: 'Dina El Sayed', targetAr: 'دينا السيد', slaMinutes: 10, active: true },
  { id: 'r2', match: 'Segment = Commercial', matchAr: 'القطاع = تجاري', strategy: 'team', target: 'Commercial team', targetAr: 'فريق التجاري', slaMinutes: 15, active: true },
  { id: 'r3', match: 'Budget ≥ EGP 15M', matchAr: 'الميزانية ≥ 15 مليون', strategy: 'weighted', target: 'Senior agents (60/40)', targetAr: 'كبار الوكلاء (60/40)', slaMinutes: 10, active: true },
  { id: 'r4', match: 'All other leads', matchAr: 'كل العملاء الآخرين', strategy: 'round_robin', target: 'All available agents', targetAr: 'كل الوكلاء المتاحين', slaMinutes: 20, active: true },
];

interface SimResult {
  agent: string;
  agentAr: string;
  rule: string;
  ruleAr: string;
}

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
    sub: 'Ordered rules — first match wins. SLA auto-reassigns if there is no first contact in time.',
    strategyNames: { round_robin: 'Round robin', weighted: 'Weighted', specific_user: 'Specific user', team: 'Team' },
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
    sub: 'قواعد مرتبة — أول تطابق يُطبّق. إعادة الإسناد تلقائيًا عند تجاوز مهلة أول تواصل.',
    strategyNames: { round_robin: 'دوري', weighted: 'مرجّح', specific_user: 'مستخدم محدد', team: 'فريق' },
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
  templateUrl: './lead-routing.html',
  styleUrl: './lead-routing.scss',
})
export class LeadRouting {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly rules = signal<Rule[]>(SEED);

  match(r: Rule): string {
    return this.ar() ? r.matchAr : r.match;
  }
  target(r: Rule): string {
    return this.ar() ? r.targetAr : r.target;
  }

  moveUp(i: number): void {
    if (i === 0) return;
    this.rules.update((list) => {
      const copy = [...list];
      [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
      return copy;
    });
  }
  moveDown(i: number): void {
    this.rules.update((list) => {
      if (i === list.length - 1) return list;
      const copy = [...list];
      [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
      return copy;
    });
  }
  toggleActive(r: Rule): void {
    this.rules.update((list) => list.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
  }

  readonly simSource = signal('Referral');
  readonly simSegment = signal<'res' | 'com'>('res');
  readonly simBudget = signal('5000000');
  readonly simResult = signal<SimResult | null>(null);

  simulate(): void {
    const budget = Number(this.simBudget()) || 0;
    const active = this.rules().filter((r) => r.active);
    let picked = active[active.length - 1];
    if (this.simSource() === 'Referral') picked = active.find((r) => r.id === 'r1') ?? picked;
    else if (this.simSegment() === 'com') picked = active.find((r) => r.id === 'r2') ?? picked;
    else if (budget >= 15_000_000) picked = active.find((r) => r.id === 'r3') ?? picked;
    else picked = active.find((r) => r.id === 'r4') ?? picked;

    const agentMap: Record<string, [string, string]> = {
      r1: ['Dina El Sayed', 'دينا السيد'],
      r2: ['Youssef Mansour (commercial)', 'يوسف منصور (تجاري)'],
      r3: ['Khaled Nabil', 'خالد نبيل'],
      r4: ['Rana Farouk (next in rotation)', 'رنا فاروق (التالي في الدور)'],
    };
    const [agent, agentAr] = agentMap[picked.id] ?? ['—', '—'];
    this.simResult.set({ agent, agentAr, rule: this.match(picked), ruleAr: picked.matchAr });
  }

  resultAgent(): string {
    const r = this.simResult();
    return r ? (this.ar() ? r.agentAr : r.agent) : '';
  }
  resultRule(): string {
    const r = this.simResult();
    return r ? (this.ar() ? r.ruleAr : r.rule) : '';
  }
}
