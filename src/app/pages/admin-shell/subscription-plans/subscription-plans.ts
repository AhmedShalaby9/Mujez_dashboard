import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PlanKey = 'starter' | 'pro' | 'business' | 'enterprise';
type EditScope = 'new' | 'renewal' | 'migrate';

interface PlanLimit {
  labelEn: string;
  labelAr: string;
  value: string;
}

interface PlanDef {
  key: PlanKey;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  priceEn: string;
  priceAr: string;
  perEn: string;
  perAr: string;
  limits: PlanLimit[];
  featsEn: string;
  featsAr: string;
  companies: number;
  color: string;
}

const PLANS: PlanDef[] = [
  {
    key: 'starter',
    nameEn: 'Starter',
    nameAr: 'أساسية',
    descEn: 'For small, single-office brokerages getting started.',
    descAr: 'للوسطاء الصغار من مكتب واحد في بداية الطريق.',
    priceEn: 'EGP 990',
    priceAr: '990 ج.م',
    perEn: 'per month',
    perAr: 'شهريًا',
    limits: [
      { labelEn: 'Users', labelAr: 'المستخدمون', value: '5' },
      { labelEn: 'Listings', labelAr: 'الوحدات المعروضة', value: '200' },
      { labelEn: 'Projects', labelAr: 'المشاريع', value: '2' },
      { labelEn: 'Storage', labelAr: 'التخزين', value: '5 GB' },
    ],
    featsEn: 'Leads · Pipeline · Contacts · Calendar · Tasks',
    featsAr: 'العملاء المحتملون · خط الصفقات · جهات الاتصال · التقويم · المهام',
    companies: 9,
    color: '#C3C5D6',
  },
  {
    key: 'pro',
    nameEn: 'Pro',
    nameAr: 'احترافية',
    descEn: 'For growing teams that need reporting and routing.',
    descAr: 'للفرق المتنامية التي تحتاج تقارير وتوجيه عملاء.',
    priceEn: 'EGP 2,900',
    priceAr: '2,900 ج.م',
    perEn: 'per month',
    perAr: 'شهريًا',
    limits: [
      { labelEn: 'Users', labelAr: 'المستخدمون', value: '25' },
      { labelEn: 'Listings', labelAr: 'الوحدات المعروضة', value: '2,000' },
      { labelEn: 'Projects', labelAr: 'المشاريع', value: '10' },
      { labelEn: 'Storage', labelAr: 'التخزين', value: '50 GB' },
    ],
    featsEn: '+ Reports · Lead routing · Marketing · Documents',
    featsAr: '+ التقارير · توجيه العملاء · التسويق · المستندات',
    companies: 8,
    color: '#3D4FD6',
  },
  {
    key: 'business',
    nameEn: 'Business',
    nameAr: 'أعمال',
    descEn: 'For multi-branch brokerages and developers.',
    descAr: 'للوسطاء متعددي الفروع والمطورين العقاريين.',
    priceEn: 'EGP 7,900',
    priceAr: '7,900 ج.م',
    perEn: 'per month',
    perAr: 'شهريًا',
    limits: [
      { labelEn: 'Users', labelAr: 'المستخدمون', value: '100' },
      { labelEn: 'Listings', labelAr: 'الوحدات المعروضة', value: '10,000' },
      { labelEn: 'Projects', labelAr: 'المشاريع', value: '50' },
      { labelEn: 'Storage', labelAr: 'التخزين', value: '250 GB' },
    ],
    featsEn: '+ Commission splits · Custom roles · API access',
    featsAr: '+ تقسيم العمولات · أدوار مخصصة · وصول API',
    companies: 5,
    color: '#7E89E6',
  },
  {
    key: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'مؤسسات',
    descEn: 'For large developers and portfolio owners.',
    descAr: 'للمطورين الكبار وملّاك المحافظ العقارية.',
    priceEn: 'Custom',
    priceAr: 'مخصص',
    perEn: 'contact sales',
    perAr: 'تواصل مع المبيعات',
    limits: [
      { labelEn: 'Users', labelAr: 'المستخدمون', value: 'Unlimited' },
      { labelEn: 'Listings', labelAr: 'الوحدات المعروضة', value: 'Unlimited' },
      { labelEn: 'Projects', labelAr: 'المشاريع', value: 'Unlimited' },
      { labelEn: 'Storage', labelAr: 'التخزين', value: '1 TB+' },
    ],
    featsEn: '+ SSO · Dedicated support · SLAs · White-label',
    featsAr: '+ تسجيل دخول موحد · دعم مخصص · اتفاقيات مستوى الخدمة · علامة بيضاء',
    companies: 2,
    color: '#F5B841',
  },
];

