import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState } from '../admin-ui-state';
import { AuthService } from '../../../auth.service';
import {
  DemoRequestsApi,
  type DemoRequest,
  type DemoStatus,
} from '../../../demo-requests-api.service';
@Component({
  selector: 'app-demo-requests',
  imports: [FormsModule],
  templateUrl: './demo-requests.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './demo-requests.scss'],
})
export class DemoRequests {
  readonly ui = inject(AdminUiState);
  private readonly auth = inject(AuthService);
  private readonly api = inject(DemoRequestsApi);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly canManage = computed(() => this.auth.user()?.permissions.includes('co.create') ?? false);
  readonly items = signal<DemoRequest[]>([]);
  readonly summary = signal<Record<'all' | DemoStatus, number> | null>(null);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 25;
  readonly status = signal<'all' | DemoStatus>('all');
  readonly statuses = ['all', 'new', 'contacted', 'closed'] as const;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly toast = signal('');
  readonly selected = signal<DemoRequest | null>(null);
  search = '';
  private appliedSearch = '';
  private generation = 0;
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  constructor() {
    void this.load();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  statusName(status: string) {
    const names: Record<string, [string, string]> = {
      all: ['All requests', 'كل الطلبات'],
      new: ['New', 'جديد'],
      contacted: ['Contacted', 'تم التواصل'],
      closed: ['Closed', 'مغلق'],
    };
    return names[status]?.[this.ar() ? 1 : 0] ?? status;
  }
  date(value: string) {
    return new Date(value).toLocaleString(this.ar() ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  cycle(value: string) {
    return value === 'annual' ? this.t('Annual', 'سنوي') : this.t('Monthly', 'شهري');
  }
  async load() {
    const n = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.list(this.page(), this.status(), this.appliedSearch);
      if (n !== this.generation) return;
      if (
        !result.items.length &&
        result.total > 0 &&
        this.page() > Math.ceil(result.total / this.limit)
      ) {
        this.page.set(Math.ceil(result.total / this.limit));
        void this.load();
        return;
      }
      this.items.set(result.items);
      this.total.set(result.total);
      this.summary.set(result.summary);
      if (this.selected()) {
        this.selected.set(result.items.find((r) => r.id === this.selected()!.id) ?? null);
      }
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.loading.set(false);
    }
  }
  filter(value: 'all' | DemoStatus) {
    if (this.saving()) return;
    this.status.set(value);
    this.page.set(1);
    this.selected.set(null);
    void this.load();
  }
  applySearch() {
    this.appliedSearch = this.search.trim();
    this.page.set(1);
    this.selected.set(null);
    void this.load();
  }
  paginate(delta: number) {
    const next = this.page() + delta;
    if (next < 1 || next > this.pages() || this.loading()) return;
    this.page.set(next);
    this.selected.set(null);
    void this.load();
  }
  open(row: DemoRequest) {
    this.selected.set(row);
    this.error.set('');
  }
  close() {
    if (!this.saving()) this.selected.set(null);
  }
  @HostListener('document:keydown.escape') escape() {
    this.close();
  }
  async change(row: DemoRequest, status: DemoStatus) {
    if (!this.canManage() || this.saving() || row.status === status) return;
    this.saving.set(true);
    this.error.set('');
    this.toast.set('');
    try {
      await this.api.status(row, status);
      this.selected.set(null);
      await this.load();
      this.toast.set(this.t('Request status updated.', 'تم تحديث حالة الطلب.'));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
