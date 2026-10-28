import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Severity = 'high' | 'med' | 'low';
type FilterKey = 'all' | 'ws' | Severity;

interface AuditEntry {
  id: string;
  time: string;
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

const SEED: AuditEntry[] = [
  { id: 'AUD-901', time: 'Oct 28 10:40', actor: 'Omar Khaled', actionEn: 'Entered workspace (read-only)', actionAr: 'دخول مساحة العمل (قراءة)', resource: 'Deira Properties', severity: 'med', isWorkspace: true, beforeEn: '—', beforeAr: '—', afterEn: 'mode: read-only · 30m', afterAr: 'الوضع: قراءة · 30 دقيقة', ip: '41.33.12.9' },
  { id: 'AUD-900', time: 'Oct 28 10:22', actor: 'Omar Khaled', actionEn: 'Feature platform flag disabled', actionAr: 'تعطيل علم المنصة للخاصية', resource: 'Advanced reports', severity: 'high', isWorkspace: false, beforeEn: 'on', beforeAr: 'مفعّل', afterEn: 'off · reason: pricing review', afterAr: 'معطّل · السبب: مراجعة التسعير', ip: '41.33.12.9' },
  { id: 'AUD-899', time: 'Oct 28 09:52', actor: 'Sara Fouad', actionEn: 'Integration availability changed', actionAr: 'تغيير إتاحة التكامل', resource: 'Property Finder', severity: 'high', isWorkspace: false, beforeEn: 'available', beforeAr: 'متاح', afterEn: 'unavailable · reason: repeated sync failures', afterAr: 'غير متاح · السبب: فشل متكرر بالمزامنة', ip: '156.202.44.1' },
  { id: 'AUD-898', time: 'Oct 28 08:50', actor: 'Omar Khaled', actionEn: 'Account flagged to avoid auto-suspend', actionAr: 'وضع علامة لتفادي الإيقاف التلقائي', resource: 'Smart Spaces', severity: 'high', isWorkspace: false, beforeEn: 'auto-suspend: Oct 29', beforeAr: 'الإيقاف التلقائي: 29 أكتوبر', afterEn: 'auto-suspend: Nov 5', afterAr: 'الإيقاف التلقائي: 5 نوفمبر', ip: '41.33.12.9' },
  { id: 'AUD-897', time: 'Oct 27 16:40', actor: 'Hany Fathy', actionEn: 'Manual payment recorded', actionAr: 'تسجيل دفعة يدوية', resource: 'INV-2026-0014', severity: 'med', isWorkspace: false, beforeEn: 'status: overdue', beforeAr: 'الحالة: متأخرة', afterEn: 'status: paid · bank ref: 88213', afterAr: 'الحالة: مدفوعة · مرجع: 88213', ip: '197.45.6.2' },
  { id: 'AUD-896', time: 'Oct 26 14:10', actor: 'Omar Khaled', actionEn: 'Subscription plan changed', actionAr: 'تغيير خطة الاشتراك', resource: 'SUB-2014 · Horizon Estates', severity: 'med', isWorkspace: false, beforeEn: 'plan: starter', beforeAr: 'الخطة: starter', afterEn: 'plan: pro · prorated', afterAr: 'الخطة: pro · احتساب نسبي', ip: '41.33.12.9' },
  { id: 'AUD-895', time: 'Oct 25 11:15', actor: 'Omar Khaled', actionEn: 'Usage limit override applied', actionAr: 'تطبيق تجاوز حد الاستخدام', resource: 'Capital Gate Developers · users', severity: 'low', isWorkspace: false, beforeEn: 'limit: 100', beforeAr: 'الحد: 100', afterEn: 'limit: 120 · expires Nov 7', afterAr: 'الحد: 120 · ينتهي 7 نوفمبر', ip: '41.33.12.9' },
  { id: 'AUD-894', time: 'Oct 24 13:22', actor: 'Omar Khaled', actionEn: 'Feature override removed', actionAr: 'إزالة استثناء خاصية', resource: 'Metro Realty Group · routing_adv', severity: 'med', isWorkspace: false, beforeEn: 'override: off', beforeAr: 'الاستثناء: معطّل', afterEn: 'reverted to plan entitlement', afterAr: 'عاد لحدود الباقة', ip: '41.33.12.9' },
  { id: 'AUD-893', time: 'Oct 22 09:05', actor: 'Sara Fouad', actionEn: 'Administrator invited', actionAr: 'دعوة مسؤول', resource: 'laila@mujez.io', severity: 'high', isWorkspace: false, beforeEn: '—', beforeAr: '—', afterEn: 'role: support_admin · status: invited', afterAr: 'الدور: support_admin · الحالة: مدعو', ip: '156.202.44.1' },
  { id: 'AUD-892', time: 'Oct 21 17:30', actor: 'Omar Khaled', actionEn: 'Settings changed', actionAr: 'تغيير الإعدادات', resource: 'Settings · Security', severity: 'high', isWorkspace: false, beforeEn: 'session length: 60m', beforeAr: 'مدة الجلسة: 60 د', afterEn: 'session length: 45m', afterAr: 'مدة الجلسة: 45 د', ip: '41.33.12.9' },
  { id: 'AUD-891', time: 'Oct 20 15:00', actor: 'Omar Khaled', actionEn: 'Announcement published', actionAr: 'نشر إعلان', resource: 'ANN-2 · Advanced lead routing', severity: 'low', isWorkspace: false, beforeEn: 'status: draft', beforeAr: 'الحالة: مسودة', afterEn: 'status: published', afterAr: 'الحالة: منشور', ip: '41.33.12.9' },
  { id: 'AUD-890', time: 'Oct 19 10:05', actor: 'Sara Fouad', actionEn: 'Entered workspace (read-only)', actionAr: 'دخول مساحة العمل (قراءة)', resource: 'Deira Properties', severity: 'med', isWorkspace: true, beforeEn: '—', beforeAr: '—', afterEn: 'mode: read-only · 30m', afterAr: 'الوضع: قراءة · 30 دقيقة', ip: '156.202.44.1' },
  { id: 'AUD-889', time: 'Oct 14 10:41', actor: 'Sara Fouad', actionEn: 'Support ticket resolved', actionAr: 'حل تذكرة دعم', resource: 'T-2032', severity: 'low', isWorkspace: false, beforeEn: 'status: open', beforeAr: 'الحالة: مفتوحة', afterEn: 'status: resolved', afterAr: 'الحالة: تم الحل', ip: '156.202.44.1' },
  { id: 'AUD-888', time: 'Oct 10 13:20', actor: 'Omar Khaled', actionEn: 'Blocked workspace write attempt', actionAr: 'منع محاولة كتابة في مساحة العمل', resource: 'October Living', severity: 'high', isWorkspace: true, beforeEn: 'mode: read-only', beforeAr: 'الوضع: قراءة', afterEn: 'write attempt denied · 403', afterAr: 'رُفضت محاولة الكتابة · 403', ip: '41.33.12.9' },
];

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
    sub: (n) => `Append-only · ${n} events · secrets are never logged`,
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
    exportBody: 'Exports may contain personal data. Re-enter your authenticator code.',
    codeLabel: 'TOTP code',
    codeError: 'Enter the 6-digit code.',
    cancel: 'Cancel',
    confirm: 'Export',
    exportToast: 'Export queued (static design preview).',
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
    exportBody: 'قد يحتوي التصدير على بيانات شخصية. أعد إدخال رمز المصادقة.',
    codeLabel: 'رمز TOTP',
    codeError: 'أدخل الرمز المكوّن من 6 أرقام.',
    cancel: 'إلغاء',
    confirm: 'تصدير',
    exportToast: 'تم جدولة التصدير (معاينة تصميم ثابتة).',
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

