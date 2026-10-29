import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  SalesApi,
  SALES_STAGES,
  STAGE_NAMES,
  salesMoney,
  minorAmount,
  majorAmount,
  type SalesDeal,
  type SalesStage,
} from '../../../sales-api.service';
@Component({
  selector: 'app-pipeline',
  imports: [FormsModule],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss',
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
  readonly stages = SALES_STAGES;
  readonly stageNames = computed(() => STAGE_NAMES[this.lang()]);
  readonly money = salesMoney;
  readonly deals = signal<SalesDeal[]>([]);
  readonly stats = signal<Array<{ stage: SalesStage; count: number; saleMinor: string }>>([]);
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
  readonly columns = computed(() =>
    this.stages.map((stage) => ({
      stage,
      items: this.deals().filter((d) => d.stage === stage),
      count: this.stats().find((s) => s.stage === stage)?.count ?? 0,
      total: this.stats().find((s) => s.stage === stage)?.saleMinor ?? '0',
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
  readonly closing = signal<{ deal: SalesDeal; stage: 'lost' | 'reopen' } | null>(null);
  readonly reason = signal('');
  draft = { leadId: '', title: '', titleAr: '', type: 'sale', value: '' };
  private serial = 0;
  private optionsSerial = 0;
  private formRequest = crypto.randomUUID();
  private closeRequest = crypto.randomUUID();
  constructor() {
    void this.reload();
    this.destroy.onDestroy(() => {
      this.serial++;
      this.optionsSerial++;
    });
  }
  async reload(page = 1) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get('pipeline', {
        page: String(page),
        limit: '100',
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
  next(stage: SalesStage) {
    const i = this.stages.indexOf(stage);
    return i < 5 ? this.stages[i + 1] : null;
  }
  async move(d: SalesDeal, stage: string, reason?: string, requestId = crypto.randomUUID()) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.formError.set('');
    try {
      await this.api.write('pipeline/' + d.id + '/stage', {
        requestId,
        version: d.leadVersion,
        stage,
        ...(reason ? { reason } : {}),
      });
      this.closing.set(null);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  closeAction(d: SalesDeal, stage: 'lost' | 'reopen') {
    this.closing.set({ deal: d, stage });
    this.closeRequest = crypto.randomUUID();
    this.reason.set('');
    this.formError.set('');
  }
  confirmClose() {
    const c = this.closing();
    if (c) void this.move(c.deal, c.stage, this.reason().trim(), this.closeRequest);
  }
  async openForm(d?: SalesDeal) {
    this.editing.set(d ?? null);
    this.dialog.set(true);
    this.formError.set('');
    this.formRequest = crypto.randomUUID();
    this.draft = d
      ? {
          leadId: d.leadId,
          title: d.title.en,
          titleAr: d.title.ar,
          type: d.type,
          value: majorAmount(d.valueMinor),
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
      if (!d && !lead) throw Error(this.t('Choose an available lead', 'اختر عميلًا متاحًا'));
      await this.api.write(d ? 'pipeline/' + d.id + '/update' : 'pipeline', {
        requestId: this.formRequest,
        title: this.draft.title.trim(),
        ...(this.draft.titleAr.trim() ? { titleAr: this.draft.titleAr.trim() } : {}),
        type: this.draft.type,
        valueMinor: minorAmount(this.draft.value),
        version: d ? d.version : lead!.version,
        ...(!d ? { leadId: lead!.id } : {}),
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
