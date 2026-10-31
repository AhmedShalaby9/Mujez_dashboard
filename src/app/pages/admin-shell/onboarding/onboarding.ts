import { CompaniesApi } from '../../../companies-api.service';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type OnboardStatus = 'trial' | 'pending';

interface OnboardingCompany {
  version: number;
  slug: string;
  plan: string;
  completedKeys: string[];
  id: string;
  nameEn: string;
  nameAr: string;
  status: OnboardStatus;
  signedUp: string;
  completedSteps: number;
  stuckDays: number;
}

interface StepDef {
  labelEn: string;
  labelAr: string;
}

const STEPS: StepDef[] = [
  { labelEn: 'Admin activated', labelAr: 'تفعيل المدير' },
  { labelEn: 'Inventory imported', labelAr: 'استيراد الوحدات' },
  { labelEn: 'Team invited', labelAr: 'دعوة الفريق' },
  { labelEn: 'Lead sources connected', labelAr: 'ربط مصادر العملاء' },
  { labelEn: 'First deal', labelAr: 'أول صفقة' },
];

const STUCK_THRESHOLD = 7;
const PLAN_LABEL: Record<string, [string, string]> = {
  starter: ['Starter', 'أساسية'],
  pro: ['Pro', 'احترافية'],
  business: ['Business', 'أعمال'],
  enterprise: ['Enterprise', 'مؤسسات'],
};
const LOGO: Array<[string, string]> = [
  ['#EEF5D6', '#3F5A0E'],
  ['#E6EEFB', '#274A93'],
  ['#F6E8DE', '#8A4A1E'],
  ['#EDE7F8', '#55349A'],
  ['#E3F2EF', '#1D6458'],
  ['#F7E4E7', '#933045'],
];

