import { Router, ActivatedRoute } from '@angular/router';
import type { CompanyTask } from '../../../tasks-api.service';
import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService, ApiError } from '../../../auth.service';
import {
  SalesApi,
  SALES_STAGES,
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
  imports: [FormsModule],
  templateUrl: './leads.html',
  styleUrl: './leads.scss',
})
export class Leads {
  private readonly ui = inject(CompanyUiState);
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
  readonly contactNote = signal('');
  readonly contactChannel = signal('phone');
  private contactRequest = crypto.randomUUID();
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
  readonly stages = SALES_STAGES;
  readonly stageNames = computed(() => STAGE_NAMES[this.lang()]);
  readonly sources = Object.keys(SOURCE_NAMES);
  readonly money = salesMoney;
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('leads.manage') ?? false,
  );
  readonly owners = signal<Array<{ id: string; name: string }>>([]);
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
  readonly note = signal('');
  readonly reason = signal('');
  readonly actionStage = signal('');
  readonly toast = signal('');
  draft = {
    name: '',
    nameAr: '',
    phone: '',
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
    void this.reload();
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
      if (this.campaignFilter()) q['campaignId'] = this.campaignFilter();
      if (this.search().trim()) q['q'] = this.search().trim();
      if (this.stageFilter() !== 'all') q['stage'] = this.stageFilter();
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
    this.contactNote.set('');
    this.contactRequest = crypto.randomUUID();
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
      'lead.contact_recorded': ['First contact recorded', 'تم تسجيل أول تواصل'],
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
    this.editing.set(l ?? null);
    this.draft = l
      ? {
          name: l.name.en,
          nameAr: l.name.ar,
          phone: l.phone,
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
  contactChanged() {
    this.contactRequest = crypto.randomUUID();
  }
  async recordContact() {
    const l = this.selected();
    if (!l || this.saving()) return;
    this.saving.set(true);
    this.detailError.set('');
    try {
      await this.api.write('leads/' + l.id + '/contact', {
        requestId: this.contactRequest,
        version: l.version,
        channel: this.contactChannel(),
        note: this.contactNote().trim(),
      });
      await this.reload();
      await this.open(l.id);
    } catch (e: any) {
      this.detailError.set(e.message);
    } finally {
      this.saving.set(false);
    }
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
          ? { note: this.note().trim() }
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
  next(stage: SalesStage) {
    const i = this.stages.indexOf(stage);
    return i < 5 ? this.stages[i + 1] : null;
  }
}
