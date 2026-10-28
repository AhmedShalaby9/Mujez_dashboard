import { Component, computed, inject, signal } from '@angular/core';
import { SupportApi } from '../../../support-api.service';
import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Category = 'tech' | 'billing' | 'subscription' | 'integration' | 'feature' | 'access';
type Priority = 'urgent' | 'high' | 'med' | 'low';
type Status = 'open' | 'progress' | 'waiting' | 'resolved' | 'closed';
type Author = 'customer' | 'agent' | 'system';

interface Msg {
  author: Author;
  textEn: string;
  textAr: string;
  time: string;
}

interface Note {
  authorName: string;
  textEn: string;
  textAr: string;
  time: string;
}

interface Ticket {
  version: number;
  assignedTo: string | null;
  resolvedAt: string | null;
  requests: Array<{
    id: string;
    actorId: string;
    actorName: string;
    reason: string;
    durationMinutes: number;
    status: string;
    createdAt: string;
  }>;
  id: string;
  companyEn: string;
  companyAr: string;
  subjectEn: string;
  subjectAr: string;
  category: Category;
  priority: Priority;
  status: Status;
  assigned: string | null;
  created: string;
  updated: string;
  requester: string;
  slaDue: string;
  messages: Msg[];
  notes: Note[];
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  kpis: { open: string; waiting: string; overdue: string; resolved: string };
  searchPh: string;
  statusAll: string;
  status: Record<Status, string>;
  priority: Record<Priority, string>;
  category: Record<Category, string>;
  colTicket: string;
  colCompany: string;
  colSubject: string;
  colCategory: string;
  colPriority: string;
  colStatus: string;
  colAssigned: string;
  colUpdated: string;
  unassigned: string;
  emptyTitle: string;
  requester: string;
  created: string;
  slaDue: string;
  conversation: string;
  internalNotes: string;
  internalNotesHint: string;
  addNote: string;
  notePh: string;
  replyPh: string;
  sendReply: string;
  changeStatus: string;
  requestWorkspace: string;
  requestWorkspaceTitle: (company: string) => string;
  requestWorkspaceBody: string;
  reasonLabel: string;
  reasonError: string;
  durationLabel: string;
  cancel: string;
  confirm: string;
  workspaceToast: string;
  replyToast: string;
  noteToast: string;
  statusToast: (status: string) => string;
  close: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Support',
    title: 'Support tickets',
    sub: 'SLA: urgent 4h · high 8h · medium 24h · low 72h',
    kpis: {
      open: 'Open',
      waiting: 'Waiting on customer',
      overdue: 'Overdue SLA',
      resolved: 'Resolved (7d)',
    },
    searchPh: 'Ticket, subject, company…',
    statusAll: 'All',
    status: {
      open: 'Open',
      progress: 'In progress',
      waiting: 'Waiting',
      resolved: 'Resolved',
      closed: 'Closed',
    },
    priority: { urgent: 'Urgent', high: 'High', med: 'Medium', low: 'Low' },
    category: {
      tech: 'Technical',
      billing: 'Billing',
      subscription: 'Subscription',
      integration: 'Integration',
      feature: 'Feature request',
      access: 'Access',
    },
    colTicket: 'Ticket',
    colCompany: 'Company',
    colSubject: 'Subject',
    colCategory: 'Category',
    colPriority: 'Priority',
    colStatus: 'Status',
    colAssigned: 'Assigned',
    colUpdated: 'Updated',
    unassigned: 'Unassigned',
    emptyTitle: 'No tickets match this filter',
    requester: 'Requester',
    created: 'Created',
    slaDue: 'SLA due',
    conversation: 'Conversation',
    internalNotes: 'Internal notes — hidden from customer',
    internalNotesHint: 'Visible to platform staff only',
    addNote: 'Add note',
    notePh: 'Add an internal note…',
    replyPh: 'Write a reply to the customer…',
    sendReply: 'Save reply',
    changeStatus: 'Status',
    requestWorkspace: 'Request workspace access',
    requestWorkspaceTitle: (company) => `Request workspace access — ${company}`,
    requestWorkspaceBody:
      'Records a pending, audited request. It does not open a session or grant tenant access.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    durationLabel: 'Duration',
    cancel: 'Cancel',
    confirm: 'Request access',
    workspaceToast: 'Request saved as pending. No workspace access granted.',
    replyToast: 'Reply saved to the ticket. Email delivery is not configured.',
    noteToast: 'Internal note added.',
    statusToast: (status) => `Status changed to ${status}.`,
    close: 'Close',
  },
  ar: {
    eyebrow: 'الدعم',
    title: 'تذاكر الدعم',
    sub: 'SLA: عاجلة 4 س · عالية 8 س · متوسطة 24 س · منخفضة 72 س',
    kpis: {
      open: 'مفتوحة',
      waiting: 'بانتظار العميل',
      overdue: 'متجاوزة SLA',
      resolved: 'محلولة (7 أيام)',
    },
    searchPh: 'التذكرة أو الموضوع أو الشركة…',
    statusAll: 'الكل',
    status: {
      open: 'مفتوحة',
      progress: 'قيد المعالجة',
      waiting: 'بالانتظار',
      resolved: 'تم الحل',
      closed: 'مغلقة',
    },
    priority: { urgent: 'عاجلة', high: 'عالية', med: 'متوسطة', low: 'منخفضة' },
    category: {
      tech: 'تقنية',
      billing: 'فوترة',
      subscription: 'اشتراك',
      integration: 'تكامل',
      feature: 'طلب خاصية',
      access: 'صلاحيات',
    },
    colTicket: 'التذكرة',
    colCompany: 'الشركة',
    colSubject: 'الموضوع',
    colCategory: 'الفئة',
    colPriority: 'الأولوية',
    colStatus: 'الحالة',
    colAssigned: 'المسؤول',
    colUpdated: 'آخر تحديث',
    unassigned: 'غير مُسند',
    emptyTitle: 'لا توجد تذاكر مطابقة لهذا الفلتر',
    requester: 'مقدّم الطلب',
    created: 'تاريخ الإنشاء',
    slaDue: 'موعد SLA',
    conversation: 'المحادثة',
    internalNotes: 'ملاحظات داخلية — مخفية عن العميل',
    internalNotesHint: 'تظهر لموظفي المنصة فقط',
    addNote: 'إضافة ملاحظة',
    notePh: 'أضف ملاحظة داخلية…',
    replyPh: 'اكتب ردًا للعميل…',
    sendReply: 'حفظ الرد',
    changeStatus: 'الحالة',
    requestWorkspace: 'طلب الدخول لمساحة العمل',
    requestWorkspaceTitle: (company) => `طلب الدخول لمساحة العمل — ${company}`,
    requestWorkspaceBody: 'يسجل طلبًا معلقًا وموثقًا. لا يفتح جلسة ولا يمنح دخولًا لمساحة الشركة.',
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    durationLabel: 'المدة',
    cancel: 'إلغاء',
    confirm: 'طلب الدخول',
    workspaceToast: 'تم حفظ الطلب معلقًا دون منح دخول لمساحة العمل.',
    replyToast: 'تم حفظ الرد في التذكرة. إرسال البريد غير مهيأ.',
    noteToast: 'تمت إضافة الملاحظة الداخلية.',
    statusToast: (status) => `تم تغيير الحالة إلى ${status}.`,
    close: 'إغلاق',
  },
};

