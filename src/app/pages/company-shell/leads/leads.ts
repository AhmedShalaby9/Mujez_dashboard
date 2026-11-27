import { CompactAmountDirective } from '../../../compact-amount.directive';
import { LeadUnitRecommendations } from './lead-unit-recommendations';
import { Router, ActivatedRoute } from '@angular/router';
import type { CompanyTask } from '../../../tasks-api.service';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService, ApiError, aiModuleEnabled, canCreateLead } from '../../../auth.service';
import {
  SalesApi,
  SALES_STAGES,
  BROKERAGE_LEAD_STATUSES,
  STAGE_NAMES,
  SOURCE_NAMES,
  salesMoney,
  minorAmount,
  majorAmount,
  type SalesLead,
  type SalesActivity,
  type SalesStage,
} from '../../../sales-api.service';
@Component({
  selector: 'app-leads',
  imports: [CompactAmountDirective, FormsModule, LeadUnitRecommendations],
  templateUrl: './leads.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './leads.scss',
  ],
})
export class Leads {
  private readonly ui = inject(CompanyUiState);
  readonly aiModuleEnabled = aiModuleEnabled;
  readonly auth = inject(AuthService);
  readonly api = inject(SalesApi);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly canReadTasks = computed(
    () => this.auth.user()?.permissions.includes('tasks.read') ?? false,
  );
  readonly canManageTasks = computed(
    () => this.auth.user()?.permissions.includes('tasks.manage') ?? false,
  );
  readonly canMarketing = computed(
    () => this.auth.user()?.permissions.includes('marketing.read') ?? false,
  );
  readonly campaignOptions = signal<any[]>([]);
  readonly campaignTotal = signal(0);
  campaignPage = 0;
  campaignQuery = '';
  readonly campaignFilter = signal('');
  private campaignSerial = 0;
  readonly linkedTasks = signal<CompanyTask[]>([]);
  readonly linkedTaskTotal = signal(0);
  readonly taskError = signal('');
  readonly taskLoading = signal(false);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly leads = signal<SalesLead[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly search = signal('');
  readonly stageFilter = signal('all');
  readonly archived = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  /** Bulk row checkboxes; distinct from `selected`, which is the open detail drawer. */
  readonly checkedIds = signal<string[]>([]);
  toggleChecked(id: string, checked: boolean) {
    this.checkedIds.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
    );
  }
  selectAllOnPage(checked: boolean) {
    this.checkedIds.set(checked ? this.leads().map((l) => l.id) : []);
  }
  readonly bulkPanel = signal<'stage' | 'assign' | 'distribute' | 'tags' | 'whatsapp' | null>(
    null,
  );
  readonly bulkBusy = signal(false);
  readonly bulkNotice = signal('');
  readonly bulkStageValue = signal('');
  readonly bulkAssignOwner = signal('');
  readonly bulkDistributeIds = signal<string[]>([]);
  readonly bulkTagText = signal('');
  readonly bulkWhatsappMessage = signal('');
  get bulkSelectedLeads() {
    const ids = new Set(this.checkedIds());
    return this.leads().filter((l) => ids.has(l.id));
  }
  private bulkItems() {
    return this.bulkSelectedLeads.map((l) => ({ id: l.id, version: l.version }));
  }
  toggleBulkPanel(panel: 'stage' | 'assign' | 'distribute' | 'tags' | 'whatsapp') {
    this.bulkPanel.set(this.bulkPanel() === panel ? null : panel);
  }
  closeBulkPanel() {
    this.bulkPanel.set(null);
  }
  cancelBulk() {
    this.checkedIds.set([]);
    this.bulkPanel.set(null);
    this.bulkDistributeIds.set([]);
  }
  toggleDistributeAgent(id: string, checked: boolean) {
    this.bulkDistributeIds.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
    );
  }
  private async runBulk(path: string, body: Record<string, unknown>, closePanel = true) {
    this.bulkBusy.set(true);
    this.error.set('');
    try {
      await this.api.write(path, { items: this.bulkItems(), ...body });
      if (closePanel) {
        this.checkedIds.set([]);
        this.bulkPanel.set(null);
      }
      await this.reload(this.page());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.bulkBusy.set(false);
    }
  }
  async bulkApplyStage() {
    if (!this.bulkStageValue()) return;
    await (this.isBrokerage()
      ? this.runBulk('leads/bulk/status', { status: this.bulkStageValue() })
      : this.runBulk('leads/bulk/stage', { stage: this.bulkStageValue() }));
    this.bulkStageValue.set('');
  }
  async bulkApplyAssign() {
    if (!this.bulkAssignOwner()) return;
    await this.runBulk('leads/bulk/assign', { ownerId: this.bulkAssignOwner() });
    this.bulkAssignOwner.set('');
  }
  async bulkApplyDistribute() {
    if (this.bulkDistributeIds().length < 2) return;
    await this.runBulk('leads/bulk/distribute', { agentIds: this.bulkDistributeIds() });
    this.bulkDistributeIds.set([]);
  }
  async bulkApplyTags() {
    const tag = this.bulkTagText().trim();
    if (!tag) return;
    await this.runBulk('leads/bulk/tags', { tags: [tag] }, false);
    this.bulkTagText.set('');
  }
  whatsappLink(l: SalesLead) {
    const phone = l.phone.replace(/[^\d]/g, '');
    const text = this.bulkWhatsappMessage().trim();
    return 'https://wa.me/' + phone + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  async copyRows() {
    const rows = this.bulkSelectedLeads
      .map((l) =>
        [this.name(l), l.phone, this.stageNames()[this.leadStage(l)] ?? l.stage, l.owner?.name ?? '']
          .join('\t'),
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(rows);
      this.bulkNotice.set(
        this.bulkSelectedLeads.length + ' ' + this.t('rows copied', 'صف تم نسخه'),
      );
      setTimeout(() => this.bulkNotice.set(''), 2500);
    } catch {
      this.error.set(this.t('Could not copy to clipboard', 'تعذر النسخ إلى الحافظة'));
    }
  }
  async addTag(l: SalesLead, raw: string) {
    const tag = raw.trim();
    if (!tag || l.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    await this.saveTags(l, [...l.tags, tag]);
  }
  async removeTag(l: SalesLead, tag: string) {
    await this.saveTags(l, l.tags.filter((t) => t !== tag));
  }
  private async saveTags(l: SalesLead, tags: string[]) {
    try {
      const updated = await this.api.write('leads/' + l.id + '/tags', {
        version: l.version,
        tags,
      });
      this.leads.update((rows) =>
        rows.map((r) => (r.id === l.id ? { ...r, tags: updated.tags, version: updated.version } : r)),
      );
      if (this.selected()?.id === l.id)
        this.selected.set({ ...this.selected()!, tags: updated.tags, version: updated.version });
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  readonly isBrokerage = computed(() => {
    const user = this.auth.user();
    return (user?.company?.type ?? user?.workspace?.company?.type) === 'brokerage';
  });
  readonly stages = computed(() => (this.isBrokerage() ? BROKERAGE_LEAD_STATUSES : SALES_STAGES));
  readonly stageNames = computed(() => STAGE_NAMES[this.lang()]);
  readonly sources = Object.keys(SOURCE_NAMES);
  readonly money = salesMoney;
  readonly canCreate = computed(() => canCreateLead(this.auth.user()));
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('leads.manage') ?? false,
  );
  readonly owners = signal<Array<{ id: string; name: string; leadCount: number }>>([]);
  /** A plain sales agent only ever sees their own leads, so the person filter is moot for them. */
  readonly ownScope = computed(() => this.auth.user()?.scope === 'own');
  readonly personOpen = signal(false);
  readonly personQuery = signal('');
  readonly filteredOwners = computed(() => {
    const q = this.personQuery().trim().toLowerCase();
    const list = this.owners();
    return q ? list.filter((o) => o.name.toLowerCase().includes(q)) : list;
  });
  readonly selectedOwnerName = computed(
    () =>
      this.owners().find((o) => o.id === this.ownerFilter())?.name ??
      this.t('Any person', 'أي شخص'),
  );
  readonly personFilterEl = viewChild<ElementRef<HTMLElement>>('personFilter');
  togglePersonFilter() {
    this.personOpen.update((v) => !v);
    if (this.personOpen()) this.personQuery.set('');
  }
  closePersonFilter() {
    this.personOpen.set(false);
  }
  /** No backdrop: that would block scrolling the rest of the page while the panel is open. */
  @HostListener('document:click', ['$event'])
  onDocumentClickForPersonFilter(e: MouseEvent) {
    if (!this.personOpen()) return;
    const el = this.personFilterEl()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.closePersonFilter();
  }
  @HostListener('document:keydown.escape')
  onEscapeForPersonFilter() {
    if (this.personOpen()) this.closePersonFilter();
  }
  choosePerson(id: string) {
    this.ownerFilter.set(id);
    this.personOpen.set(false);
    void this.reload();
  }
  readonly selected = signal<SalesLead | null>(null);
  readonly timeline = signal<SalesActivity[]>([]);
  readonly activityTotal = signal(0);
  readonly activityPage = signal(1);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly newOpen = signal(false);
  readonly editing = signal<SalesLead | null>(null);
  readonly formError = signal('');
  readonly dupOpen = signal(false);
  readonly duplicates = signal<any[]>([]);
  readonly duplicateId = signal('');
  readonly dupReason = signal('');
  readonly budgetMinFilter = signal('');
  readonly budgetMaxFilter = signal('');
  readonly segmentFilter = signal<'all' | 'res' | 'com'>('all');
  readonly ownerFilter = signal('');
  readonly callOutcome = signal('');
  readonly note = signal('');
  readonly reason = signal('');
  readonly actionStage = signal('');
  readonly toast = signal('');
  draft = {
    name: '',
    nameAr: '',
    phone: '',
    email: '',
    segment: 'res',
    want: '',
    wantAr: '',
    budget: '',
    source: 'manual',
    campaignId: '',
    ownerId: '',
    score: '',
  };
  private serial = 0;
  private detailSerial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private formRequest = crypto.randomUUID();
  private noteRequest = crypto.randomUUID();
  constructor() {
    this.campaignFilter.set(this.route?.snapshot.queryParamMap.get('campaignId') ?? '');
    // Top-bar search and "+ New lead" land here as ?q= / ?new=1.
    this.search.set(this.route?.snapshot.queryParamMap.get('q') ?? '');
    void this.reload();
    const sub = this.route?.queryParamMap?.subscribe((p) => {
      const segment = p.get('segment');
      if (['all', 'res', 'com'].includes(segment ?? ''))
        this.segmentFilter.set(segment as 'all' | 'res' | 'com');
      this.ownerFilter.set(p.get('ownerId') ?? '');
      this.budgetMinFilter.set(p.get('budgetMinMinor') ?? '');
      this.budgetMaxFilter.set(p.get('budgetMaxMinor') ?? '');
      const stage = p.get('stage');
      const brokerageStatus = p.get('leadStatus');
      const activeStage = brokerageStatus || stage;
      if (activeStage && this.stages().includes(activeStage as never))
        this.stageFilter.set(activeStage);
      void this.reload();
      const q = p.get('q');
      if (q !== null && q !== this.search()) {
        this.search.set(q);
        void this.reload();
      }
      // Any value works; the shell sends a timestamp so repeated clicks re-trigger.
      if (p.get('new') && this.canCreate()) this.openNew();
    });
    this.destroy.onDestroy(() => sub?.unsubscribe());
    void this.loadOwners();
    const linked = this.route?.snapshot.queryParamMap.get('leadId');
    if (linked && /^[0-9a-f-]{36}$/i.test(linked)) void this.open(linked);
    this.destroy.onDestroy(() => {
      this.serial++;
      this.detailSerial++;
      this.campaignSerial++;
      clearTimeout(this.timer);
    });
  }
  async loadOwners() {
    try {
      const r = await this.api.get('leads/options');
      this.owners.set(r.owners);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async reload(page = 1) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const q: Record<string, string> = {
        page: String(page),
        limit: '50',
        archived: this.archived() ? 'all' : 'active',
      };
      if (this.segmentFilter() !== 'all') q['segment'] = this.segmentFilter();
      if (this.ownerFilter()) q['ownerId'] = this.ownerFilter();
      if (this.budgetMinFilter()) q['budgetMinMinor'] = this.budgetMinFilter();
      if (this.budgetMaxFilter()) q['budgetMaxMinor'] = this.budgetMaxFilter();
      if (this.campaignFilter()) q['campaignId'] = this.campaignFilter();
      if (this.search().trim()) q['q'] = this.search().trim();
      if (this.stageFilter() !== 'all')
        q[this.isBrokerage() ? 'leadStatus' : 'stage'] = this.stageFilter();
      const r = await this.api.get('leads', q);
      if (serial === this.serial) {
        this.leads.set(r.items);
        this.total.set(r.total);
        this.page.set(page);
      }
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  searchChanged(value: string) {
    this.search.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), 250);
  }
  name(l: SalesLead) {
    return l.name[this.lang()];
  }
  want(l: SalesLead) {
    return l.want[this.lang()];
  }
  source(key: string) {
    return SOURCE_NAMES[key]?.[this.ar() ? 1 : 0] ?? key;
  }
  date(s: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(s));
  }
  async open(id: string) {
    const serial = ++this.detailSerial;
    this.selected.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.note.set('');
    this.reason.set('');
    this.actionStage.set('');
    this.noteRequest = crypto.randomUUID();
    this.linkedTasks.set([]);
    this.taskError.set('');
    try {
      const [lead, activity] = await Promise.all([
        this.api.get('leads/' + id),
        this.api.get('leads/' + id + '/activities'),
      ]);
      if (serial === this.detailSerial) {
        this.selected.set(lead);
        this.timeline.set(activity.items);
        this.activityTotal.set(activity.total);
        this.activityPage.set(1);
        if (this.canReadTasks()) void this.loadTasks(id, serial);
      }
    } catch (e) {
      if (serial === this.detailSerial) this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }
  async loadTasks(id: string, serial = this.detailSerial) {
    this.taskLoading.set(true);
    this.taskError.set('');
    try {
      const r = await this.api.get('tasks', { leadId: id, status: 'all', limit: '10' });
      if (serial === this.detailSerial) {
        this.linkedTasks.set(r.items);
        this.linkedTaskTotal.set(r.total);
      }
    } catch (e) {
      if (serial === this.detailSerial) this.taskError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.taskLoading.set(false);
    }
  }
  goTasks(create = false) {
    const id = this.selected()?.id;
    if (id)
      void this.router?.navigate(['/company/tasks'], {
        queryParams: { leadId: id, ...(create ? { new: '1' } : {}) },
      });
  }
  taskStatus(s: string) {
    return (
      (
        {
          open: this.t('Open', 'مفتوحة'),
          done: this.t('Completed', 'مكتملة'),
          cancelled: this.t('Cancelled', 'ملغاة'),
        } as Record<string, string>
      )[s] ?? s
    );
  }
  taskDate(s: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
    }).format(new Date(s + 'T12:00:00Z'));
  }
  closeDrawer() {
    this.detailSerial++;
    this.selected.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }
  async moreActivity() {
    const l = this.selected();
    if (!l || this.detailLoading()) return;
    const serial = this.detailSerial;
    this.detailLoading.set(true);
    try {
      const page = this.activityPage() + 1;
      const r = await this.api.get('leads/' + l.id + '/activities', { page: String(page) });
      if (serial === this.detailSerial) {
        this.timeline.update((a) => [...a, ...r.items]);
        this.activityTotal.set(r.total);
        this.activityPage.set(page);
      }
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }
  activityText(a: SalesActivity) {
    const labels: Record<string, [string, string]> = {
      'task.created': ['Task created', 'تم إنشاء مهمة'],
      'task.updated': ['Task updated', 'تم تعديل مهمة'],
      'task.completed': ['Task completed', 'تم إنجاز مهمة'],
      'task.reopened': ['Task reopened', 'تمت إعادة فتح مهمة'],
      'task.cancelled': ['Task cancelled', 'تم إلغاء مهمة'],
      'task.linked': ['Task linked', 'تم ربط مهمة'],
      'task.unlinked': ['Task unlinked', 'تم فك ربط مهمة'],
      'task.seeded': ['Initial sample task', 'مهمة تجريبية أولية'],
      'lead.routed': ['Lead automatically assigned', 'تم توزيع العميل آلياً'],
      'lead.sla_reassigned': ['SLA reassignment', 'إعادة إسناد بسبب المهلة'],
      'reservation.created': ['Reservation created', 'تم إنشاء حجز'],
      'reservation.confirmed': ['Reservation confirmed', 'تم تأكيد الحجز'],
      'reservation.extended': ['Reservation extended', 'تم تمديد الحجز'],
      'reservation.canceled': ['Reservation canceled', 'تم إلغاء الحجز'],
      'reservation.expired': ['Reservation expired', 'انتهى الحجز'],
      'reservation.converted': ['Reservation converted', 'تم تحويل الحجز'],
      'reservation.seeded': ['Initial sample reservation', 'حجز تجريبي أولي'],
      'contract.updated': ['Draft agreement updated', 'تم تعديل مسودة الاتفاق'],
      'contract.sharing_recorded': ['Manual sharing recorded', 'تم تسجيل مشاركة يدوية'],
      'contract.evidence_attached': ['Contract evidence attached', 'تم إرفاق مستند عقد'],
      'contract.seeded': ['Initial sample draft agreement', 'مسودة اتفاق تجريبية'],
      'commission.calculated': ['Commission calculated', 'تم حساب عمولة'],
      'commission.recalculated': ['Commission recalculated', 'تمت إعادة حساب عمولة'],
      'commission.approved': ['Commission approved', 'تم اعتماد عمولة'],
      'commission.payable': ['Commission recorded payable', 'تم تسجيل عمولة مستحقة'],
      'commission.canceled': ['Commission canceled', 'تم إلغاء عمولة'],
      'commission.seeded': ['Initial sample commission forecast', 'تقدير عمولة تجريبي'],
      'contract.created': ['Draft contract created', 'تم إنشاء مسودة عقد'],
      'contract.signature_recorded': ['External signature recorded', 'تم تسجيل توقيع خارجي'],
      'contract.voided': ['Contract void recorded', 'تم تسجيل إلغاء عقد'],
      'commission.payment_recorded': [
        'External commission payment recorded',
        'تم تسجيل صرف عمولة خارجي',
      ],
      'lead.created': ['Lead created', 'تم إنشاء العميل'],
      'lead.seeded': ['Initial sample lead', 'عميل تجريبي أولي'],
      'lead.updated': ['Lead details updated', 'تم تعديل البيانات'],
      'lead.stage_changed': ['Stage changed', 'تم تغيير المرحلة'],
      'lead.status_changed': ['Lead status changed', 'تم تغيير حالة العميل'],
      'lead.note_added': ['Note', 'ملاحظة'],
      'lead.archived': ['Lead archived', 'تمت الأرشفة'],
      'lead.restored': ['Lead restored', 'تمت الاستعادة'],
      'lead.related': ['Related lead added', 'تم ربط عميل'],
      'deal.created': ['Pipeline opportunity created', 'تم إنشاء فرصة'],
      'deal.updated': ['Pipeline opportunity updated', 'تم تعديل الفرصة'],
    };
    const d = a.details;
    return (
      (labels[a.kind]?.[this.ar() ? 1 : 0] ?? a.kind) +
      (d['from']
        ? ' · ' +
          this.stageNames()[d['from'] as SalesStage] +
          ' → ' +
          this.stageNames()[d['to'] as SalesStage]
        : '') +
      (d['ownerName'] ? ' · ' + d['ownerName'] : '') +
      (d['toUserName']
        ? ' · ' + (d['fromUserName'] ?? this.t('Unassigned', 'دون مسؤول')) + ' → ' + d['toUserName']
        : '') +
      (d['note'] ? ' · ' + d['note'] : '') +
      (d['taskTitle']
        ? ' · ' + d['taskTitle'][this.lang()] + ' · ' + this.taskStatus(d['status'])
        : '') +
      (d['reason'] ? ' · ' + d['reason'] : '')
    );
  }
  openNew(l?: SalesLead) {
    if (!l && !this.canCreate()) return;
    this.editing.set(l ?? null);
    this.draft = l
      ? {
          name: l.name.en,
          nameAr: l.name.ar,
          phone: l.phone,
          email: l.email ?? '',
          segment: l.segment,
          want: l.want.en,
          wantAr: l.want.ar,
          budget: majorAmount(l.budgetMinor),
          source: l.source,
          campaignId: l.campaign?.id ?? '',
          ownerId: l.owner?.id ?? '',
          score: l.score === null ? '' : String(l.score),
        }
      : {
          name: '',
          nameAr: '',
          phone: '',
          email: '',
          segment: 'res',
          want: '',
          wantAr: '',
          budget: '',
          source: 'manual',
          campaignId: '',
          ownerId: 'auto',
          score: '',
        };
    this.formRequest = crypto.randomUUID();
    this.formError.set('');
    this.dupOpen.set(false);
    this.newOpen.set(true);
    if (this.canMarketing()) void this.loadCampaigns(true);
  }
  closeNew() {
    if (this.saving()) return;
    this.newOpen.set(false);
    this.dupOpen.set(false);
  }
  async submit(mode?: 'create' | 'link') {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const current = this.editing();
      const r = await this.api.write(current ? 'leads/' + current.id + '/update' : 'leads', {
        requestId: this.formRequest,
        name: this.draft.name.trim(),
        ...(this.draft.nameAr.trim() ? { nameAr: this.draft.nameAr.trim() } : {}),
        phone: this.draft.phone,
        email: this.draft.email.trim() || null,
        segment: this.draft.segment,
        want: this.draft.want.trim(),
        wantAr: this.draft.wantAr.trim() || this.draft.want.trim(),
        budgetMinor: minorAmount(this.draft.budget, true),
        source: this.draft.source,
        ...(this.draft.ownerId === 'auto' && !current
          ? {}
          : { ownerId: this.draft.ownerId || null }),
        ...(this.canMarketing() ? { campaignId: this.draft.campaignId || null } : {}),
        score:
          this.draft.score === '' || this.draft.score === null ? null : Number(this.draft.score),
        ...(current ? { version: current.version } : {}),
        ...(mode
          ? {
              duplicateMode: mode,
              duplicateOf: this.duplicateId(),
              reason: this.dupReason().trim(),
            }
          : {}),
      });
      this.newOpen.set(false);
      this.dupOpen.set(false);
      await this.reload();
      await this.open(r.id);
      this.toast.set(this.t('Lead saved', 'تم حفظ العميل'));
    } catch (e) {
      if (e instanceof ApiError && e.details['code'] === 'duplicate_lead') {
        this.duplicates.set(e.details['duplicates'] ?? []);
        this.duplicateId.set(this.duplicates()[0]?.id ?? '');
        this.dupReason.set('');
        this.dupOpen.set(true);
      } else this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  formChanged() {
    this.formRequest = crypto.randomUUID();
  }
  async loadCampaigns(reset: boolean) {
    const n = ++this.campaignSerial,
      page = reset ? 1 : this.campaignPage + 1;
    try {
      const r = await this.api.get('marketing', {
        status: 'active',
        q: this.campaignQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.campaignSerial) return;
      let items = reset ? r.items : [...this.campaignOptions(), ...r.items];
      const current = this.editing()?.campaign;
      if (current && !items.some((c: any) => c.id === current.id))
        items = [...items, { id: current.id, name: current.name, source: this.editing()!.source }];
      this.campaignOptions.set(items);
      this.campaignTotal.set(r.total);
      this.campaignPage = page;
    } catch (e: any) {
      if (n === this.campaignSerial) this.formError.set(e.message);
    }
  }
  campaignChanged() {
    const c = this.campaignOptions().find((c) => c.id === this.draft.campaignId);
    if (c) this.draft.source = c.source;
    this.formChanged();
  }
  sourceChanged() {
    const c = this.campaignOptions().find((c) => c.id === this.draft.campaignId);
    if (c && c.source !== this.draft.source) this.draft.campaignId = '';
    this.formChanged();
  }
  clearCampaignFilter() {
    this.campaignFilter.set('');
    void this.router?.navigate(['/company/leads']);
    void this.reload();
  }
  async useExisting() {
    const id = this.duplicateId();
    if (!id) return;
    this.newOpen.set(false);
    this.dupOpen.set(false);
    await this.open(id);
  }
  async mutate(kind: 'stage' | 'archive' | 'notes', action?: string) {
    const l = this.selected();
    if (!l || this.saving()) return;
    this.saving.set(true);
    this.detailError.set('');
    try {
      await this.api.write('leads/' + l.id + '/' + kind, {
        requestId: kind === 'notes' ? this.noteRequest : crypto.randomUUID(),
        version: l.version,
        ...(kind === 'notes'
          ? {
              note: this.note().trim(),
              kind: this.actKind() === 'meeting' ? 'viewing' : this.actKind(),
              ...(this.actKind() === 'call' && this.callOutcome()
                ? { outcome: this.callOutcome() }
                : {}),
            }
          : kind === 'stage'
            ? {
                stage: this.actionStage(),
                ...(this.reason().trim() ? { reason: this.reason().trim() } : {}),
              }
            : { action, reason: this.reason().trim() }),
      });
      await this.reload(this.page());
      await this.open(l.id);
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  // ---- design helpers ----
  readonly stageColor: Record<string, string> = {
    new: '#C4C4BE',
    attempting: '#E0A24B',
    contacted: '#4FB0C6',
    qualified: '#5B78E5',
    nurturing: '#9B7BD4',
    unresponsive: '#9A9A94',
    viewing: '#D99A28',
    offer: '#8BB33A',
    contract: '#111113',
    won: '#2FA35F',
    lost: '#E2553B',
    unqualified: '#B8564A',
    new_lead: '#C4C4BE',
    call_back: '#E0A24B',
    hot_case: '#E2553B',
    low_budget: '#9A9A94',
    no_answer: '#4FB0C6',
    non_potential: '#9A9A94',
    potential: '#5B78E5',
    resale: '#9B7BD4',
    wrong_number: '#B8564A',
    switched_off: '#4FB0C6',
    whatsapp: '#2FA35F',
    closed_deal: '#2FA35F',
    closed_outside: '#8A8A90',
    eoi: '#8BB33A',
    meeting_scheduled: '#D99A28',
    meeting_done: '#2FA35F',
  };
  initials(l: SalesLead) {
    return this.name(l)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
  ago(iso: string) {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return this.t(`${m} min ago`, `منذ ${m} د`);
    if (m < 1440) return this.t(`${Math.round(m / 60)} h ago`, `منذ ${Math.round(m / 60)} س`);
    return this.t(`${Math.round(m / 1440)} d ago`, `منذ ${Math.round(m / 1440)} يوم`);
  }
  scoreColor(n: number | null) {
    return n === null ? '#A1A1A6' : n >= 85 ? '#B4442F' : n >= 75 ? '#B7791F' : '#6E6E73';
  }
  segLabel(l: SalesLead) {
    return l.segment === 'com' ? this.t('Com', 'تجاري') : this.t('Res', 'سكني');
  }
  /** Latest recorded note, from the real activity timeline. */
  readonly latestNote = computed(() => {
    const n = this.timeline().find((a) => a.kind === 'lead.note_added');
    return n ? { text: String(n.details['note'] ?? ''), by: n.actor, at: n.at } : null;
  });
  /** "Next step" = the earliest open linked task. */
  readonly nextTask = computed(
    () =>
      [...this.linkedTasks()]
        .filter((t) => t.status === 'open')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
  );
  waLink(phone: string) {
    return 'https://wa.me/' + phone.replace(/\D/g, '');
  }
  telLink(phone: string) {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }
  /** Activity composer: the API stores notes, so the chosen kind is prefixed to the note text. */
  readonly actKind = signal<'call' | 'whatsapp' | 'meeting' | 'note'>('note');
  readonly actKinds: Array<['call' | 'whatsapp' | 'meeting' | 'note', string, string]> = [
    ['call', 'Call', 'مكالمة'],
    ['whatsapp', 'WhatsApp', 'واتساب'],
    ['meeting', 'Viewing / meeting', 'معاينة / اجتماع'],
    ['note', 'Note', 'ملاحظة'],
  ];
  async logActivity() {
    const text = this.note().trim();
    if (!text) return;
    const k = this.actKinds.find((x) => x[0] === this.actKind())!;

    await this.mutate('notes');
    if (this.detailError()) this.note.set(text);
    else this.note.set('');
  }
  leadStage(l: SalesLead) {
    return this.isBrokerage() ? (l.brokerageStatus ?? 'new_lead') : l.stage;
  }
  stageIndex(s: string) {
    return this.stages().indexOf(s as never);
  }
  setSegment(s: 'all' | 'res' | 'com') {
    this.segmentFilter.set(s);
    void this.reload();
  }
  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3500);
  }

  /** One click sets any status; no stepping or reason required. */
  async setStage(s: string) {
    const l = this.selected();
    if (!l || this.saving() || this.leadStage(l) === s) return;
    if (this.isBrokerage()) {
      this.saving.set(true);
      this.detailError.set('');
      try {
        await this.api.write('leads/' + l.id + '/status', {
          requestId: crypto.randomUUID(),
          version: l.version,
          status: s,
        });
        await this.reload(this.page());
        await this.open(l.id);
      } catch (e) {
        this.detailError.set((e as Error).message);
      } finally {
        this.saving.set(false);
      }
      return;
    }
    this.actionStage.set(s);
    await this.mutate('stage');
  }
}
