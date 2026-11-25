import { CompactAmountDirective } from '../../../compact-amount.directive';
import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  SalesApi,
  SALES_STAGES,
  BROKERAGE_LEAD_STATUSES,
  isClosedStage,
  STAGE_NAMES,
  salesMoney,
  minorAmount,
  majorAmount,
  type SalesDeal,
  type SalesStage,
} from '../../../sales-api.service';
@Component({
  selector: 'app-pipeline',
  imports: [CompactAmountDirective, FormsModule],
  templateUrl: './pipeline.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './pipeline.scss',
  ],
})
export class Pipeline {
  private readonly ui = inject(CompanyUiState);
  readonly api = inject(SalesApi);
  readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly isBrokerage = computed(() => {
    const user = this.auth.user();
    return (user?.company?.type ?? user?.workspace?.company?.type) === 'brokerage';
  });
  readonly stages = computed(() => this.isBrokerage() ? BROKERAGE_LEAD_STATUSES : SALES_STAGES);
  readonly stageNames = computed(() => STAGE_NAMES[this.lang()]);
  readonly money = salesMoney;
  readonly deals = signal<SalesDeal[]>([]);
  readonly stats = signal<
    Array<{ stage: SalesStage; count: number; saleMinor: string; unsetCount?: number }>
  >([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly q = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('pipeline.manage') ?? false,
  );
  readonly canMove = computed(() =>
    this.auth.user()?.permissions.includes(this.isBrokerage() ? 'leads.manage' : 'pipeline.manage') ?? false,
  );
  boardStatus(d: SalesDeal) {
    return this.isBrokerage() ? (d.brokerageStatus ?? 'new_lead') : d.stage;
  }
  isClosed(status: string) {
    return this.isBrokerage()
      ? ['closed_deal', 'closed_outside', 'non_potential'].includes(status)
      : isClosedStage(status);
  }
  readonly columns = computed(() =>
    this.stages().map((stage) => ({
      stage,
      items: this.deals().filter((d) => this.boardStatus(d) === stage),
      count: this.stats().find((s) => s.stage === stage)?.count ?? 0,
      total: this.stats().find((s) => s.stage === stage)?.saleMinor ?? '0',
      unsetCount: this.stats().find((s) => s.stage === stage)?.unsetCount ?? 0,
    })),
  );
  readonly dialog = signal(false);
  readonly editing = signal<SalesDeal | null>(null);
  readonly leadOptions = signal<
    Array<{ id: string; reference: string; name: { en: string; ar: string }; version: number }>
  >([]);
  readonly optionTotal = signal(0);
  readonly optionPage = signal(1);
  readonly optionSearch = signal('');
  readonly optionsLoading = signal(false);
  readonly reason = signal('');
  draft = { leadId: '', title: '', titleAr: '', type: 'sale', value: '' };
  private serial = 0;
  private optionsSerial = 0;
  private formRequest = crypto.randomUUID();
  constructor() {
    void this.reload();
    this.destroy.onDestroy(() => {
      this.serial++;
      this.optionsSerial++;
    });
  }
  readonly segmentFilter = signal<'all' | 'res' | 'com'>('all');
  setSegment(s: 'all' | 'res' | 'com') {
    this.segmentFilter.set(s);
    void this.reload();
  }
  daysInStage(d: SalesDeal) {
    return d.stageChangedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000))
      : null;
  }
  async reload(page = 1) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get('pipeline', {
        page: String(page),
        limit: '100',
        ...(this.segmentFilter() !== 'all' ? { segment: this.segmentFilter() } : {}),
        ...(this.q().trim() ? { q: this.q().trim() } : {}),
      });
      if (serial === this.serial) {
        this.deals.set(page === 1 ? r.items : [...this.deals(), ...r.items]);
        this.total.set(r.total);
        this.stats.set(r.stats);
        this.page.set(page);
      }
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
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
    new_lead: '#C4C4BE', call_back: '#E0A24B', hot_case: '#E2553B',
    low_budget: '#9A9A94', no_answer: '#4FB0C6', non_potential: '#9A9A94',
    potential: '#5B78E5', resale: '#9B7BD4', wrong_number: '#B8564A',
    switched_off: '#4FB0C6', whatsapp: '#2FA35F', closed_deal: '#2FA35F',
    closed_outside: '#8A8A90', eoi: '#8BB33A',
    meeting_scheduled: '#D99A28', meeting_done: '#2FA35F',
  };
  readonly toast = signal('');
  private say(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3500);
  }
  readonly openValue = computed(() =>
    this.stats()
      .filter((x) => !this.isClosed(x.stage))
      .reduce((n, x) => n + BigInt(x.saleMinor), 0n)
      .toString(),
  );
  readonly openUnsetCount = computed(() =>
    this.stats()
      .filter((x) => !this.isClosed(x.stage))
      .reduce((n, x) => n + (x.unsetCount ?? 0), 0),
  );
  notSet() {
    return this.t('Not set', 'غير محدد');
  }
  pending(d: SalesDeal) {
    return d.opportunityId === null;
  }
  displayMoney(value: string | null) {
    return value === null ? this.notSet() : this.money(value);
  }
  readonly openCount = computed(() =>
    this.stats()
      .filter((x) => !this.isClosed(x.stage))
      .reduce((n, x) => n + x.count, 0),
  );
  initials(name: string | undefined) {
    return (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
  // ---- drag & drop (any stage to any other) ----
  readonly dragging = signal<SalesDeal | null>(null);
  readonly overStage = signal<string | null>(null);
  canDrop(d: SalesDeal | null, stage: string) {
    return !!d && this.canMove() && this.boardStatus(d) !== stage;
  }
  dragStart(e: DragEvent, d: SalesDeal) {
    this.dragging.set(d);
    e.dataTransfer?.setData('text/plain', d.id);
  }
  dragEnd() {
    this.dragging.set(null);
    this.overStage.set(null);
  }
  dragOver(e: DragEvent, stage: string) {
    if (this.canDrop(this.dragging(), stage)) {
      e.preventDefault();
      this.overStage.set(stage);
    }
  }
  drop(e: DragEvent, stage: string) {
    e.preventDefault();
    const d = this.dragging();
    this.dragEnd();
    if (!d || this.boardStatus(d) === stage) return;
    void this.move(d, stage);
  }

  async move(d: SalesDeal, stage: string, requestId = crypto.randomUUID()) {
    if (!stage || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.formError.set('');
    try {
      await this.api.write(this.isBrokerage() ? 'leads/' + d.leadId + '/status' : 'pipeline/' + d.id + '/stage', {
        requestId,
        version: d.leadVersion,
        [this.isBrokerage() ? 'status' : 'stage']: stage,
      });
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async openForm(d?: SalesDeal) {
    this.editing.set(d ?? null);
    this.dialog.set(true);
    this.formError.set('');
    this.formRequest = crypto.randomUUID();
    this.draft = d
      ? {
          leadId: d.leadId,
          title: d.title?.en ?? '',
          titleAr: d.title?.ar ?? '',
          type: d.type ?? '',
          value: d.valueMinor === null ? '' : majorAmount(d.valueMinor),
        }
      : { leadId: '', title: '', titleAr: '', type: 'sale', value: '' };
    if (!d) {
      this.optionSearch.set('');
      await this.loadOptions();
    }
  }
  async loadOptions(page = 1) {
    const serial = ++this.optionsSerial;
    this.optionsLoading.set(true);
    try {
      const r = await this.api.get('pipeline/lead-options', {
        page: String(page),
        limit: '100',
        ...(this.optionSearch().trim() ? { q: this.optionSearch().trim() } : {}),
      });
      if (serial === this.optionsSerial) {
        this.leadOptions.set(page === 1 ? r.items : [...this.leadOptions(), ...r.items]);
        this.optionTotal.set(r.total);
        this.optionPage.set(page);
      }
    } catch (e) {
      if (serial === this.optionsSerial) this.formError.set((e as Error).message);
    } finally {
      if (serial === this.optionsSerial) this.optionsLoading.set(false);
    }
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const d = this.editing();
      const lead = this.leadOptions().find((x) => x.id === this.draft.leadId);
      const existing = d && !this.pending(d);
      if (!['sale', 'lease'].includes(this.draft.type))
        throw Error(this.t('Choose a deal type', 'اختر نوع الفرصة'));
      if (!d && !lead) throw Error(this.t('Choose an available lead', 'اختر عميلًا متاحًا'));
      await this.api.write(existing ? 'pipeline/' + d.id + '/update' : 'pipeline', {
        requestId: this.formRequest,
        title: this.draft.title.trim(),
        ...(this.draft.titleAr.trim() ? { titleAr: this.draft.titleAr.trim() } : {}),
        type: this.draft.type,
        valueMinor: minorAmount(this.draft.value),
        version: d ? (existing ? d.version : d.leadVersion) : lead!.version,
        ...(!existing ? { leadId: d?.leadId ?? lead!.id } : {}),
      });
      this.dialog.set(false);
      await this.reload();
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
