import { FeaturesApi } from '../../../features-api.service';
import { CompaniesApi } from '../../../companies-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PlanKey = string;

interface FeatureDef {
  version: number;
  key: string;
  nameEn: string;
  nameAr: string;
  platformOn: boolean;
  rollout: number;
  plans: Record<PlanKey, boolean>;
}

interface Override {
  version: number;
  companyId: string;
  id: string;
  companyEn: string;
  companyAr: string;
  featureKey: string;
  value: boolean;
  expires: string;
  reasonEn: string;
  reasonAr: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  colFeature: string;
  colPlatform: string;
  colRollout: string;
  planLabel: Record<PlanKey, string>;
  overridesTitle: string;
  overridesSub: string;
  colCompany: string;
  colFeatureOv: string;
  colValue: string;
  colExpires: string;
  colReason: string;
  remove: string;
  valueOn: string;
  valueOff: string;
  confirmPlanTitle: (feature: string, plan: string, on: boolean) => string;
  confirmPlanBody: (count: number, on: boolean) => string;
  flagTitle: (feature: string, on: boolean) => string;
  flagBody: (on: boolean) => string;
  reasonLabel: string;
  ackText: string;
  cancel: string;
  confirm: string;
  rolloutTitle: (feature: string) => string;
  rolloutLabel: string;
  removeTitle: (company: string) => string;
  removeBody: string;
  flagToast: (feature: string, on: boolean) => string;
  planToast: (feature: string, plan: string, on: boolean) => string;
  rolloutToast: (feature: string, pct: number) => string;
  removeToast: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Platform',
    title: 'Feature management',
    sub: 'Effective state = platform flag → company override → plan entitlement.',
    colFeature: 'Feature',
    colPlatform: 'Platform flag',
    colRollout: 'Rollout %',
    planLabel: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
    overridesTitle: 'Company overrides',
    overridesSub: 'Temporary exceptions to plan entitlement',
    colCompany: 'Company',
    colFeatureOv: 'Feature',
    colValue: 'Override',
    colExpires: 'Expires',
    colReason: 'Reason',
    remove: 'Remove',
    valueOn: 'Enabled',
    valueOff: 'Disabled',
    confirmPlanTitle: (feature, plan, on) => `${on ? 'Enable' : 'Disable'} ${feature} for ${plan}`,
    confirmPlanBody: (count, on) =>
      `This ${on ? 'adds' : 'removes'} the feature for ${count} ${count === 1 ? 'company' : 'companies'} on this plan.`,
    flagTitle: (feature, on) => `${on ? 'Enable' : 'Disable'} platform flag: ${feature}`,
    flagBody: (on) =>
      on
        ? 'The feature becomes available again, subject to plan entitlement and overrides.'
        : 'This is a global kill switch — it turns the feature off for every company immediately, regardless of plan or override.',
    reasonLabel: 'Reason',
    ackText: 'I understand this change takes effect immediately.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    rolloutTitle: (feature) => `Rollout — ${feature}`,
    rolloutLabel: 'Percentage of eligible companies (0–100)',
    removeTitle: (company) => `Remove override for ${company}`,
    removeBody: 'The company reverts to its plan entitlement for this feature.',
    flagToast: (feature, on) => `${feature} platform flag turned ${on ? 'on' : 'off'}.`,
    planToast: (feature, plan, on) => `${feature} ${on ? 'enabled' : 'disabled'} for ${plan}.`,
    rolloutToast: (feature, pct) => `${feature} rollout set to ${pct}%.`,
    removeToast: 'Override removed.',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'إدارة الخصائص',
    sub: 'الحالة الفعلية = علم المنصة ← استثناء الشركة ← الباقة.',
    colFeature: 'الخاصية',
    colPlatform: 'علم المنصة',
    colRollout: 'نسبة الطرح',
    planLabel: { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' },
    overridesTitle: 'استثناءات الشركات',
    overridesSub: 'استثناءات مؤقتة عن حدود الباقة',
    colCompany: 'الشركة',
    colFeatureOv: 'الخاصية',
    colValue: 'الاستثناء',
    colExpires: 'تنتهي',
    colReason: 'السبب',
    remove: 'إزالة',
    valueOn: 'مفعّلة',
    valueOff: 'معطّلة',
    confirmPlanTitle: (feature, plan, on) => `${on ? 'تفعيل' : 'تعطيل'} ${feature} لباقة ${plan}`,
    confirmPlanBody: (count, on) =>
      `سيتم ${on ? 'إضافة' : 'إزالة'} الخاصية لعدد ${count} شركة على هذه الباقة.`,
    flagTitle: (feature, on) => `${on ? 'تفعيل' : 'تعطيل'} علم المنصة: ${feature}`,
    flagBody: (on) =>
      on
        ? 'تصبح الخاصية متاحة مجددًا وفقًا للباقة والاستثناءات.'
        : 'هذا مفتاح إيقاف شامل — يعطّل الخاصية فورًا لكل الشركات بغض النظر عن الباقة أو الاستثناءات.',
    reasonLabel: 'السبب',
    ackText: 'أتفهم أن هذا التغيير يسري فورًا.',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    rolloutTitle: (feature) => `نسبة الطرح — ${feature}`,
    rolloutLabel: 'نسبة الشركات المؤهلة (0–100)',
    removeTitle: (company) => `إزالة الاستثناء عن ${company}`,
    removeBody: 'تعود الشركة لحدود باقتها لهذه الخاصية.',
    flagToast: (feature, on) => `تم ${on ? 'تفعيل' : 'تعطيل'} علم المنصة لـ ${feature}.`,
    planToast: (feature, plan, on) => `تم ${on ? 'تفعيل' : 'تعطيل'} ${feature} لباقة ${plan}.`,
    rolloutToast: (feature, pct) => `تم ضبط نسبة طرح ${feature} إلى ${pct}%.`,
    removeToast: 'تمت إزالة الاستثناء.',
  },
};

