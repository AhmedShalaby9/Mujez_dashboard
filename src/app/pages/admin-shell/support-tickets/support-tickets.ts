import { Component, computed, inject, signal } from '@angular/core';
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

const SEED: Ticket[] = [
  { id: 'T-2041', companyEn: 'Al Qahira Developments', companyAr: 'القاهرة للتطوير', subjectEn: 'Cannot export invoices to PDF', subjectAr: 'تعذّر تصدير الفواتير PDF', category: 'tech', priority: 'high', status: 'open', assigned: null, created: 'Oct 26', updated: '2h ago', requester: 'Mostafa Adel', slaDue: 'Oct 26 18:00',
    messages: [{ author: 'customer', textEn: 'The "Download PDF" button on invoice INV-2026-0014 does nothing.', textAr: 'زر "تنزيل PDF" في الفاتورة INV-2026-0014 لا يعمل.', time: 'Oct 26 10:02' }],
    notes: [] },
  { id: 'T-2040', companyEn: 'Blue Lagoon Realty', companyAr: 'بلو لاغون العقارية', subjectEn: 'Proration question on mid-cycle upgrade', subjectAr: 'سؤال عن الاحتساب النسبي عند الترقية', category: 'billing', priority: 'med', status: 'waiting', assigned: 'Sara Fouad', created: 'Oct 25', updated: '5h ago', requester: 'Mona Zaki', slaDue: 'Oct 26 09:00',
    messages: [
      { author: 'customer', textEn: 'If we upgrade to Pro today, how is the remaining Starter time credited?', textAr: 'إذا رقّينا إلى Pro اليوم، كيف يُحتسب رصيد Starter المتبقي؟', time: 'Oct 25 14:10' },
      { author: 'agent', textEn: 'We prorate the unused Starter days as a credit on your next invoice. Want me to run the numbers?', textAr: 'نحتسب أيام Starter غير المستخدمة كرصيد في فاتورتكم القادمة. هل أحسب لكم المبلغ؟', time: 'Oct 25 15:02' },
    ], notes: [] },
  { id: 'T-2039', companyEn: 'Capital Gate Developers', companyAr: 'كابيتال جيت للتطوير', subjectEn: 'Need 20 extra seats for 2 weeks', subjectAr: 'نحتاج 20 مقعدًا إضافيًا لمدة أسبوعين', category: 'subscription', priority: 'med', status: 'progress', assigned: 'Omar Khaled', created: 'Oct 24', updated: '1d ago', requester: 'Hani Gaber', slaDue: 'Oct 25 10:00',
    messages: [
      { author: 'customer', textEn: 'We are onboarding a seasonal sales team, can we get 20 temporary seats?', textAr: 'نضم فريق مبيعات موسميًا، هل يمكن إضافة 20 مقعدًا مؤقتًا؟', time: 'Oct 24 09:30' },
      { author: 'agent', textEn: 'Approved — adding a temporary limit override now, expires in 14 days.', textAr: 'تمت الموافقة — سأضيف تجاوزًا مؤقتًا للحد، ينتهي خلال 14 يومًا.', time: 'Oct 24 11:15' },
    ], notes: [{ authorName: 'Omar Khaled', textEn: 'Applied +20 user override via Usage & Limits, expires Nov 7.', textAr: 'تم تطبيق تجاوز +20 مستخدمًا عبر الاستخدام والحدود، ينتهي 7 نوفمبر.', time: 'Oct 24 11:16' }] },
  { id: 'T-2038', companyEn: 'Deira Properties', companyAr: 'ديرة العقارية', subjectEn: 'WhatsApp templates not syncing', subjectAr: 'قوالب واتساب لا تتزامن', category: 'integration', priority: 'med', status: 'waiting', assigned: 'Sara Fouad', created: 'Oct 19', updated: '1d ago', requester: 'Tarek Fouad', slaDue: 'Oct 23 17:00',
    messages: [
      { author: 'customer', textEn: 'New templates approved by Meta are not visible in Mujez.', textAr: 'قوالب جديدة معتمدة من ميتا غير ظاهرة في مجاز.', time: 'Oct 19 09:40' },
      { author: 'agent', textEn: 'Could you confirm the WABA ID connected in Settings → Integrations?', textAr: 'هل يمكنك تأكيد رقم WABA المرتبط في الإعدادات ← التكاملات؟', time: 'Oct 19 10:05' },
    ], notes: [] },
  { id: 'T-2037', companyEn: 'Coastal Homes', companyAr: 'كوستال هومز', subjectEn: 'Cannot invite a new team member', subjectAr: 'تعذّر دعوة عضو فريق جديد', category: 'access', priority: 'low', status: 'open', assigned: null, created: 'Oct 23', updated: '3d ago', requester: 'Yara Samir', slaDue: 'Oct 26 23:00',
    messages: [{ author: 'customer', textEn: 'The invite button is greyed out on the Users page.', textAr: 'زر الدعوة باهت في صفحة المستخدمين.', time: 'Oct 23 16:20' }], notes: [] },
  { id: 'T-2036', companyEn: 'Golden Sands Developments', companyAr: 'الرمال الذهبية للتطوير', subjectEn: 'Feature request: bulk unit status update', subjectAr: 'طلب خاصية: تحديث حالة الوحدات بالجملة', category: 'feature', priority: 'low', status: 'open', assigned: null, created: 'Oct 21', updated: '4d ago', requester: 'Ziad Nabil', slaDue: 'Oct 24 23:00',
    messages: [{ author: 'customer', textEn: 'It would help to select multiple units and change status in one go.', textAr: 'سيكون مفيدًا اختيار عدة وحدات وتغيير حالتها دفعة واحدة.', time: 'Oct 21 12:00' }], notes: [] },
  { id: 'T-2034', companyEn: 'Smart Spaces', companyAr: 'سمارت سبيسز', subjectEn: 'Payment declined twice this week', subjectAr: 'تم رفض الدفع مرتين هذا الأسبوع', category: 'billing', priority: 'urgent', status: 'progress', assigned: 'Omar Khaled', created: 'Oct 22', updated: '6h ago', requester: 'Nourhan Said', slaDue: 'Oct 22 20:00',
    messages: [
      { author: 'customer', textEn: 'Our card keeps getting declined — we are worried about suspension.', textAr: 'بطاقتنا تُرفض باستمرار — نخشى الإيقاف.', time: 'Oct 22 08:10' },
      { author: 'agent', textEn: 'You still have 5 days left in the grace period. Can you try a different card or InstaPay?', textAr: 'ما زال أمامكم 5 أيام من فترة السماح. هل يمكنكم تجربة بطاقة أخرى أو إنستاباي؟', time: 'Oct 22 08:45' },
    ], notes: [{ authorName: 'Omar Khaled', textEn: 'Flagged account to avoid auto-suspend until Oct 29.', textAr: 'تم وضع علامة على الحساب لتفادي الإيقاف التلقائي حتى 29 أكتوبر.', time: 'Oct 22 08:50' }] },
  { id: 'T-2033', companyEn: 'Horizon Estates', companyAr: 'هورايزون العقارية', subjectEn: 'Property Finder listings out of sync', subjectAr: 'إعلانات بروبرتي فايندر غير متزامنة', category: 'integration', priority: 'high', status: 'open', assigned: null, created: 'Oct 20', updated: '2d ago', requester: 'Aya Mahmoud', slaDue: 'Oct 20 18:00',
    messages: [{ author: 'customer', textEn: 'Listings we archived last week are still live on Property Finder.', textAr: 'إعلانات أرشفناها الأسبوع الماضي ما زالت ظاهرة على بروبرتي فايندر.', time: 'Oct 20 11:00' }], notes: [] },
  { id: 'T-2032', companyEn: 'Nasr City Realty', companyAr: 'مدينة نصر العقارية', subjectEn: 'How do commission splits work for leases?', subjectAr: 'كيف تُحتسب تقسيمات العمولة في الإيجارات؟', category: 'feature', priority: 'low', status: 'resolved', assigned: 'Sara Fouad', created: 'Oct 14', updated: '1w ago', requester: 'Karim Nasser', slaDue: 'Oct 17 23:00',
    messages: [
      { author: 'customer', textEn: 'Is the commission on a lease calculated on the full term or monthly?', textAr: 'هل تُحتسب عمولة الإيجار على كامل المدة أم شهريًا؟', time: 'Oct 14 10:00' },
      { author: 'agent', textEn: "It's months × monthly rent × your rate, as set in Commission schemes.", textAr: 'تُحتسب بضرب عدد الأشهر × الإيجار الشهري × نسبتكم، كما هو محدد في مخططات العمولة.', time: 'Oct 14 10:40' },
      { author: 'system', textEn: 'Ticket marked resolved by Sara Fouad.', textAr: 'تم وضع علامة "تم الحل" بواسطة سارة فؤاد.', time: 'Oct 14 10:41' },
    ], notes: [] },
  { id: 'T-2031', companyEn: 'Metro Realty Group', companyAr: 'مترو العقارية', subjectEn: 'Advanced lead routing disabled after plan check', subjectAr: 'توجيه العملاء المتقدم معطّل بعد فحص الباقة', category: 'subscription', priority: 'med', status: 'closed', assigned: 'Omar Khaled', created: 'Oct 10', updated: '2w ago', requester: 'Dina El Sayed', slaDue: 'Oct 11 10:00',
    messages: [
      { author: 'customer', textEn: 'Advanced routing turned off for us, we are on the Business plan.', textAr: 'توجيه العملاء المتقدم تعطّل لدينا، ونحن على باقة Business.', time: 'Oct 10 09:00' },
      { author: 'agent', textEn: 'Found it — a stale company override was disabling it. Removed and re-verified.', textAr: 'وجدنا السبب — استثناء قديم كان يعطّلها. تم إزالته والتحقق مجددًا.', time: 'Oct 10 13:20' },
    ], notes: [{ authorName: 'Omar Khaled', textEn: 'Removed stale feature override, see Feature Management overrides log.', textAr: 'تمت إزالة استثناء قديم، راجع سجل استثناءات إدارة الخصائص.', time: 'Oct 10 13:22' }] },
  { id: 'T-2030', companyEn: 'Marina Bay Properties', companyAr: 'مارينا باي العقارية', subjectEn: 'Trial extension request', subjectAr: 'طلب تمديد الفترة التجريبية', category: 'subscription', priority: 'low', status: 'resolved', assigned: 'Sara Fouad', created: 'Oct 9', updated: '2w ago', requester: 'Rania Adel', slaDue: 'Oct 12 23:00',
    messages: [{ author: 'customer', textEn: 'Could we get 7 more trial days? We are still importing inventory.', textAr: 'هل يمكن تمديد التجربة 7 أيام؟ ما زلنا نستورد المخزون.', time: 'Oct 9 15:00' }], notes: [] },
  { id: 'T-2029', companyEn: 'Smart Homes Egypt', companyAr: 'سمارت هومز إيجيبت', subjectEn: 'Storage usage near plan limit', subjectAr: 'استخدام التخزين قريب من حد الباقة', category: 'tech', priority: 'med', status: 'open', assigned: null, created: 'Oct 27', updated: '20m ago', requester: 'Peter Nabil', slaDue: 'Oct 28 10:00',
    messages: [{ author: 'customer', textEn: 'We are getting storage warnings, can you check our usage?', textAr: 'نتلقى تحذيرات تخزين، هل يمكنكم مراجعة استخدامنا؟', time: 'Oct 27 16:40' }], notes: [] },
];

