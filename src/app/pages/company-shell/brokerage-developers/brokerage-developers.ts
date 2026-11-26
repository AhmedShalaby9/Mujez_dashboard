import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth.service';
import { BrokerageDealsApi } from '../../../brokerage-deals-api.service';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-brokerage-developers',
  imports: [FormsModule],
  templateUrl: './brokerage-developers.html',
  styleUrls: ['../company-ui.scss', './brokerage-developers.scss'],
})
export class BrokerageDevelopers {
  readonly api = inject(BrokerageDealsApi);
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly owner = computed(
    () =>
      this.auth.user()?.pool === 'company_admin' &&
      this.auth.user()?.role === 'company_owner' &&
      !this.auth.user()?.workspace,
  );
  readonly brokerage = computed(
    () =>
      (this.auth.user()?.company?.type ?? this.auth.user()?.workspace?.company?.type) ===
      'brokerage',
  );
  readonly items = signal<{ id: string; name: string; version: number }[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  name = '';
  editId = '';
  editName = '';
  constructor() {
    if (this.brokerage()) void this.reload();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  async reload() {
    try {
      this.items.set(await this.api.developers());
      this.error.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async create() {
    if (!this.name.trim()) return;
    this.busy.set(true);
    try {
      await this.api.createDeveloper(this.name.trim());
      this.name = '';
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  edit(d: { id: string; name: string }) {
    this.editId = d.id;
    this.editName = d.name;
  }
  async save(d: { id: string; version: number }) {
    this.busy.set(true);
    try {
      await this.api.updateDeveloper(d.id, this.editName.trim(), d.version);
      this.editId = '';
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  async archive(d: { id: string; version: number }) {
    if (!confirm(this.t('Archive this developer?', 'أرشفة هذا المطوّر؟'))) return;
    this.busy.set(true);
    try {
      await this.api.archiveDeveloper(d.id, d.version);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