@Component({
  selector: 'app-feature-management',
  imports: [FormsModule],
  templateUrl: './feature-management.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './feature-management.scss'],
})
export class FeatureManagement {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  private readonly api = inject(FeaturesApi);
  private readonly companiesApi = inject(CompaniesApi);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly catalogPlans = signal<
    Array<{ key: string; nameEn: string; nameAr: string; companies: number }>
  >([]);
  get planOrder() {
    return this.catalogPlans().map((p) => p.key);
  }
  readonly companies = signal<
    Array<{ id: string; nameEn: string; nameAr?: string; plan?: string }>
  >([]);
  readonly duration = signal<'7' | '30' | '90' | '365'>('30');
  readonly effective = signal<any>(null);
  readonly adding = signal(false);
  draft = {
    companyId: '',
    featureKey: '',
    enabled: true,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    reason: '',
  };
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.catalog();
      this.features.set(data.features);
      this.overrides.set(data.overrides);
      this.catalogPlans.set(data.plans);
      this.companies.set(await this.companiesApi.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load features');
    } finally {
      this.loading.set(false);
    }
  }
  openAdd() {
    this.error.set('');
    this.draft = {
      companyId: '',
      featureKey: this.features()[0]?.key ?? '',
      enabled: true,
      expiresAt: '',
      reason: '',
    };
    this.setDuration('30');
    this.adding.set(true);
  }
  setDuration(d: '7' | '30' | '90' | '365') {
    this.duration.set(d);
    this.draft.expiresAt = new Date(Date.now() + Number(d) * 86400000).toISOString().slice(0, 10);
  }
  async saveOverride() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const state = await this.api.effective(this.draft.companyId);
      await this.api.override({
        companyId: this.draft.companyId,
        featureKey: this.draft.featureKey,
        enabled: this.draft.enabled,
        expiresAt: new Date(this.draft.expiresAt + 'T23:59:59Z').toISOString(),
        reason: this.draft.reason,
        version: state.version,
      });
      this.adding.set(false);
      await this.reload();
      this.showToast(this.lang() === 'ar' ? 'تم حفظ الاستثناء.' : 'Override saved.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save override');
    } finally {
      this.saving.set(false);
    }
  }
  async previewCompany(id: string) {
    try {
      this.effective.set(await this.api.effective(id));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to evaluate company');
    }
  }

  readonly features = signal<FeatureDef[]>([]);
  readonly overrides = signal<Override[]>([]);

  readonly planConfirm = signal<{ feature: FeatureDef; plan: PlanKey; next: boolean } | null>(null);
  readonly flagConfirm = signal<{ feature: FeatureDef; next: boolean } | null>(null);
  readonly flagReason = signal('');
  readonly flagAck = signal(false);
  readonly rolloutEditing = signal<FeatureDef | null>(null);
  readonly rolloutDraft = signal(0);
  readonly removeConfirm = signal<Override | null>(null);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(f: FeatureDef): string {
    return this.lang() === 'ar' ? f.nameAr : f.nameEn;
  }

  planName(p: PlanKey): string {
    const plan = this.catalogPlans().find((v) => v.key === p);
    return plan ? (this.lang() === 'ar' ? plan.nameAr : plan.nameEn) : p;
  }

  planCompanies(p: PlanKey): number {
    return this.catalogPlans().find((v) => v.key === p)?.companies ?? 0;
  }

  overrideCompany(o: Override): string {
    return this.lang() === 'ar' ? o.companyAr : o.companyEn;
  }

  overrideReason(o: Override): string {
    return this.lang() === 'ar' ? o.reasonAr : o.reasonEn;
  }

  overrideFeatureName(o: Override): string {
    const f = this.features().find((x) => x.key === o.featureKey);
    return f ? this.name(f) : o.featureKey;
  }

  readonly stats = computed(() => {
    const f = this.features();
    return {
      total: f.length,
      overrides: this.overrides().length,
      rolling: f.filter((x) => x.platformOn && x.rollout < 100),
      off: f.filter((x) => !x.platformOn).length,
    };
  });
  /** "from Pro" = lowest plan (catalog order) that includes the feature. */
  fromPlan(f: FeatureDef): string {
    const first = this.planOrder.find((p) => f.plans[p]);
    const ar = this.lang() === 'ar';
    if (!first) return ar ? 'غير مضمنة في أي باقة' : 'not in any plan';
    return first === this.planOrder[0]
      ? ar
        ? 'أساسية'
        : 'core'
      : (ar ? 'من ' : 'from ') + this.planName(first);
  }
  private company(o: Override) {
    return this.companies().find((c) => c.id === o.companyId);
  }
  overridePlan(o: Override): string {
    const p = this.company(o)?.plan;
    return p ? this.planName(p) : '—';
  }
  /** Effective = platform flag AND override value (override beats plan + rollout). */
  effectiveOf(o: Override): { on: boolean; why: string } {
    const f = this.features().find((x) => x.key === o.featureKey);
    const ar = this.lang() === 'ar';
    if (f && !f.platformOn)
      return { on: false, why: ar ? 'مفتاح المنصة معطل' : 'platform flag is off' };
    const plan = this.company(o)?.plan;
    const inPlan = !!(f && plan && f.plans[plan]);
    if (!o.value)
      return {
        on: false,
        why: ar ? 'الاستثناء يلغي ميزة الباقة' : 'override removes plan feature',
      };
    return {
      on: true,
      why: inPlan
        ? ar
          ? 'ضمن الباقة'
          : 'already in plan'
        : ar
          ? 'الاستثناء يتجاوز الباقة'
          : 'override beats plan',
    };
  }
  date(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  deprecatedSoon() {
    this.showToast(
      this.lang() === 'ar'
        ? 'حالة الإيقاف غير مدعومة بعد — لم يتغير شيء.'
        : "Deprecation isn't supported yet — nothing was changed.",
    );
  }

  askPlanToggle(f: FeatureDef, plan: PlanKey): void {
    this.planConfirm.set({ feature: f, plan, next: !f.plans[plan] });
  }

  cancelPlanConfirm(): void {
    this.planConfirm.set(null);
  }

  async confirmPlanToggle() {
    const t = this.planConfirm();
    if (!t || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.change(t.feature.key, {
        action: 'plan',
        version: t.feature.version,
        plan: t.plan,
        enabled: t.next,
        reason: 'Plan entitlement updated by platform administrator',
      });
      this.planConfirm.set(null);
      await this.reload();
      this.showToast(this.L().planToast(this.name(t.feature), this.planName(t.plan), t.next));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save entitlement');
    } finally {
      this.saving.set(false);
    }
  }

  askFlagToggle(f: FeatureDef): void {
    this.flagConfirm.set({ feature: f, next: !f.platformOn });
    this.flagReason.set('');
    this.flagAck.set(false);
  }

  cancelFlagConfirm(): void {
    this.flagConfirm.set(null);
  }

  toggleAck(): void {
    this.flagAck.set(!this.flagAck());
  }

  async confirmFlagToggle() {
    const t = this.flagConfirm();
    if (!t || this.saving() || this.flagConfirmBlocked()) return;
    this.saving.set(true);
    try {
      await this.api.change(t.feature.key, {
        action: 'flag',
        version: t.feature.version,
        enabled: t.next,
        reason: this.flagReason().trim() || 'Feature enabled by platform administrator',
      });
      this.flagConfirm.set(null);
      await this.reload();
      this.showToast(this.L().flagToast(this.name(t.feature), t.next));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save flag');
    } finally {
      this.saving.set(false);
    }
  }

  flagConfirmBlocked(): boolean {
    const target = this.flagConfirm();
    if (!target || target.next) return false;
    return this.flagReason().trim().length < 5 || !this.flagAck();
  }

  openRollout(f: FeatureDef): void {
    this.rolloutEditing.set(f);
    this.rolloutDraft.set(f.rollout);
  }

  closeRollout(): void {
    this.rolloutEditing.set(null);
  }

  async saveRollout() {
    const f = this.rolloutEditing();
    if (!f || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.change(f.key, {
        action: 'rollout',
        version: f.version,
        rollout: Number(this.rolloutDraft()),
        reason: 'Rollout updated by platform administrator',
      });
      this.rolloutEditing.set(null);
      await this.reload();
      this.showToast(this.L().rolloutToast(this.name(f), Number(this.rolloutDraft())));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save rollout');
    } finally {
      this.saving.set(false);
    }
  }

  askRemove(o: Override): void {
    this.removeConfirm.set(o);
  }

  cancelRemove(): void {
    this.removeConfirm.set(null);
  }

  async confirmRemove() {
    const o = this.removeConfirm();
    if (!o || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.remove(o.id, {
        version: o.version,
        reason: 'Company feature override removed by administrator',
      });
      this.removeConfirm.set(null);
      await this.reload();
      this.showToast(this.L().removeToast);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to remove override');
    } finally {
      this.saving.set(false);
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
