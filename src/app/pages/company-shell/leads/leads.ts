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
    ownerId: '',
    score: '',
  };
  private serial = 0;
  private detailSerial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private formRequest = crypto.randomUUID();
  private noteRequest = crypto.randomUUID();
  constructor() {
    void this.reload();
    void this.loadOwners();
    this.destroy.onDestroy(() => {
      this.serial++;
      this.detailSerial++;
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
      }
    } catch (e) {
      if (serial === this.detailSerial) this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
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
      (d['note'] ? ' · ' + d['note'] : '') +
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
          ownerId: this.auth.user()?.id ?? '',
          score: '',
        };
    this.formRequest = crypto.randomUUID();
    this.formError.set('');
    this.dupOpen.set(false);
    this.newOpen.set(true);
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
        ownerId: this.draft.ownerId || null,
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
