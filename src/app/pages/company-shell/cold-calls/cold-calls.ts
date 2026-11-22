import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-cold-calls',
  imports: [FormsModule, RouterLink],
  templateUrl: './cold-calls.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './cold-calls.scss',
  ],
})
export class ColdCalls {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly config = inject(RUNTIME_CONFIG);
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('leads.manage') ?? false,
  );
  readonly rows = signal<any[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly leadId = signal('');
  readonly uploading = signal(false);
  readonly preview = signal<any>(null);
  readonly result = signal<any>(null);
  readonly owners = signal<any[]>([]);
  readonly converting = signal<any>(null);
  search = '';
  status = 'pending';
  ownerId = '';
  file: File | null = null;
  want = '';
  segment = 'res';
  private requestId = '';
  private convertId = '';
  private serial = 0;
  constructor() {
    void this.load();
  }
  async load() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const p = new URLSearchParams({
        page: String(this.page()),
        limit: '50',
        status: this.status,
        q: this.search,
      });
      const r = await this.auth.request('/api/v1/cold-calls?' + p);
      if (n === this.serial) {
        this.rows.set(r.items);
        this.total.set(r.total);
      }
    } catch (e) {
      if (n === this.serial) this.error.set((e as Error).message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  async openImport() {
    this.uploading.set(true);
    this.preview.set(null);
    this.result.set(null);
    this.file = null;
    this.ownerId = '';
    try {
      this.owners.set((await this.auth.request('/api/v1/leads/options')).owners ?? []);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  fileChanged(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.preview.set(null);
    this.result.set(null);
    this.requestId = crypto.randomUUID();
  }
  ownerChanged() {
    this.preview.set(null);
    this.requestId = crypto.randomUUID();
  }
  async upload(commit = false) {
    if (this.saving() || !this.file) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const b = new FormData();
      b.append('file', this.file);
      if (this.ownerId) b.append('ownerId', this.ownerId);
      if (commit) b.append('requestId', (this.requestId ||= crypto.randomUUID()));
      const r = await this.auth.request('/api/v1/cold-calls/' + (commit ? 'import' : 'preview'), b);
      if (commit) {
        this.result.set(r);
        this.preview.set(null);
        this.file = null;
        this.page.set(1);
        await this.load();
      } else this.preview.set(r);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async template() {
    this.error.set('');
    try {
      const r = await fetch(this.config.apiUrl + '/api/v1/cold-calls/template', {
        credentials: 'include',
      });
      if (!r.ok) throw Error(this.t('Unable to download template', 'تعذر تحميل القالب'));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cold-calls-template.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  startConvert(row: any) {
    this.converting.set(row);
    this.want = '';
    this.segment = 'res';
    this.convertId = crypto.randomUUID();
    this.error.set('');
  }
  async convert() {
    const row = this.converting();
    if (!row || this.saving() || !this.want.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const r = await this.auth.request('/api/v1/cold-calls/' + row.id + '/convert', {
        requestId: this.convertId,
        version: row.version,
        want: this.want.trim(),
        segment: this.segment,
      });
      this.leadId.set(r.leadId);
      this.notice.set(
        this.t(
          'Converted to a lead. It is now available in Leads and the pipeline.',
          'تم التحويل إلى عميل محتمل وأصبح متاحًا في العملاء والـPipeline.',
        ),
      );
      this.converting.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  apply() {
    this.page.set(1);
    void this.load();
  }
  next(delta: number) {
    this.page.update((p) => p + delta);
    void this.load();
  }
}
