import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type OnboardStatus = 'trial' | 'pending';

interface OnboardingCompany {
  id: string;
  nameEn: string;
  nameAr: string;
  status: OnboardStatus;
  signedUp: string;
  completedSteps: number;
  stuckDays: number;
}

const SEED: OnboardingCompany[] = [
  { id: 'MJ-1002', nameEn: 'Nile View Realty', nameAr: 'نايل فيو العقارية', status: 'trial', signedUp: 'Sep 18, 2026', completedSteps: 3, stuckDays: 2 },
  { id: 'MJ-1008', nameEn: 'Marina Bay Properties', nameAr: 'مارينا باي العقارية', status: 'trial', signedUp: 'Oct 12, 2026', completedSteps: 1, stuckDays: 1 },
  { id: 'MJ-1016', nameEn: 'Rehab Living Co.', nameAr: 'الرحاب ليفينج', status: 'trial', signedUp: 'Oct 8, 2026', completedSteps: 2, stuckDays: 9 },
  { id: 'MJ-1024', nameEn: 'Sunrise Properties', nameAr: 'صن رايز العقارية', status: 'trial', signedUp: 'Oct 20, 2026', completedSteps: 0, stuckDays: 0 },
  { id: 'MJ-1010', nameEn: 'Urban Nest Brokerage', nameAr: 'أوربان نِست', status: 'pending', signedUp: 'Oct 25, 2026', completedSteps: 0, stuckDays: 3 },
];

interface StepDef {
  labelEn: string;
  labelAr: string;
}

const STEPS: StepDef[] = [
  { labelEn: 'Invite admin', labelAr: 'دعوة المشرف' },
  { labelEn: 'Import inventory', labelAr: 'استيراد المخزون' },
  { labelEn: 'Invite team', labelAr: 'دعوة الفريق' },
  { labelEn: 'Connect lead sources', labelAr: 'ربط مصادر العملاء' },
  { labelEn: 'First deal', labelAr: 'أول صفقة' },
];

const STUCK_THRESHOLD = 7;

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
    title: 'التأهيل',
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
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly steps = STEPS;
  readonly totalSteps = STEPS.length;

  readonly companies = signal<OnboardingCompany[]>(SEED);
  readonly statusFilter = signal<OnboardStatus | 'all'>('all');
  readonly viewing = signal<OnboardingCompany | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly kpis = computed(() => {
    const list = this.companies();
    const avg = list.length
      ? Math.round((list.reduce((sum, c) => sum + c.completedSteps, 0) / (list.length * this.totalSteps)) * 100)
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
    if (index < c.completedSteps) return 'done';
    if (index === c.completedSteps) return 'current';
    return 'pending';
  }

  private readonly logoPalette = ['#3D4FD6', '#7E89E6', '#16182A', '#9A6B1E', '#2F7A4F', '#B4442F'];

  logoBg(c: OnboardingCompany): string {
    const code = c.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return this.logoPalette[code % this.logoPalette.length];
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

  sendReminder(c: OnboardingCompany): void {
    this.showToast(this.L().reminderToast(this.name(c)));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