  readonly entries = signal<AuditEntry[]>(SEED);
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
    return this.lang() === 'ar' ? e.beforeAr : e.beforeEn;
  }

  after(e: AuditEntry): string {
    return this.lang() === 'ar' ? e.afterAr : e.afterEn;
  }

  sevName(s: Severity): string {
    return this.L().sev[s];
  }

  readonly kpis = computed(() => {
    const list = this.entries();
    return {
      total: list.length,
      high: list.filter((e) => e.severity === 'high').length,
      workspace: list.filter((e) => e.isWorkspace).length,
    };
  });

  readonly filtered = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.entries().filter((e) => {
      if (f === 'ws' && !e.isWorkspace) return false;
      if (f !== 'all' && f !== 'ws' && e.severity !== f) return false;
      if (!q) return true;
      return (
        e.actor.toLowerCase().includes(q) ||
        e.resource.toLowerCase().includes(q) ||
        e.actionEn.toLowerCase().includes(q) ||
        e.actionAr.includes(q)
      );
    });
  });

  setFilter(f: FilterKey): void {
    this.filter.set(f);
  }

  openView(e: AuditEntry): void {
    this.viewing.set(e);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  openExport(): void {
    this.exporting.set(true);
    this.exportCode.set('');
    this.exportError.set(false);
  }

  closeExport(): void {
    this.exporting.set(false);
  }

  confirmExport(): void {
    if (!/^\d{6}$/.test(this.exportCode().trim())) {
      this.exportError.set(true);
      return;
    }
    this.exporting.set(false);
    this.showToast(this.L().exportToast);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
