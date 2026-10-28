import { FeaturesApi } from '../../../features-api.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type ResourceKey = 'users' | 'listings' | 'storage';
type PlanKey = string;

interface Resource {
  used: number | null;
  limit: number | null;
  measured: boolean;
  overrideExpires: string | null;
}

interface UsageRow {
  version: number;
  accessible: boolean;
  id: string;
  nameEn: string;
  nameAr: string;
  plan: PlanKey;
  users: Resource;
  listings: Resource;
  storage: Resource;
}

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
    kpis: {
      total: 'Companies tracked',
      atRisk: 'At 80%+',
      atLimit: 'At limit',
      avg: 'Avg. utilization',
    },
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
    overrideBody: (current, next) =>
      `Raises the limit from ${current} to ${next} (+20%) for 30 days.`,
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
    kpis: { total: 'شركات مرصودة', atRisk: '80%+', atLimit: 'عند الحد', avg: 'متوسط الاستخدام' },
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
  private readonly api = inject(FeaturesApi);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    void this.reload();
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.rows.set(await this.api.usage());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load usage');
    } finally {
      this.loading.set(false);
    }
  }
  async removeOverride(r: UsageRow, resource: ResourceKey) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.limit(r.id, 'remove', {
        version: r.version,
        resource,
        reason: 'Temporary quota override removed by administrator',
      });
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to remove override');
    } finally {
      this.saving.set(false);
    }
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly resourceKeys: ResourceKey[] = ['users', 'listings', 'storage'];

  readonly rows = signal<UsageRow[]>([]);
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
    return p === 'none' ? (this.lang() === 'ar' ? 'بدون اشتراك' : 'No current subscription') : p;
  }

  pct(res: Resource): number {
    if (!res.measured || res.used === null || res.limit === null) return 0;
    return res.limit === 0 ? 100 : Math.round((res.used / res.limit) * 100);
  }

  highestPct(r: UsageRow): number {
    return Math.max(this.pct(r.users), this.pct(r.listings), this.pct(r.storage));
  }

  barClass(pct: number): string {
    if (pct >= 100) return 'bar__fill--danger';
    if (pct >= 80) return 'bar__fill--warn';
    return 'bar__fill--ok';
  }

  limitLabel(n: number | null) {
    return n === null ? (this.lang() === 'ar' ? 'بلا حد' : 'Unlimited') : this.format(n);
  }
  format(n: number | null): string {
    if (n === null) return this.lang() === 'ar' ? 'غير مقاس' : 'Not measured';
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
    const current = target.row[target.resource].limit ?? 0;
    return Math.ceil(current * 1.2);
  }

  async confirmOverride() {
    const t = this.overriding();
    if (!t || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.limit(t.row.id, 'override', {
        version: t.row.version,
        resource: t.resource,
        reason: this.overrideReason(),
      });
      this.overriding.set(null);
      await this.reload();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to override limit');
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
