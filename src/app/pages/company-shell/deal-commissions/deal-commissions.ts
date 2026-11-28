import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CompactAmountDirective } from '../../../compact-amount.directive';
import { CompanyUiState } from '../company-ui-state';
import { salesMoney, minorAmount } from '../../../sales-api.service';
import {
  DealCommissionsApi,
  type CommissionEntry,
  type CommissionOptions,
} from '../../../deal-commissions-api.service';

const LIMIT = 30;
type EntryRow = { userId: string; amount: string; note: string };
const emptyRow = (): EntryRow => ({ userId: '', amount: '', note: '' });

@Component({
  selector: 'app-deal-commissions',
  imports: [FormsModule, DatePipe, CompactAmountDirective],
  templateUrl: './deal-commissions.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    './deal-commissions.scss',
  ],
})
export class DealCommissions {
  readonly ui = inject(CompanyUiState);
  private readonly api = inject(DealCommissionsApi);
  private readonly route = inject(ActivatedRoute);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly money = salesMoney;

  readonly items = signal<CommissionEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly canManage = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly options = signal<CommissionOptions | null>(null);
  readonly dialogOpen = signal(false);
  readonly dealId = signal('');
  readonly rows = signal<EntryRow[]>([emptyRow()]);
  readonly saving = signal(false);
  readonly dialogError = signal('');

  constructor() {
    void this.load();
    const dealId = this.route.snapshot.queryParamMap.get('dealId');
    if (dealId && this.route.snapshot.queryParamMap.get('new') === '1')
      void this.openDialog(dealId);
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.list({ page: String(this.page()), limit: String(LIMIT) });
      this.items.set(r.items);
      this.total.set(r.total);
      this.canManage.set(r.canManage);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  nextPage(delta: number) {
    this.page.set(Math.max(1, this.page() + delta));
    void this.load();
  }

  async openDialog(presetDealId?: string) {
    this.dialogError.set('');
    this.dealId.set(presetDealId ?? '');
    this.rows.set([emptyRow()]);
    this.dialogOpen.set(true);
    try {
      this.options.set(await this.api.options());
    } catch (e) {
      this.dialogError.set((e as Error).message);
    }
  }
  closeDialog() {
    this.dialogOpen.set(false);
  }
  addRow() {
    this.rows.set([...this.rows(), emptyRow()]);
  }
  removeRow(row: EntryRow) {
    this.rows.set(this.rows().filter((r) => r !== row));
  }
  dealLabel(id: string) {
    const d = this.options()?.deals.find((x) => x.id === id);
    return d ? `${d.clientName} · ${salesMoney(d.unitValueMinor)}` : '';
  }

  async submit() {
    if (this.saving()) return;
    this.dialogError.set('');
    if (!this.dealId()) {
      this.dialogError.set(this.t('Choose a deal.', 'اختر الصفقة.'));
      return;
    }
    const seen = new Set<string>();
    const entries: { userId: string; amountMinor: string; note?: string }[] = [];
    for (const row of this.rows()) {
      if (!row.userId && !row.amount.trim() && !row.note.trim()) continue;
      if (!row.userId || !row.amount.trim()) {
        this.dialogError.set(
          this.t('Choose a person and an amount for every row.', 'اختر الشخص والمبلغ لكل صف.'),
        );
        return;
      }
      if (seen.has(row.userId)) {
        this.dialogError.set(
          this.t('Each person can only appear once.', 'لا يمكن تكرار الشخص نفسه.'),
        );
        return;
      }
      seen.add(row.userId);
      let amountMinor: string;
      try {
        amountMinor = minorAmount(row.amount) ?? '';
      } catch {
        this.dialogError.set(this.t('Enter a valid amount.', 'أدخل مبلغًا صحيحًا.'));
        return;
      }
      if (!amountMinor || BigInt(amountMinor) <= 0n) {
        this.dialogError.set(this.t('Enter a valid amount.', 'أدخل مبلغًا صحيحًا.'));
        return;
      }
      entries.push({ userId: row.userId, amountMinor, note: row.note.trim() || undefined });
    }
    if (!entries.length) {
      this.dialogError.set(this.t('Add at least one person.', 'أضف شخصًا واحدًا على الأقل.'));
      return;
    }
    this.saving.set(true);
    try {
      await this.api.create(this.dealId(), entries);
      this.closeDialog();
      this.page.set(1);
      await this.load();
    } catch (e) {
      this.dialogError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
