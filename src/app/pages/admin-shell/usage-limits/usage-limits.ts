import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type ResourceKey = 'users' | 'listings' | 'storage';
type PlanKey = 'starter' | 'pro' | 'business';

interface Resource {
  used: number;
  limit: number;
}

interface UsageRow {
  id: string;
  nameEn: string;
  nameAr: string;
  plan: PlanKey;
  users: Resource;
  listings: Resource;
  storage: Resource;
}

const SEED: UsageRow[] = [
  { id: 'MJ-1001', nameEn: 'Al Qahira Developments', nameAr: 'القاهرة للتطوير', plan: 'business', users: { used: 84, limit: 100 }, listings: { used: 7800, limit: 10000 }, storage: { used: 210, limit: 250 } },
  { id: 'MJ-1018', nameEn: 'Blue Lagoon Realty', nameAr: 'بلو لاغون العقارية', plan: 'starter', users: { used: 5, limit: 5 }, listings: { used: 196, limit: 200 }, storage: { used: 4.8, limit: 5 } },
  { id: 'MJ-1017', nameEn: 'Capital Gate Developers', nameAr: 'كابيتال جيت للتطوير', plan: 'business', users: { used: 61, limit: 100 }, listings: { used: 5200, limit: 10000 }, storage: { used: 140, limit: 250 } },
  { id: 'MJ-1004', nameEn: 'Coastal Homes', nameAr: 'كوستال هومز', plan: 'starter', users: { used: 4, limit: 5 }, listings: { used: 120, limit: 200 }, storage: { used: 2.1, limit: 5 } },
  { id: 'MJ-1003', nameEn: 'Deira Properties', nameAr: 'ديرة العقارية', plan: 'pro', users: { used: 23, limit: 25 }, listings: { used: 1890, limit: 2000 }, storage: { used: 46, limit: 50 } },
  { id: 'MJ-1009', nameEn: 'Golden Sands Developments', nameAr: 'الرمال الذهبية للتطوير', plan: 'business', users: { used: 45, limit: 100 }, listings: { used: 3100, limit: 10000 }, storage: { used: 88, limit: 250 } },
  { id: 'MJ-1002', nameEn: 'Nile View Realty', nameAr: 'نايل فيو العقارية', plan: 'starter', users: { used: 2, limit: 5 }, listings: { used: 38, limit: 200 }, storage: { used: 0.6, limit: 5 } },
  { id: 'MJ-1008', nameEn: 'Marina Bay Properties', nameAr: 'مارينا باي العقارية', plan: 'pro', users: { used: 18, limit: 25 }, listings: { used: 1400, limit: 2000 }, storage: { used: 30, limit: 50 } },
];

const PLAN_LABEL: Record<PlanKey, string> = { starter: 'Starter', pro: 'Pro', business: 'Business' };

type Threshold = 'all' | 80 | 90 | 100;

interface Copy {
  eyebrow: string;
  title: string;
  kpis: { total: string; atRisk: string; atLimit: string; avg: string };
  colCompany: string;
  colPlan: string;
  colUsers: string;
  colListings: string;
  colStorage: string;
  colAction: string;
  filterAll: string;
  filter80: string;
  filter90: string;
  filter100: string;
  override: string;
  overrideTitle: (company: string, resource: string) => string;
  overrideBody: (current: number, next: number) => string;
  resourceLabel: Record<ResourceKey, string>;
  reasonLabel: string;
  reasonError: string;
  cancel: string;
  confirm: string;
  overrideToast: (company: string, resource: string) => string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Platform',
    title: 'Usage & limits',
    kpis: { total: 'Companies tracked', atRisk: 'At 80%+', atLimit: 'At limit (blocked)', avg: 'Avg. utilization' },
    colCompany: 'Company',
    colPlan: 'Plan',
    colUsers: 'Users',
    colListings: 'Listings',
    colStorage: 'Storage',
    colAction: '',
    filterAll: 'All companies',
    filter80: '≥ 80%',
    filter90: '≥ 90%',
    filter100: 'At 100%',
    override: 'Override limit',
    overrideTitle: (company, resource) => `Override ${resource} limit — ${company}`,
    overrideBody: (current, next) => `Raises the limit from ${current} to ${next} (+20%) for 30 days.`,
    resourceLabel: { users: 'users', listings: 'listings', storage: 'storage' },
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    cancel: 'Cancel',
    confirm: 'Apply override',
    overrideToast: (company, resource) => `${resource} limit for ${company} raised for 30 days.`,
    emptyTitle: 'No companies match this filter',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'الاستخدام والحدود',
    kpis: { total: 'شركات مرصودة', atRisk: '80%+', atLimit: 'عند الحد (محظورة)', avg: 'متوسط الاستخدام' },
    colCompany: 'الشركة',
    colPlan: 'الباقة',
    colUsers: 'المستخدمون',
    colListings: 'الوحدات',
    colStorage: 'التخزين',
    colAction: '',
    filterAll: 'كل الشركات',
    filter80: '٨٠٪ فأكثر',
    filter90: '٩٠٪ فأكثر',
    filter100: 'عند الحد',
    override: 'تجاوز الحد',
    overrideTitle: (company, resource) => `تجاوز حد ${resource} — ${company}`,
    overrideBody: (current, next) => `يرفع الحد من ${current} إلى ${next} (+20%) لمدة 30 يومًا.`,
    resourceLabel: { users: 'المستخدمين', listings: 'الوحدات', storage: 'التخزين' },
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    cancel: 'إلغاء',
    confirm: 'تطبيق التجاوز',
    overrideToast: (company, resource) => `تم رفع حد ${resource} لـ ${company} لمدة 30 يومًا.`,
    emptyTitle: 'لا توجد شركات مطابقة لهذا الفلتر',
  },
};

