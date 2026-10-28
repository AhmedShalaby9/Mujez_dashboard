import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PlanKey = 'starter' | 'pro' | 'business' | 'enterprise';

interface FeatureDef {
  key: string;
  nameEn: string;
  nameAr: string;
  platformOn: boolean;
  rollout: number;
  plans: Record<PlanKey, boolean>;
}

const PLAN_COMPANIES: Record<PlanKey, number> = {
  starter: 9,
  pro: 8,
  business: 5,
  enterprise: 2,
};

const SEED: FeatureDef[] = [
  { key: 'whatsapp', nameEn: 'WhatsApp Business integration', nameAr: 'تكامل واتساب بيزنس', platformOn: true, rollout: 100, plans: { starter: false, pro: true, business: true, enterprise: true } },
  { key: 'routing_adv', nameEn: 'Advanced lead routing', nameAr: 'توجيه العملاء المتقدم', platformOn: true, rollout: 100, plans: { starter: false, pro: false, business: true, enterprise: true } },
  { key: 'ai_summary', nameEn: 'AI customer summary', nameAr: 'ملخص العميل بالذكاء الاصطناعي', platformOn: true, rollout: 60, plans: { starter: false, pro: false, business: true, enterprise: true } },
  { key: 'bulk_import', nameEn: 'Inventory bulk import', nameAr: 'استيراد المخزون بالجملة', platformOn: true, rollout: 100, plans: { starter: true, pro: true, business: true, enterprise: true } },
  { key: 'commissions', nameEn: 'Commission management', nameAr: 'إدارة العمولات', platformOn: true, rollout: 100, plans: { starter: false, pro: true, business: true, enterprise: true } },
  { key: 'custom_roles', nameEn: 'Custom roles', nameAr: 'أدوار مخصصة', platformOn: true, rollout: 100, plans: { starter: false, pro: false, business: true, enterprise: true } },
  { key: 'api_access', nameEn: 'API access', nameAr: 'الوصول عبر API', platformOn: true, rollout: 35, plans: { starter: false, pro: false, business: false, enterprise: true } },
  { key: 'white_label', nameEn: 'White-label branding', nameAr: 'العلامة التجارية الخاصة', platformOn: true, rollout: 100, plans: { starter: false, pro: false, business: false, enterprise: true } },
  { key: 'sms', nameEn: 'SMS notifications', nameAr: 'إشعارات SMS', platformOn: true, rollout: 100, plans: { starter: true, pro: true, business: true, enterprise: true } },
  { key: 'reports_adv', nameEn: 'Advanced reports', nameAr: 'تقارير متقدمة', platformOn: false, rollout: 0, plans: { starter: false, pro: true, business: true, enterprise: true } },
];

interface Override {
  id: string;
  companyEn: string;
  companyAr: string;
  featureKey: string;
  value: boolean;
  expires: string;
  reasonEn: string;
  reasonAr: string;
}

const OVERRIDES_SEED: Override[] = [
  { id: 'ov-1', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', featureKey: 'ai_summary', value: true, expires: 'Nov 15, 2026', reasonEn: 'Pilot for enterprise renewal', reasonAr: 'تجربة قبل التجديد' },
  { id: 'ov-2', companyEn: 'Blue Lagoon Realty', companyAr: 'بلو لاغون العقارية', featureKey: 'api_access', value: true, expires: 'Dec 1, 2026', reasonEn: 'Early access program', reasonAr: 'برنامج الوصول المبكر' },
  { id: 'ov-3', companyEn: 'Deira Properties', companyAr: 'ديرة العقارية', featureKey: 'routing_adv', value: false, expires: 'Never', reasonEn: 'Disabled after support ticket #2031', reasonAr: 'معطّلة بعد تذكرة الدعم #2031' },
];

const PLAN_ORDER: PlanKey[] = ['starter', 'pro', 'business', 'enterprise'];

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
    confirmPlanBody: (count, on) => `سيتم ${on ? 'إضافة' : 'إزالة'} الخاصية لعدد ${count} شركة على هذه الباقة.`,
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
  styleUrl: './feature-management.scss',
})
export class FeatureManagement {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly planOrder = PLAN_ORDER;

  readonly features = signal<FeatureDef[]>(SEED);
  readonly overrides = signal<Override[]>(OVERRIDES_SEED);

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
    return this.L().planLabel[p];
  }

  planCompanies(p: PlanKey): number {
    return PLAN_COMPANIES[p];
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

  askPlanToggle(f: FeatureDef, plan: PlanKey): void {
    this.planConfirm.set({ feature: f, plan, next: !f.plans[plan] });
  }

  cancelPlanConfirm(): void {
    this.planConfirm.set(null);
  }

  confirmPlanToggle(): void {
    const target = this.planConfirm();
    if (!target) return;
    this.features.update((list) =>
      list.map((f) =>
        f.key === target.feature.key ? { ...f, plans: { ...f.plans, [target.plan]: target.next } } : f,
      ),
    );
    this.showToast(this.L().planToast(this.name(target.feature), this.planName(target.plan), target.next));
    this.planConfirm.set(null);
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

  confirmFlagToggle(): void {
    const target = this.flagConfirm();
    if (!target) return;
    if (!target.next && (this.flagReason().trim().length < 5 || !this.flagAck())) return;
    this.features.update((list) =>
      list.map((f) => (f.key === target.feature.key ? { ...f, platformOn: target.next } : f)),
    );
    this.showToast(this.L().flagToast(this.name(target.feature), target.next));
    this.flagConfirm.set(null);
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

  saveRollout(): void {
    const f = this.rolloutEditing();
    if (!f) return;
    const pct = Math.max(0, Math.min(100, Math.round(this.rolloutDraft())));
    this.features.update((list) => list.map((x) => (x.key === f.key ? { ...x, rollout: pct } : x)));
    this.showToast(this.L().rolloutToast(this.name(f), pct));
    this.rolloutEditing.set(null);
  }

  askRemove(o: Override): void {
    this.removeConfirm.set(o);
  }

  cancelRemove(): void {
    this.removeConfirm.set(null);
  }

  confirmRemove(): void {
    const target = this.removeConfirm();
    if (!target) return;
    this.overrides.update((list) => list.filter((o) => o.id !== target.id));
    this.showToast(this.L().removeToast);
    this.removeConfirm.set(null);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