@Component({
  selector: 'app-support-tickets',
  imports: [FormsModule],
  templateUrl: './support-tickets.html',
  styleUrl: './support-tickets.scss',
})
export class SupportTickets {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly statuses: Status[] = ['open', 'progress', 'waiting', 'resolved', 'closed'];
  readonly durations: Array<30 | 60 | 120> = [30, 60, 120];

  readonly api = inject(SupportApi);
  readonly auth = inject(AuthService);
  readonly tickets = signal<Ticket[]>([]);
  readonly options = signal<{
    companies: Array<{ id: string; name: { en: string; ar: string } }>;
    agents: Array<{ id: string; name: string }>;
  }>({ companies: [], agents: [] });
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly categories: Category[] = [
    'tech',
    'billing',
    'subscription',
    'integration',
    'feature',
    'access',
  ];
  readonly priorities: Priority[] = ['urgent', 'high', 'med', 'low'];
  draft = {
    companyId: '',
    subjectEn: '',
    subjectAr: '',
    category: 'tech',
    priority: 'med',
    requester: '',
    message: '',
  };
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [tickets, options] = await Promise.all([this.api.list<Ticket>(), this.api.options()]);
      this.tickets.set(tickets);
      this.options.set(options);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  openCreate() {
    this.draft = {
      companyId: '',
      subjectEn: '',
      subjectAr: '',
      category: 'tech',
      priority: 'med',
      requester: '',
      message: '',
    };
    this.creating.set(true);
  }
  async createTicket() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const r = await this.api.create(this.draft);
      this.creating.set(false);
      await this.load();
      await this.openTicket(this.tickets().find((t) => t.id === r.id)!);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async mutate(action: string, body: unknown, toast: string) {
    const t = this.viewing();
    if (!t || this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.change(t.id, action, { version: t.version, ...(body as object) });
      const detail = await this.api.detail<Ticket>(t.id);
      this.viewing.set(detail);
      await this.load();
      this.showToast(toast);
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }
  canTransition(from: Status, to: Status) {
    const allowed: Record<Status, Status[]> = {
      open: ['progress', 'waiting', 'resolved'],
      progress: ['open', 'waiting', 'resolved'],
      waiting: ['open', 'progress', 'resolved'],
      resolved: ['open', 'closed'],
      closed: ['open'],
    };
    return allowed[from].includes(to);
  }
  assign(value: string) {
    return this.mutate(
      'update',
      { action: 'assign', assignedTo: value || null },
      this.lang() === 'ar' ? 'تم تحديث المسؤول' : 'Assignment updated',
    );
  }
  priority(value: string) {
    return this.mutate(
      'update',
      { action: 'priority', priority: value },
      this.lang() === 'ar' ? 'تم تحديث الأولوية' : 'Priority updated',
    );
  }
  cancelRequest(id: string) {
    return this.mutate(
      'workspace-requests/' + id + '/cancel',
      {},
      this.lang() === 'ar' ? 'تم إلغاء الطلب' : 'Request cancelled',
    );
  }
  readonly statusFilter = signal<Status | 'all'>('all');
  readonly search = signal('');
  readonly viewing = signal<Ticket | null>(null);
  readonly replyDraft = signal('');
  readonly noteDraft = signal('');

  readonly requesting = signal<Ticket | null>(null);
  readonly requestReason = signal('');
  readonly requestError = signal(false);
  readonly requestDuration = signal<30 | 60 | 120>(30);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  time(value: string): string {
    return new Intl.DateTimeFormat(this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  }

  company(t: Ticket): string {
    return this.lang() === 'ar' ? t.companyAr : t.companyEn;
  }

  subject(t: Ticket): string {
    return this.lang() === 'ar' ? t.subjectAr : t.subjectEn;
  }

  statusName(s: Status): string {
    return this.L().status[s];
  }

  priorityName(p: Priority): string {
    return this.L().priority[p];
  }

  categoryName(c: Category): string {
    return this.L().category[c];
  }

  msgText(m: Msg): string {
    return this.lang() === 'ar' ? m.textAr : m.textEn;
  }

  noteText(n: Note): string {
    return this.lang() === 'ar' ? n.textAr : n.textEn;
  }

  isOverdue(t: Ticket): boolean {
    return (
      ['open', 'progress', 'waiting'].includes(t.status) &&
      new Date(t.slaDue).getTime() < Date.now()
    );
  }
  readonly kpis = this.api.kpis;

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const q = this.search().trim().toLowerCase();
    return this.tickets().filter((t) => {
      if (status !== 'all' && t.status !== status) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.subjectEn.toLowerCase().includes(q) ||
        t.subjectAr.includes(q) ||
        t.companyEn.toLowerCase().includes(q) ||
        t.companyAr.includes(q)
      );
    });
  });

  setStatusFilter(s: Status | 'all'): void {
    this.statusFilter.set(s);
  }

  async openTicket(t: Ticket): Promise<void> {
    if (!t) return;
    this.viewing.set(null);
    this.detailLoading.set(true);
    this.error.set('');
    this.replyDraft.set('');
    this.noteDraft.set('');
    try {
      this.viewing.set(await this.api.detail<Ticket>(t.id));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.detailLoading.set(false);
    }
  }
  closeTicket(): void {
    this.viewing.set(null);
  }
  setStatus(status: Status) {
    return this.mutate(
      'update',
      { action: 'status', status },
      this.L().statusToast(this.statusName(status)),
    );
  }
  async sendReply() {
    if (
      await this.mutate(
        'entries',
        { kind: 'reply', text: this.replyDraft().trim() },
        this.L().replyToast,
      )
    )
      this.replyDraft.set('');
  }
  async addNote() {
    if (
      await this.mutate(
        'entries',
        { kind: 'internal', text: this.noteDraft().trim() },
        this.L().noteToast,
      )
    )
      this.noteDraft.set('');
  }

  askWorkspace(t: Ticket): void {
    this.requesting.set(t);
    this.requestReason.set('');
    this.requestError.set(false);
    this.requestDuration.set(30);
  }

  cancelWorkspace(): void {
    this.requesting.set(null);
  }

  async confirmWorkspace(): Promise<void> {
    if (this.requestReason().trim().length < 10) {
      this.requestError.set(true);
      return;
    }
    if (
      await this.mutate(
        'workspace-requests',
        { reason: this.requestReason().trim(), durationMinutes: this.requestDuration() },
        this.L().workspaceToast,
      )
    )
      this.requesting.set(null);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