interface Copy {
  eyebrow: string;
  title: string;
  statusAll: string;
  statusTrial: string;
  statusPending: string;
  kpis: { total: string; avgProgress: string; stuck: string };
  signedUp: string;
  stepOf: (done: number, total: number) => string;
  stuckBadge: (days: number) => string;
  sendReminder: string;
  view: string;
  drawerClose: string;
  drawerSteps: string;
  reminderToast: (name: string) => string;
  emptyTitle: string;
  emptySub: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Companies',
    title: 'Onboarding',
    statusAll: 'All',
    statusTrial: 'Trial',
    statusPending: 'Pending',
    kpis: { total: 'In onboarding', avgProgress: 'Average progress', stuck: 'Stuck > 7 days' },
    signedUp: 'Signed up',
    stepOf: (done, total) => `${done} of ${total} steps complete`,
    stuckBadge: (days) => `No activity in ${days}d`,
    sendReminder: 'Send reminder',
    view: 'View',
    drawerClose: 'Close',
    drawerSteps: 'Onboarding steps',
    reminderToast: (name) => `Reminder sent to ${name}.`,
    emptyTitle: 'No companies match this filter',
    emptySub: 'Try a different status.',
  },
  ar: {
    eyebrow: 'الشركات',
    title: 'التهيئة',
    statusAll: 'الكل',
    statusTrial: 'تجريبية',
    statusPending: 'قيد الانتظار',
    kpis: { total: 'قيد التأهيل', avgProgress: 'متوسط التقدم', stuck: 'متوقفة لأكثر من 7 أيام' },
    signedUp: 'تاريخ التسجيل',
    stepOf: (done, total) => `اكتملت ${done} من ${total} خطوات`,
    stuckBadge: (days) => `لا نشاط منذ ${days} يومًا`,
    sendReminder: 'إرسال تذكير',
    view: 'عرض',
    drawerClose: 'إغلاق',
    drawerSteps: 'خطوات التأهيل',
    reminderToast: (name) => `تم إرسال تذكير إلى ${name}.`,
    emptyTitle: 'لا توجد شركات مطابقة لهذا الفلتر',
    emptySub: 'جرّب حالة مختلفة.',
  },
};

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.html',
  styleUrls: ['../admin-ui.scss', './onboarding.scss'],
})
export class Onboarding {
  private readonly api = inject(CompaniesApi);
  private readonly subsApi = inject(SubscriptionsApi);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  /** Trial end (subscription renewsOn) per company, for trialing subscriptions. Needs `sub.manage`. */
  readonly trialEnds = signal<Record<string, string>>({});
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly stepKeys = ['admin_contact', 'inventory', 'team', 'lead_sources', 'first_deal'];
  constructor() {
    void this.reload();
    void this.loadTrials();
  }
  private async loadTrials() {
    if (!this.auth.user()?.permissions?.includes('sub.manage')) return;
    try {
      const list = await this.subsApi.subscriptions<{
        companyId: string;
        status: string;
        renewsOn: string;
      }>();
      this.trialEnds.set(
        Object.fromEntries(
          list.filter((x) => x.status === 'trialing').map((x) => [x.companyId, x.renewsOn]),
        ),
      );
    } catch {}
  }
  daysLeft(c: OnboardingCompany): number | null {
    const end = this.trialEnds()[c.id];
    if (!end) return null;
    return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  }
  trialEndLabel(c: OnboardingCompany): string {
    const end = this.trialEnds()[c.id];
    if (!end) return '—';
    const d = this.daysLeft(c)!;
    const ar = this.lang() === 'ar';
    const when = new Intl.DateTimeFormat(ar ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(end));
    return d < 0 ? when : when + ' · ' + (ar ? `${d} يوم` : `${d}d`);
  }
  readonly endingSoon = computed(
    () =>
      this.companies().filter((c) => {
        const d = this.daysLeft(c);
        return d !== null && d >= 0 && d <= 7;
      }).length,
  );
  planName(c: OnboardingCompany) {
    return PLAN_LABEL[c.plan]?.[this.lang() === 'ar' ? 1 : 0] ?? c.plan ?? '—';
  }
  pct(c: OnboardingCompany) {
    return Math.round((c.completedSteps / this.totalSteps) * 100) + '%';
  }
  nextStep(c: OnboardingCompany): string {
    const i = this.stepKeys.findIndex((k) => !c.completedKeys.includes(k));
    if (i < 0) return this.lang() === 'ar' ? 'اكتمل الإعداد' : 'Setup complete';
    return (this.lang() === 'ar' ? 'التالي: ' : 'Next: ') + this.stepLabel(this.steps[i]);
  }
  /** Pending companies still need the owner invite; this opens the owner card in Companies. */
  openInvite(c: OnboardingCompany) {
    void this.router.navigateByUrl('/admin/companies?company=' + encodeURIComponent(c.id));
  }
  goCreate() {
    void this.router.navigateByUrl('/admin/onboarding/new');
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.companies.set(await this.api.list<OnboardingCompany>(true));
      const current = this.viewing();
      if (current) this.viewing.set(this.companies().find((c) => c.id === current.id) ?? null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load onboarding');
    } finally {
      this.loading.set(false);
    }
  }
  async toggleStep(c: OnboardingCompany, index: number) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.change(c.id, 'onboarding', {
        step: this.stepKeys[index],
        completed: !c.completedKeys.includes(this.stepKeys[index]),
        version: c.version,
      });
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update progress');
    } finally {
      this.saving.set(false);
    }
  }
  async changeStatus(c: OnboardingCompany, action: string) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.change(c.id, 'status', {
        action,
        version: c.version,
        reason: 'Platform onboarding status updated',
      });
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update status');
    } finally {
      this.saving.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly steps = STEPS;
  readonly totalSteps = STEPS.length;

  readonly companies = signal<OnboardingCompany[]>([]);
  readonly statusFilter = signal<OnboardStatus | 'all'>('all');
  readonly viewing = signal<OnboardingCompany | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly kpis = computed(() => {
    const list = this.companies();
    const avg = list.length
      ? Math.round(
          (list.reduce((sum, c) => sum + c.completedSteps, 0) / (list.length * this.totalSteps)) *
            100,
        )
      : 0;
    return {
      total: list.length,
      avgProgress: `${avg}%`,
      stuck: list.filter((c) => c.stuckDays >= STUCK_THRESHOLD).length,
    };
  });

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    return this.companies().filter((c) => status === 'all' || c.status === status);
  });

  name(c: OnboardingCompany): string {
    return this.lang() === 'ar' ? c.nameAr : c.nameEn;
  }

  statusLabel(status: OnboardStatus): string {
    return status === 'trial' ? this.L().statusTrial : this.L().statusPending;
  }

  stepLabel(s: StepDef): string {
    return this.lang() === 'ar' ? s.labelAr : s.labelEn;
  }

  isStuck(c: OnboardingCompany): boolean {
    return c.stuckDays >= STUCK_THRESHOLD;
  }

  stepState(c: OnboardingCompany, index: number): 'done' | 'current' | 'pending' {
    if (c.completedKeys.includes(this.stepKeys[index])) return 'done';
    if (index === c.completedSteps) return 'current';
    return 'pending';
  }

  private logo(c: OnboardingCompany): [string, string] {
    const code = c.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return LOGO[code % LOGO.length];
  }
  logoBg(c: OnboardingCompany): string {
    return this.logo(c)[0];
  }
  logoFg(c: OnboardingCompany): string {
    return this.logo(c)[1];
  }

  logoInitials(c: OnboardingCompany): string {
    return c.nameEn
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  setStatusFilter(v: OnboardStatus | 'all'): void {
    this.statusFilter.set(v);
  }

  openView(c: OnboardingCompany): void {
    this.viewing.set(c);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  /** Static until the backend has a reminder endpoint (see BACKEND_MISSING.md). */
  sendReminder(c: OnboardingCompany): void {
    this.showToast(
      this.lang() === 'ar'
        ? `التذكيرات غير متصلة بعد — لم يُرسل شيء إلى ${this.name(c)}.`
        : `Reminders aren't connected yet — nothing was sent to ${this.name(c)}.`,
    );
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
