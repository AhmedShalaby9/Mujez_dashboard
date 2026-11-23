import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth.service';
import { AdminUiState } from '../admin-ui-state';
interface City {
  id: string;
  nameEn: string;
  nameAr: string;
  archived: boolean;
  version: number;
}
@Component({
  selector: 'app-cities',
  imports: [FormsModule],
  templateUrl: './cities.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './cities.scss'],
})
export class Cities {
  readonly ui = inject(AdminUiState);
  private readonly auth = inject(AuthService);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly canManage = computed(() => this.auth.user()?.permissions.includes('co.create') ?? false);
  readonly rows = signal<City[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly open = signal(false);
  readonly selected = signal<City | null>(null);
  search = '';
  archived = 'false';
  nameEn = '';
  nameAr = '';
  private generation = 0;
  constructor() {
    void this.load();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  async load() {
    const g = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams({ q: this.search.trim(), archived: this.archived });
      const r = await this.auth.request('/admin/api/v1/cities?' + q);
      if (g === this.generation) this.rows.set(r.items);
    } catch (e) {
      if (g === this.generation) this.error.set((e as Error).message);
    } finally {
      if (g === this.generation) this.loading.set(false);
    }
  }
  edit(row: City | null = null) {
    this.selected.set(row);
    this.nameEn = row?.nameEn ?? '';
    this.nameAr = row?.nameAr ?? '';
    this.error.set('');
    this.open.set(true);
  }
  @HostListener('document:keydown.escape') close() {
    if (!this.saving()) this.open.set(false);
  }
  async save() {
    if (this.saving() || !this.canManage()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const row = this.selected();
      await this.auth.request('/admin/api/v1/cities' + (row ? '/' + row.id : ''), {
        nameEn: this.nameEn.trim(),
        nameAr: this.nameAr.trim(),
        ...(row ? { version: row.version } : {}),
      });
      this.open.set(false);
      await this.load();
      this.notice.set(this.t('City saved.', 'تم حفظ المدينة.'));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async archive(row: City) {
    if (this.saving() || !this.canManage()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/admin/api/v1/cities/' + row.id + '/archive', {
        version: row.version,
        archived: !row.archived,
      });
      await this.load();
      this.notice.set(
        this.t(
          row.archived
            ? 'City restored.'
            : 'City removed from new selections. Existing properties are retained.',
          row.archived
            ? 'تمت استعادة المدينة.'
            : 'حُذفت المدينة من الاختيارات الجديدة مع الاحتفاظ بالعقارات الحالية.',
        ),
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
