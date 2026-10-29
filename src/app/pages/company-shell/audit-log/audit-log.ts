import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

interface Entry {
  id: string;
  actor: string;
  actorAr: string;
  action: string;
  actionAr: string;
  resource: string;
  before: string;
  after: string;
  at: string;
}

const SEED: Entry[] = [
  { id: 'A-9001', actor: 'Dina El Sayed', actorAr: 'دينا السيد', action: 'Extended reservation hold', actionAr: 'تمديد تعليق الحجز', resource: 'RV-922 · MH-P3-401', before: 'expires_at: 2026-10-30 12:00', after: 'expires_at: 2026-11-01 12:00', at: 'Today, 11:12' },
  { id: 'A-8997', actor: 'Mona Sami', actorAr: 'منى سامي', action: 'Approved commission', actionAr: 'اعتماد عمولة', resource: 'Commission · MJ-0422', before: 'status: calculated', after: 'status: approved', at: 'Today, 09:40' },
  { id: 'A-8991', actor: 'Khaled Nabil', actorAr: 'خالد نبيل', action: 'Moved deal stage', actionAr: 'نقل مرحلة الصفقة', resource: 'D-280 · Apartment HB-P1-A2-12C', before: 'stage: viewing', after: 'stage: contract', at: 'Yesterday, 17:05' },
  { id: 'A-8980', actor: 'Youssef Mansour', actorAr: 'يوسف منصور', action: 'Uploaded document', actionAr: 'رفع مستند', resource: 'id_laila_ibrahim.pdf', before: '—', after: 'kind: national_id, linked: Laila Ibrahim', at: 'Yesterday, 10:20' },
  { id: 'A-8966', actor: 'Mona Sami', actorAr: 'منى سامي', action: 'Reordered routing rule', actionAr: 'إعادة ترتيب قاعدة التوزيع', resource: 'Rule r3 · Budget ≥ EGP 15M', before: 'priority: 4', after: 'priority: 3', at: '2 days ago' },
  { id: 'A-8951', actor: 'Rana Farouk', actorAr: 'رنا فاروق', action: 'Canceled reservation', actionAr: 'إلغاء حجز', resource: 'RV-879 · MH-P2-C-2D', before: 'status: hold', after: 'status: canceled (reason: client withdrew)', at: '3 days ago' },
  { id: 'A-8940', actor: 'Dina El Sayed', actorAr: 'دينا السيد', action: 'Lead reassigned (SLA)', actionAr: 'إعادة إسناد عميل (مهلة)', resource: 'Lead L-1996 · Hany Fathy', before: 'owner: Youssef Mansour', after: 'owner: Rana Farouk', at: '4 days ago' },
  { id: 'A-8922', actor: 'Mona Sami', actorAr: 'منى سامي', action: 'Marked commission paid', actionAr: 'تعليم العمولة كمصروفة', resource: 'Commission · MJ-0355', before: 'status: payable', after: 'status: paid', at: '1 week ago' },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  searchPh: string;
  userAll: string;
  thAction: string;
  thResource: string;
  thActor: string;
  thAt: string;
  drawerBefore: string;
  drawerAfter: string;
  close: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Audit Log',
    sub: 'Who changed what and when. Append-only.',
    searchPh: 'Search action or resource…',
    userAll: 'All users',
    thAction: 'Action',
    thResource: 'Resource',
    thActor: 'User',
    thAt: 'When',
    drawerBefore: 'Before',
    drawerAfter: 'After',
    close: 'Close',
    emptyTitle: 'No entries match this filter.',
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'سجل التدقيق',
    sub: 'من غيّر ماذا ومتى. سجل غير قابل للتعديل.',
    searchPh: 'ابحث عن إجراء أو سجل…',
    userAll: 'كل المستخدمين',
    thAction: 'الإجراء',
    thResource: 'السجل',
    thActor: 'المستخدم',
    thAt: 'الوقت',
    drawerBefore: 'قبل',
    drawerAfter: 'بعد',
    close: 'إغلاق',
    emptyTitle: 'لا توجد سجلات مطابقة.',
  },
};

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly entries = SEED;
  readonly search = signal('');
  readonly userFilter = signal('all');

  readonly users = computed(() => ['all', ...Array.from(new Set(this.entries.map((e) => e.actor)))]);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.entries.filter((e) => {
      if (this.userFilter() !== 'all' && e.actor !== this.userFilter()) return false;
      if (!q) return true;
      return e.action.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q);
    });
  });

  actor(e: Entry): string {
    return this.ar() ? e.actorAr : e.actor;
  }
  action(e: Entry): string {
    return this.ar() ? e.actionAr : e.action;
  }

  readonly selected = signal<Entry | null>(null);
  open(e: Entry): void {
    this.selected.set(e);
  }
  close(): void {
    this.selected.set(null);
  }
}
