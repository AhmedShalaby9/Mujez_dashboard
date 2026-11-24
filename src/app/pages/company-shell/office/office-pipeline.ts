import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import { salesMoney } from '../../../sales-api.service';
import { clientStatuses } from './office-fields';
@Component({
  selector: 'app-office-pipeline',
  imports: [FormsModule, RouterLink],
  templateUrl: './office-pipeline.html',
  styleUrls: ['../../admin-shell/admin-ui.scss', '../company-ui.scss', './office-pipeline.scss'],
})
export class OfficePipeline {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly canManage = computed(() => !!this.auth.user()?.permissions.includes('leads.manage'));
  readonly stages = clientStatuses;
  readonly rows = signal<any[]>([]);
  readonly stats = signal<any[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly staff = signal<any[]>([]);
  q = '';
  purpose = '';
  ownerId = '';
  private generation = 0;
  private dragging: any = null;
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  money(v: string | null) {
    return v == null ? this.t('Not set', 'غير محدد') : salesMoney(v);
  }
  items(status: string) {
    return this.rows().filter((c) => c.status === status);
  }
  count(status: string) {
    return this.stats().find((s) => s.status === status)?.count ?? 0;
  }
  constructor() {
    inject(DestroyRef).onDestroy(() => this.generation++);
    void this.load();
    void this.auth
      .request('/api/v1/office/options')
      .then((r) => this.staff.set(r.staff))
      .catch((e) => this.error.set(e.message));
  }
  async load(page = 1) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    const query = new URLSearchParams({ limit: '100', page: String(page) });
    if (this.q.trim()) query.set('q', this.q.trim());
    if (this.purpose) query.set('purpose', this.purpose);
    if (this.ownerId) query.set('ownerId', this.ownerId);
    try {
      const r = await this.auth.request('/api/v1/office/clients?' + query);
      if (generation !== this.generation) return;
      this.rows.set(page === 1 ? r.items : [...this.rows(), ...r.items]);
      this.stats.set(r.stats ?? []);
      this.total.set(r.total);
      this.page.set(page);
    } catch (e) {
      if (generation === this.generation) this.error.set((e as Error).message);
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  start(event: DragEvent, client: any) {
    if (!this.canManage() || this.loading() || this.saving() || client.status === 'closed') {
      event.preventDefault();
      return;
    }
    this.dragging = client;
    event.dataTransfer?.setData('text/plain', client.id);
  }
  end() {
    this.dragging = null;
  }
  over(event: DragEvent, status: string) {
    if (this.dragging && status !== 'closed') event.preventDefault();
  }
  drop(event: DragEvent, status: string) {
    event.preventDefault();
    const c = this.dragging;
    this.end();
    if (c) void this.move(c, status);
  }
  async move(client: any, status: string) {
    if (
      !this.canManage() ||
      this.saving() ||
      this.loading() ||
      !status ||
      status === 'closed' ||
      client.status === 'closed' ||
      client.status === status
    )
      return;
    this.saving.set(true);
    this.error.set('');
    ++this.generation;
    try {
      await this.auth.request('/api/v1/office/clients/' + client.id + '/stage', {
        requestId: crypto.randomUUID(),
        version: client.version,
        data: { status },
      });
    } catch (e) {
      this.error.set((e as Error).message);
      this.saving.set(false);
      return;
    }
    this.saving.set(false);
    await this.load();
  }
}
