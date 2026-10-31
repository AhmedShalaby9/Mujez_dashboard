import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth.service';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';

type PlanKey = string;
type EditScope = 'new' | 'renewal' | 'migrate';

interface PlanLimit {
  labelEn: string;
  labelAr: string;
  value: string;
}

interface PlanDef {
  version: number;
  planVersionId: string;
  archived: boolean;
  monthlyMinor: number;
  annualMinor: number;
  users: number | null;
  listings: number | null;
  projects: number | null;
  storageGb: number | null;
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
    scopeRenewalSub: 'Apply the updated terms when each subscription is manually renewed.',
    scopeMigrate: 'Selected, via explicit migration',
    scopeMigrateSub: "You'll pick specific companies to migrate immediately.",
    cancel: 'Cancel',
    continue: 'Continue',
    editToast: (name) => `Static design preview — changes to ${name} are not persisted.`,
    archiveTitle: 'Archive plan',
    archiveBody: (name) =>
      `${name} will be hidden from new subscriptions. Existing subscribers keep this plan.`,
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
    scopeRenewalSub: 'تُطبّق الشروط عند التجديد اليدوي القادم لكل اشتراك.',
    scopeMigrate: 'شركات محددة، عبر ترحيل صريح',
    scopeMigrateSub: 'ستختار شركات معينة للترحيل فورًا.',
    cancel: 'إلغاء',
    continue: 'متابعة',
    editToast: (name) => `معاينة تصميم ثابتة — التغييرات على ${name} غير محفوظة.`,
    archiveTitle: 'أرشفة الخطة',
    archiveBody: (name) =>
      `ستُخفى ${name} عن الاشتراكات الجديدة. يحتفظ المشتركون الحاليون بهذه الخطة.`,
    restoreTitle: 'استعادة الخطة',
    restoreBody: (name) => `ستصبح ${name} متاحة للاشتراكات الجديدة مجددًا.`,
    confirmGo: 'تأكيد',
    archivedToast: (name) => `تمت أرشفة ${name}.`,
    restoredToast: (name) => `تمت استعادة ${name}.`,
  },
};