interface Copy {
  eyebrow: string;
  title: string;
  addBtn: string;
  comingSoon: string;
  viewSubscribers: (n: number) => string;
  editBtn: string;
  archiveBtn: string;
  restoreBtn: string;
  archivedBadge: string;
  editTitle: string;
  editSub: (name: string) => string;
  scopeNew: string;
  scopeNewSub: string;
  scopeRenewal: string;
  scopeRenewalSub: string;
  scopeMigrate: string;
  scopeMigrateSub: string;
  cancel: string;
  continue: string;
  editToast: (name: string) => string;
  archiveTitle: string;
  archiveBody: (name: string) => string;
  restoreTitle: string;
  restoreBody: (name: string) => string;
  confirmGo: string;
  archivedToast: (name: string) => string;
  restoredToast: (name: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Billing',
    title: 'Subscription plans',
    addBtn: 'Add plan',
    comingSoon: 'Coming soon',
    viewSubscribers: (n) => `${n} ${n === 1 ? 'company' : 'companies'} →`,
    editBtn: 'Edit plan',
    archiveBtn: 'Archive',
    restoreBtn: 'Restore',
    archivedBadge: 'Archived',
    editTitle: 'Edit plan',
    editSub: (name) => `${name} · choose what this change applies to.`,
    scopeNew: 'New subscriptions only',
    scopeNewSub: 'Existing subscribers keep their current terms.',
    scopeRenewal: 'Existing, at next renewal',
    scopeRenewalSub: 'Every subscriber on this plan moves at their next billing cycle.',
    scopeMigrate: 'Selected, via explicit migration',
    scopeMigrateSub: "You'll pick specific companies to migrate immediately.",
    cancel: 'Cancel',
    continue: 'Continue',
    editToast: (name) => `Static design preview — changes to ${name} are not persisted.`,
    archiveTitle: 'Archive plan',
    archiveBody: (name) => `${name} will be hidden from new subscriptions. Existing subscribers keep this plan.`,
    restoreTitle: 'Restore plan',
    restoreBody: (name) => `${name} becomes available for new subscriptions again.`,
    confirmGo: 'Confirm',
    archivedToast: (name) => `${name} was archived.`,
    restoredToast: (name) => `${name} was restored.`,
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'خطط الاشتراك',
    addBtn: 'إضافة خطة',
    comingSoon: 'قريبًا',
    viewSubscribers: (n) => `${n} ${n === 1 ? 'شركة' : 'شركات'} ←`,
    editBtn: 'تعديل الخطة',
    archiveBtn: 'أرشفة',
    restoreBtn: 'استعادة',
    archivedBadge: 'مؤرشفة',
    editTitle: 'تعديل الخطة',
    editSub: (name) => `${name} · اختر نطاق هذا التغيير.`,
    scopeNew: 'الاشتراكات الجديدة فقط',
    scopeNewSub: 'يحتفظ المشتركون الحاليون بشروطهم الحالية.',
    scopeRenewal: 'الحاليون، عند التجديد القادم',
    scopeRenewalSub: 'ينتقل كل مشترك في هذه الخطة عند دورة الفوترة القادمة.',
    scopeMigrate: 'شركات محددة، عبر ترحيل صريح',
    scopeMigrateSub: 'ستختار شركات معينة للترحيل فورًا.',
    cancel: 'إلغاء',
    continue: 'متابعة',
    editToast: (name) => `معاينة تصميم ثابتة — التغييرات على ${name} غير محفوظة.`,
    archiveTitle: 'أرشفة الخطة',
    archiveBody: (name) => `ستُخفى ${name} عن الاشتراكات الجديدة. يحتفظ المشتركون الحاليون بهذه الخطة.`,
    restoreTitle: 'استعادة الخطة',
    restoreBody: (name) => `ستصبح ${name} متاحة للاشتراكات الجديدة مجددًا.`,
    confirmGo: 'تأكيد',
    archivedToast: (name) => `تمت أرشفة ${name}.`,
    restoredToast: (name) => `تمت استعادة ${name}.`,
  },
};

@Component({
  selector: 'app-subscription-plans',
  templateUrl: './subscription-plans.html',
  styleUrl: './subscription-plans.scss',
})
export class SubscriptionPlans {
  private readonly ui = inject(AdminUiState);
  private readonly router = inject(Router);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly plans = PLANS;

  private readonly archived = signal<Set<PlanKey>>(new Set());

  readonly editing = signal<PlanDef | null>(null);
  readonly editScope = signal<EditScope>('new');
  readonly confirming = signal<{ plan: PlanDef; kind: 'archive' | 'restore' } | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(p: PlanDef): string {
    return this.lang() === 'ar' ? p.nameAr : p.nameEn;
  }

  desc(p: PlanDef): string {
    return this.lang() === 'ar' ? p.descAr : p.descEn;
  }

  price(p: PlanDef): string {
    return this.lang() === 'ar' ? p.priceAr : p.priceEn;
  }

  per(p: PlanDef): string {
    return this.lang() === 'ar' ? p.perAr : p.perEn;
  }

  feats(p: PlanDef): string {
    return this.lang() === 'ar' ? p.featsAr : p.featsEn;
  }

  limitLabel(l: PlanLimit): string {
    return this.lang() === 'ar' ? l.labelAr : l.labelEn;
  }

  isArchived(p: PlanDef): boolean {
    return this.archived().has(p.key);
  }

  viewSubscribers(p: PlanDef): void {
    this.router.navigate(['/admin/subscriptions'], { queryParams: { plan: p.key } });
  }

  openEdit(p: PlanDef): void {
    this.editing.set(p);
    this.editScope.set('new');
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  submitEdit(): void {
    const p = this.editing();
    if (!p) return;
    this.closeEdit();
    this.showToast(this.L().editToast(this.name(p)));
  }

  askConfirm(p: PlanDef, kind: 'archive' | 'restore'): void {
    this.confirming.set({ plan: p, kind });
  }

  cancelConfirm(): void {
    this.confirming.set(null);
  }

  performConfirm(): void {
    const target = this.confirming();
    if (!target) return;
    this.archived.update((set) => {
      const next = new Set(set);
      if (target.kind === 'archive') next.add(target.plan.key);
      else next.delete(target.plan.key);
      return next;
    });
    const name = this.name(target.plan);
    this.showToast(target.kind === 'archive' ? this.L().archivedToast(name) : this.L().restoredToast(name));
    this.confirming.set(null);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
