import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Severity = 'high' | 'med' | 'low';
type FilterKey = 'all' | 'ws' | Severity;

interface AuditEntry {
  id: string;
  time: string;
  result: string;
  before?: unknown;
  after?: unknown;
  actor: string;
  actionEn: string;
  actionAr: string;
  resource: string;
  severity: Severity;
  isWorkspace: boolean;
  beforeEn: string;
  beforeAr: string;
  afterEn: string;
  afterAr: string;
  ip: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: (n: number) => string;
  kpis: { total: string; high: string; workspace: string };
  searchPh: string;
  filterAll: string;
  filterWs: string;
  sev: Record<Severity, string>;
  colTime: string;
  colActor: string;
  colAction: string;
  colResource: string;
  colSeverity: string;
  drawerBefore: string;
  drawerAfter: string;
  drawerIp: string;
  drawerClose: string;
  exportBtn: string;
  exportTitle: string;
  exportBody: string;
  codeLabel: string;
  codeError: string;
  cancel: string;
  confirm: string;
  exportToast: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Audit logs',
    sub: (n) => `Append-only · ${n} matching events · credential fields are redacted`,
    kpis: { total: 'Events', high: 'High severity', workspace: 'Workspace access' },
    searchPh: 'Administrator, company, action…',
    filterAll: 'All',
    filterWs: 'Workspace access',
    sev: { high: 'High', med: 'Medium', low: 'Low' },
    colTime: 'Time',
    colActor: 'Administrator',
    colAction: 'Action',
    colResource: 'Resource',
    colSeverity: 'Severity',
    drawerBefore: 'Before',
    drawerAfter: 'After',
    drawerIp: 'IP address',
    drawerClose: 'Close',
    exportBtn: 'Export audit report',
    exportTitle: 'Export audit report',
    exportBody:
      'CSV exports may contain personal data. Confirm your password and reason. Exports are limited to 5,000 matching events.',
    codeLabel: 'Current password',
    codeError: 'Enter your current password.',
    cancel: 'Cancel',
    confirm: 'Export',
    exportToast: 'CSV report downloaded.',
    emptyTitle: 'No events match this filter',
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'سجل التدقيق',
    sub: (n) => `للإضافة فقط · ${n} حدثًا · لا تُسجل المفاتيح السرية`,
    kpis: { total: 'الأحداث', high: 'عالية الخطورة', workspace: 'دخول مساحة العمل' },
    searchPh: 'المسؤول أو الشركة أو الإجراء…',
    filterAll: 'الكل',
    filterWs: 'دخول مساحة العمل',
    sev: { high: 'عالية', med: 'متوسطة', low: 'منخفضة' },
    colTime: 'الوقت',
    colActor: 'المسؤول',
    colAction: 'الإجراء',
    colResource: 'المورد',
    colSeverity: 'الخطورة',
    drawerBefore: 'قبل',
    drawerAfter: 'بعد',
    drawerIp: 'عنوان IP',
    drawerClose: 'إغلاق',
    exportBtn: 'تصدير تقرير التدقيق',
    exportTitle: 'تصدير تقرير التدقيق',
    exportBody: 'قد يحتوي التقرير على بيانات شخصية. أكد كلمة المرور والسبب. الحد الأقصى 5000 حدث.',
    codeLabel: 'كلمة المرور الحالية',
    codeError: 'أدخل الرمز المكوّن من 6 أرقام.',
    cancel: 'إلغاء',
    confirm: 'تصدير',
    exportToast: 'تم تنزيل تقرير CSV.',
    emptyTitle: 'لا توجد أحداث مطابقة لهذا الفلتر',
  },
};

@Component({
  selector: 'app-audit-logs',
  imports: [FormsModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss',
})
export class AuditLogs {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly severities: Severity[] = ['high', 'med', 'low'];

  readonly api = inject(AuthService);
  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly reason = signal('');
  readonly from = signal('');
  readonly untilInput = signal('');
  readonly nextCursor = signal<string | null>(null);
  readonly stats = signal({ total: 0, high: 0, workspace: 0 });
  private cutoff = '';
  constructor() {
    void this.load();
  }
  query(cursor = false) {
    return {
      q: this.search().trim(),
      filter: this.filter(),
      ...(this.from() ? { from: new Date(this.from()).toISOString() } : {}),
      ...(this.untilInput()
        ? { until: new Date(this.untilInput()).toISOString() }
        : this.cutoff
          ? { until: this.cutoff }
          : {}),
      ...(cursor && this.nextCursor() ? { cursor: this.nextCursor()! } : {}),
    };
  }
  async load(more = false) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      if (!more) this.cutoff = '';
      const q = new URLSearchParams({ ...this.query(more), limit: '50' });
      const r = await this.api.request('/admin/api/v1/audit-logs?' + q);
      this.entries.set(more ? [...this.entries(), ...r.items] : r.items);
      this.nextCursor.set(r.nextCursor);
      this.stats.set(r.kpis);
      this.cutoff = r.until;
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  time(value: string) {
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  readonly filter = signal<FilterKey>('all');
  readonly search = signal('');
  readonly viewing = signal<AuditEntry | null>(null);

  readonly exporting = signal(false);
  readonly exportCode = signal('');
  readonly exportError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  action(e: AuditEntry): string {
    return this.lang() === 'ar' ? e.actionAr : e.actionEn;
  }

  before(e: AuditEntry): string {
    return e.before === null || e.before === undefined ? '---' : JSON.stringify(e.before, null, 2);
  }

  after(e: AuditEntry): string {
    return e.after === null || e.after === undefined ? '---' : JSON.stringify(e.after, null, 2);
  }

  sevName(s: Severity): string {
    return this.L().sev[s];
  }

  readonly kpis = this.stats;
  readonly filtered = this.entries;

  setFilter(f: FilterKey): void {
    this.filter.set(f);
    void this.load();
  }

  async openView(e: AuditEntry) {
    this.error.set('');
    try {
      this.viewing.set(await this.api.request('/admin/api/v1/audit-logs/' + e.id));
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  closeView(): void {
    this.viewing.set(null);
  }

  openExport(): void {
    this.exporting.set(true);
    this.reason.set('');
    this.error.set('');
    this.exportCode.set('');
    this.exportError.set(false);
  }

  closeExport(): void {
    this.exporting.set(false);
  }

  async confirmExport() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.request('/admin/api/v1/audit-logs/export', {
        password: this.exportCode(),
        reason: this.reason().trim(),
        filters: this.query(),
      });
      const url = URL.createObjectURL(new Blob([r.content], { type: r.contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = r.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportCode.set('');
      this.exporting.set(false);
      this.showToast(this.L().exportToast);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