@Component({
  selector: 'app-usage-limits',
  imports: [FormsModule],
  templateUrl: './usage-limits.html',
  styleUrl: './usage-limits.scss',
})
export class UsageLimits {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly resourceKeys: ResourceKey[] = ['users', 'listings', 'storage'];

  readonly rows = signal<UsageRow[]>(SEED);
  readonly filter = signal<Threshold>('all');

  readonly overriding = signal<{ row: UsageRow; resource: ResourceKey } | null>(null);
  readonly overrideReason = signal('');
  readonly overrideError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(r: UsageRow): string {
    return this.lang() === 'ar' ? r.nameAr : r.nameEn;
  }

  planName(p: PlanKey): string {
    return PLAN_LABEL[p];
  }

  pct(res: Resource): number {
    return res.limit > 0 ? Math.round((res.used / res.limit) * 100) : 0;
  }

  highestPct(r: UsageRow): number {
    return Math.max(this.pct(r.users), this.pct(r.listings), this.pct(r.storage));
  }

  barClass(pct: number): string {
    if (pct >= 100) return 'bar__fill--danger';
    if (pct >= 80) return 'bar__fill--warn';
    return 'bar__fill--ok';
  }

  format(n: number): string {
    return n % 1 === 0 ? n.toLocaleString('en-US') : n.toFixed(1);
  }

  readonly kpis = computed(() => {
    const list = this.rows();
    const atRisk = list.filter((r) => this.highestPct(r) >= 80).length;
    const atLimit = list.filter((r) => this.highestPct(r) >= 100).length;
    const avg = list.length
      ? Math.round(list.reduce((sum, r) => sum + this.highestPct(r), 0) / list.length)
      : 0;
    return { total: list.length, atRisk, atLimit, avg: `${avg}%` };
  });

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.rows().filter((r) => {
      if (f === 'all') return true;
      return this.highestPct(r) >= f;
    });
  });

  setFilter(f: Threshold): void {
    this.filter.set(f);
  }

  askOverride(row: UsageRow, resource: ResourceKey): void {
    this.overriding.set({ row, resource });
    this.overrideReason.set('');
    this.overrideError.set(false);
  }

  cancelOverride(): void {
    this.overriding.set(null);
  }

  nextLimit(): number {
    const target = this.overriding();
    if (!target) return 0;
    const current = target.row[target.resource].limit;
    return Math.round(current * 1.2 * 10) / 10;
  }

  confirmOverride(): void {
    const target = this.overriding();
    if (!target) return;
    if (this.overrideReason().trim().length < 5) {
      this.overrideError.set(true);
      return;
    }
    const next = this.nextLimit();
    this.rows.update((list) =>
      list.map((r) =>
        r.id === target.row.id
          ? { ...r, [target.resource]: { ...r[target.resource], limit: next } }
          : r,
      ),
    );
    this.showToast(this.L().overrideToast(this.name(target.row), this.L().resourceLabel[target.resource]));
    this.overriding.set(null);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