const SLA_HOURS: Record<Priority, number> = { urgent: 4, high: 8, med: 24, low: 72 };

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
    kpis: { open: 'Open', waiting: 'Waiting on customer', overdue: 'Overdue SLA', resolved: 'Resolved (7d)' },
    searchPh: 'Ticket, subject, company…',
    statusAll: 'All',
    status: { open: 'Open', progress: 'In progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed' },
    priority: { urgent: 'Urgent', high: 'High', med: 'Medium', low: 'Low' },
    category: { tech: 'Technical', billing: 'Billing', subscription: 'Subscription', integration: 'Integration', feature: 'Feature request', access: 'Access' },
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
    sendReply: 'Send reply',
    changeStatus: 'Status',
    requestWorkspace: 'Request workspace access',
    requestWorkspaceTitle: (company) => `Request workspace access — ${company}`,
    requestWorkspaceBody: 'Opens a time-limited, audited session to investigate this ticket.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    durationLabel: 'Duration',
    cancel: 'Cancel',
    confirm: 'Request access',
    workspaceToast: 'Static design preview — workspace access is not connected.',
    replyToast: 'Static design preview — reply is not sent.',
    noteToast: 'Internal note added.',
    statusToast: (status) => `Status changed to ${status}.`,
    close: 'Close',
  },
  ar: {
    eyebrow: 'الدعم',
    title: 'تذاكر الدعم',
    sub: 'SLA: عاجلة 4 س · عالية 8 س · متوسطة 24 س · منخفضة 72 س',
    kpis: { open: 'مفتوحة', waiting: 'بانتظار العميل', overdue: 'متجاوزة SLA', resolved: 'محلولة (7 أيام)' },
    searchPh: 'التذكرة أو الموضوع أو الشركة…',
    statusAll: 'الكل',
    status: { open: 'مفتوحة', progress: 'قيد المعالجة', waiting: 'بالانتظار', resolved: 'تم الحل', closed: 'مغلقة' },
    priority: { urgent: 'عاجلة', high: 'عالية', med: 'متوسطة', low: 'منخفضة' },
    category: { tech: 'تقنية', billing: 'فوترة', subscription: 'اشتراك', integration: 'تكامل', feature: 'طلب خاصية', access: 'صلاحيات' },
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
    sendReply: 'إرسال الرد',
    changeStatus: 'الحالة',
    requestWorkspace: 'طلب الدخول لمساحة العمل',
    requestWorkspaceTitle: (company) => `طلب الدخول لمساحة العمل — ${company}`,
    requestWorkspaceBody: 'يفتح جلسة مؤقتة وموثّقة للتحقيق في هذه التذكرة.',
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    durationLabel: 'المدة',
    cancel: 'إلغاء',
    confirm: 'طلب الدخول',
    workspaceToast: 'معاينة تصميم ثابتة — الدخول لمساحة العمل غير متصل.',
    replyToast: 'معاينة تصميم ثابتة — لم يُرسل الرد.',
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

  readonly tickets = signal<Ticket[]>(SEED);
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
    return (t.status === 'open' || t.status === 'progress' || t.status === 'waiting') && (t.priority === 'urgent' || t.priority === 'high');
  }

  readonly kpis = computed(() => {
    const list = this.tickets();
    return {
      open: list.filter((t) => t.status === 'open').length,
      waiting: list.filter((t) => t.status === 'waiting').length,
      overdue: list.filter((t) => this.isOverdue(t)).length,
      resolved: list.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    };
  });

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

  openTicket(t: Ticket): void {
    this.viewing.set(t);
    this.replyDraft.set('');
    this.noteDraft.set('');
  }

  closeTicket(): void {
    this.viewing.set(null);
  }

  setStatus(status: Status): void {
    const t = this.viewing();
    if (!t) return;
    this.tickets.update((list) => list.map((x) => (x.id === t.id ? { ...x, status, updated: 'just now' } : x)));
    this.viewing.set({ ...t, status, updated: 'just now' });
    this.showToast(this.L().statusToast(this.statusName(status)));
  }

  sendReply(): void {
    const t = this.viewing();
    if (!t || !this.replyDraft().trim()) return;
    const msg: Msg = { author: 'agent', textEn: this.replyDraft(), textAr: this.replyDraft(), time: 'just now' };
    const updated = { ...t, messages: [...t.messages, msg], updated: 'just now' };
    this.tickets.update((list) => list.map((x) => (x.id === t.id ? updated : x)));
    this.viewing.set(updated);
    this.replyDraft.set('');
    this.showToast(this.L().replyToast);
  }

  addNote(): void {
    const t = this.viewing();
    if (!t || this.noteDraft().trim().length < 2) return;
    const note: Note = { authorName: 'Omar Khaled', textEn: this.noteDraft(), textAr: this.noteDraft(), time: 'just now' };
    const updated = { ...t, notes: [...t.notes, note] };
    this.tickets.update((list) => list.map((x) => (x.id === t.id ? updated : x)));
    this.viewing.set(updated);
    this.noteDraft.set('');
    this.showToast(this.L().noteToast);
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

  confirmWorkspace(): void {
    if (this.requestReason().trim().length < 10) {
      this.requestError.set(true);
      return;
    }
    this.requesting.set(null);
    this.showToast(this.L().workspaceToast);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