@Component({
  selector: 'app-subscription-plans',
  imports: [FormsModule],
  templateUrl: './subscription-plans.html',
  styleUrls: ['../admin-ui.scss', './subscription-plans.scss'],
})
export class SubscriptionPlans {
  private readonly ui = inject(AdminUiState);
  private readonly router = inject(Router);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  private readonly api = inject(SubscriptionsApi);
  private readonly auth = inject(AuthService);
  readonly cycle = signal<'m' | 'a'>('m');
  readonly archiveNote = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly records = signal<PlanDef[]>([]);
  get plans() {
    return this.records();
  }
  readonly creating = signal(false);
  readonly selectedIds = signal<string[]>([]);
  readonly subscribers = signal<
    Array<{ subId: string; companyEn: string; plan: string; mrr: number; status: string }>
  >([]);
  readonly canSubs = computed(() => !!this.auth.user()?.permissions?.includes('sub.manage'));
  draft = {
    key: 'starter',
    nameEn: '',
    nameAr: '',
    descEn: '',
    descAr: '',
    monthlyPrice: 0,
    annualPrice: 0,
    users: null as number | null,
    listings: null as number | null,
    projects: null as number | null,
    storageGb: null as number | null,
    featsEn: '',
    featsAr: '',
  };
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.plans();
      this.records.set(
        data.map((v: any) => ({
          ...v,
          priceEn: 'EGP ' + (v.monthlyMinor / 100).toLocaleString('en-US'),
          priceAr: (v.monthlyMinor / 100).toLocaleString('en-US') + ' ج.م',
          perEn: 'per month',
          perAr: 'شهريًا',
          color: (
            {
              starter: '#a1a1a6',
              pro: '#111113',
              business: '#8BB33A',
              enterprise: '#c8f169',
            } as Record<string, string>
          )[v.key],
          limits: [
            {
              labelEn: 'Users',
              labelAr: 'المستخدمون',
              value: v.users === null ? 'Unlimited' : String(v.users),
            },
            {
              labelEn: 'Listings',
              labelAr: 'الوحدات',
              value: v.listings === null ? 'Unlimited' : String(v.listings),
            },
            {
              labelEn: 'Projects',
              labelAr: 'المشاريع',
              value: v.projects === null ? 'Unlimited' : String(v.projects),
            },
            {
              labelEn: 'Storage (GB)',
              labelAr: 'التخزين (جيجابايت)',
              value: v.storageGb === null ? 'Unlimited' : String(v.storageGb),
            },
          ],
        })),
      );
      if (this.canSubs()) this.subscribers.set(await this.api.subscriptions());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load plans');
    } finally {
      this.loading.set(false);
    }
  }
  openCreate() {
    this.error.set('');
    this.creating.set(true);
    this.editing.set(null);
    this.draft = {
      key: 'starter',
      nameEn: '',
      nameAr: '',
      descEn: '',
      descAr: '',
      monthlyPrice: 0,
      annualPrice: 0,
      users: null,
      listings: null,
      projects: null,
      storageGb: null,
      featsEn: '',
      featsAr: '',
    };
  }
  toggleSelected(id: string) {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
    );
  }

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
    return p.archived;
  }

  viewSubscribers(p: PlanDef): void {
    this.router.navigate(['/admin/subscriptions'], { queryParams: { plan: p.key } });
  }

  openEdit(p: PlanDef): void {
    this.error.set('');
    this.creating.set(false);
    this.selectedIds.set([]);
    this.draft = {
      key: p.key,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      descEn: p.descEn,
      descAr: p.descAr,
      monthlyPrice: p.monthlyMinor / 100,
      annualPrice: p.annualMinor / 100,
      users: p.users,
      listings: p.listings,
      projects: p.projects,
      storageGb: p.storageGb,
      featsEn: p.featsEn,
      featsAr: p.featsAr,
    };
    this.editing.set(p);
    this.editScope.set('new');
  }

  closeEdit(): void {
    this.creating.set(false);
    this.editing.set(null);
  }

  async submitEdit() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const { key, monthlyPrice, annualPrice, ...rest } = this.draft;
      const terms = {
        ...rest,
        monthlyMinor: Math.round(Number(monthlyPrice) * 100),
        annualMinor: Math.round(Number(annualPrice) * 100),
      };
      const current = this.editing();
      await this.api.savePlan(
        current
          ? {
              ...terms,
              version: current.version,
              scope: this.editScope(),
              selectedIds: this.selectedIds(),
            }
          : { ...terms, key },
        current?.key,
      );
      this.closeEdit();
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save plan');
    } finally {
      this.saving.set(false);
    }
  }

  askConfirm(p: PlanDef, kind: 'archive' | 'restore'): void {
    this.archiveNote.set('');
    this.confirming.set({ plan: p, kind });
  }
  readonly totalCompanies = computed(() =>
    this.records().reduce((n, p) => n + (p.companies || 0), 0),
  );
  /** "Most popular" goes to the plan with the most current subscribers. */
  readonly popular = computed(() => {
    const live = this.records().filter((p) => !p.archived && p.companies > 0);
    return live.length ? live.reduce((a, b) => (b.companies > a.companies ? b : a)).key : null;
  });
  money(minor: number) {
    return Math.round(minor / 100).toLocaleString('en-US');
  }
  priceNow(p: PlanDef) {
    return this.money(this.cycle() === 'a' ? p.annualMinor : p.monthlyMinor);
  }
  perNow() {
    const ar = this.lang() === 'ar';
    return this.cycle() === 'a' ? (ar ? ' / سنة' : ' / year') : ar ? ' / شهر' : ' / month';
  }
  altPrice(p: PlanDef) {
    const ar = this.lang() === 'ar';
    return this.cycle() === 'a'
      ? '≈ EGP ' + this.money(p.annualMinor / 12) + (ar ? ' / شهر' : ' / month')
      : 'EGP ' + this.money(p.annualMinor) + (ar ? ' سنويًا' : ' billed yearly');
  }
  /** Sum of current subscription MRR on this plan (needs `sub.manage`). */
  planMrr(p: PlanDef): string {
    if (!this.canSubs()) return '—';
    const v = this.subscribers()
      .filter((s) => s.plan === p.key)
      .reduce((n, s) => n + (Number(s.mrr) || 0), 0);
    return (
      'EGP ' +
      (v >= 1e6
        ? (v / 1e6).toFixed(2) + 'M'
        : v >= 1e4
          ? Math.round(v / 1000) + 'K'
          : Math.round(v).toLocaleString('en-US'))
    );
  }
  limitRows(p: PlanDef) {
    const ar = this.lang() === 'ar';
    const lv = (v: number | null, u = '') =>
      v === null ? (ar ? 'غير محدود' : 'Unlimited') : v.toLocaleString('en-US') + u;
    return [
      { k: ar ? 'المستخدمون' : 'Users', v: lv(p.users) },
      { k: ar ? 'الوحدات' : 'Listings', v: lv(p.listings) },
      { k: ar ? 'المشروعات' : 'Projects', v: lv(p.projects) },
      { k: ar ? 'التخزين' : 'Storage', v: lv(p.storageGb, ' GB') },
    ];
  }
  /** Feature chips from the plan's free-text feature list. */
  chips(p: PlanDef): string[] {
    return this.feats(p)
      .split(/[,،\n·;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  cancelConfirm(): void {
    this.confirming.set(null);
  }

  async performConfirm() {
    const target = this.confirming();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.archive(target.plan.key, target.plan.version, target.kind === 'archive');
      this.confirming.set(null);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update plan');
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
