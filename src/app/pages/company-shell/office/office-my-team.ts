import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import { salesMoney } from '../../../sales-api.service';
import { clientStatuses } from './office-fields';
@Component({
  selector: 'app-office-my-team',
  imports: [FormsModule, RouterLink],
  templateUrl: './office-my-team.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../team/team.scss',
    './office-my-team.scss',
  ],
})
export class OfficeMyTeam {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly performance = signal<any>(null);
  readonly tab = signal<'performance' | 'clients' | 'tasks'>('performance');
  readonly rows = signal<any[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly listLoading = signal(false);
  readonly error = signal('');
  readonly stages = clientStatuses;
  readonly money = salesMoney;
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / 25)));
  days = 30;
  memberId = '';
  q = '';
  status = '';
  private applied = { q: '', status: '', memberId: '' };
  private generation = 0;
  private reloadGeneration = 0;
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  local(v: { en: string; ar: string }) {
    return v[this.ui.lang()] || v.en;
  }
  stage(value: string) {
    const x = this.stages.find((s) => s[0] === value);
    return x ? this.t(x[1], x[2]) : value;
  }
  taskStatus(value: string) {
    return value === 'open'
      ? this.t('Open', 'مفتوحة')
      : value === 'done'
        ? this.t('Done', 'مكتملة')
        : this.t('Cancelled', 'ملغاة');
  }
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
      this.reloadGeneration++;
    });
    void this.reload();
  }
  private clearOnDenied(e: any) {
    if ([401, 403, 404].includes(e.status)) {
      this.generation++;
      this.listLoading.set(false);
      this.performance.set(null);
      this.rows.set([]);
      this.total.set(0);
    }
  }
  async reload() {
    const g = ++this.reloadGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await this.auth.request('/api/v1/office/my-team/performance?days=' + this.days);
      if (g !== this.reloadGeneration) return;
      this.performance.set(p);
      if (this.memberId && !p.items.some((m: any) => m.id === this.memberId)) {
        this.memberId = '';
        this.applied.memberId = '';
      }
      if (this.tab() !== 'performance') await this.load();
    } catch (e) {
      if (g === this.reloadGeneration) {
        this.clearOnDenied(e);
        this.error.set((e as Error).message);
      }
    } finally {
      if (g === this.reloadGeneration) this.loading.set(false);
    }
  }
  changeTab(tab: 'performance' | 'clients' | 'tasks') {
    this.generation++;
    this.listLoading.set(false);
    this.tab.set(tab);
    this.status = '';
    this.applied.status = '';
    this.rows.set([]);
    this.total.set(0);
    this.page.set(1);
    this.error.set('');
    if (tab !== 'performance') void this.load();
  }
  apply() {
    this.applied = { q: this.q.trim(), status: this.status, memberId: this.memberId };
    void this.load();
  }
  async load(page = 1) {
    if (this.tab() === 'performance') return;
    const g = ++this.generation;
    this.listLoading.set(true);
    this.error.set('');
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    for (const [key, value] of Object.entries(this.applied)) if (value) query.set(key, value);
    try {
      const r = await this.auth.request('/api/v1/office/my-team/' + this.tab() + '?' + query);
      if (g !== this.generation) return;
      this.rows.set(r.items);
      this.total.set(r.total);
      this.page.set(page);
    } catch (e) {
      if (g === this.generation) {
        this.clearOnDenied(e);
        this.error.set((e as Error).message);
      }
    } finally {
      if (g === this.generation) this.listLoading.set(false);
    }
  }
}
