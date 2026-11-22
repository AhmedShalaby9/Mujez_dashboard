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
  readonly summary = signal<any>({});
  readonly options = signal<any>({ scope: 'own', canAssign: false });
  readonly detail = signal<any>(null);
  readonly selected = signal<string[]>([]);
  readonly historyLoading = signal(false);
  callback = 'all';
  view = 'all';
  outcomeFilter = '';
  filterOwner = '';
  activityMode: 'call' | 'note' | 'follow_up' = 'call';
  callOutcome = 'no_answer';
  notes = '';
  followUpAt = '';
  historyPage = 1;
  assignOwner = '';
  assignOpen = false;
  private activityRequest = '';
  private assignmentRequest = '';
  private detailSerial = 0;
  readonly outcomes: { key: string; en: string; ar: string }[] = [
    { key: 'no_answer', en: 'No answer', ar: 'لا يرد' },
    { key: 'busy', en: 'Busy', ar: 'مشغول' },
    { key: 'wrong_number', en: 'Wrong number', ar: 'رقم غير صحيح' },
    { key: 'not_interested', en: 'Not interested', ar: 'غير مهتم' },
    { key: 'interested', en: 'Interested', ar: 'مهتم' },
    { key: 'callback', en: 'Callback requested', ar: 'طلب إعادة الاتصال' },
  ];
  outcomeLabel(key: string | null) {
    const v = this.outcomes.find((x) => x.key === key);
    return v ? this.t(v.en, v.ar) : this.t('Not called', 'لم يتم الاتصال');
  }
  activityLabel(kind: string) {
    return (
      {
        call: this.t('Call', 'مكالمة'),
        note: this.t('Note', 'ملاحظة'),
        follow_up: this.t('Callback updated', 'تعديل المتابعة'),
        assigned: this.t('Assignment', 'إسناد'),
        converted: this.t('Converted to lead', 'تحويل إلى عميل'),
      }[kind] ?? kind
    );
  }
  date(value: string | null) {
    return value
      ? new Intl.DateTimeFormat(this.ui.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
          timeZone: 'Africa/Cairo',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : '—';
  }
  localDate(value: string | null) {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const get = (k: string) => parts.find((p) => p.type === k)?.value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  }
  async loadOptions() {
    try {
      const r = await this.auth.request('/api/v1/cold-calls/options');
      this.options.set(r);
      this.owners.set(r.owners ?? []);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  setCallback(value: string) {
    this.callback = value;
    this.status = 'open';
    this.apply();
  }
  toggleSelected(id: string, checked: boolean) {
    this.selected.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
    );
  }
  selectPage(checked: boolean) {
    this.selected.set(
      checked
        ? this.rows()
            .filter((r) => !r.leadId)
            .map((r) => r.id)
        : [],
    );
  }
  openAssignment(row?: any) {
    if (row) this.selected.set([row.id]);
    this.assignOwner = '';
    this.assignmentRequest = crypto.randomUUID();
    this.assignOpen = true;
  }
  async assign() {
    if (!this.assignOwner || !this.selected().length || this.saving()) return;
    const items = this.rows()
      .filter((r) => this.selected().includes(r.id))
      .map((r) => ({ id: r.id, version: r.version }));
    if (!items.length) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/api/v1/cold-calls/assign', {
        requestId: this.assignmentRequest,
        items,
        ownerId: this.assignOwner,
      });
      this.assignOpen = false;
      this.notice.set(
        this.t(
          'Assignment saved. Callback dates and call history are preserved.',
          'تم الإسناد مع الاحتفاظ بمواعيد المتابعة وسجل المكالمات.',
        ),
      );
      this.leadId.set('');
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async openDetail(row: any, mode: 'call' | 'note' | 'follow_up' = 'call') {
    const n = ++this.detailSerial;
    this.historyLoading.set(true);
    this.error.set('');
    this.historyPage = 1;
    try {
      const r = await this.auth.request('/api/v1/cold-calls/' + row.id + '/history?page=1');
      if (n === this.detailSerial) {
        this.detail.set(r);
        this.setActivityMode(r.item.leadId ? 'note' : mode);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      if (n === this.detailSerial) this.historyLoading.set(false);
    }
  }
  closeDetail() {
    if (this.saving()) return;
    this.detailSerial++;
    this.detail.set(null);
  }
  setActivityMode(mode: 'call' | 'note' | 'follow_up') {
    this.activityMode = mode;
    this.callOutcome = 'no_answer';
    this.notes = '';
    this.followUpAt = mode === 'follow_up' ? this.localDate(this.detail()?.item.followUpAt) : '';
    this.activityRequest = crypto.randomUUID();
  }
  outcomeChanged() {
    if (['wrong_number', 'not_interested'].includes(this.callOutcome)) this.followUpAt = '';
  }
  async saveActivity(cancelCallback = false) {
    const d = this.detail();
    if (!d || this.saving()) return;
    if (this.activityMode === 'call' && this.callOutcome === 'callback' && !this.followUpAt) {
      this.error.set(this.t('Choose a callback date and time.', 'اختر موعد إعادة الاتصال.'));
      return;
    }
    if (this.activityMode === 'note' && !this.notes.trim()) return;
    if (this.activityMode === 'follow_up' && !cancelCallback && !this.followUpAt) return;
    this.saving.set(true);
    this.error.set('');
    const kind = this.activityMode;
    const b: any = { requestId: this.activityRequest, version: d.item.version };
    if (kind === 'call')
      Object.assign(b, {
        outcome: this.callOutcome,
        notes: this.notes.trim(),
        followUpAt: this.followUpAt || null,
      });
    else if (kind === 'note') b.notes = this.notes.trim();
    else
      Object.assign(b, {
        followUpAt: cancelCallback ? null : this.followUpAt,
        notes: this.notes.trim(),
      });
    try {
      await this.auth.request(
        '/api/v1/cold-calls/' +
          d.item.id +
          '/' +
          { call: 'calls', note: 'notes', follow_up: 'follow-up' }[kind],
        b,
      );
      this.detail.set(
        await this.auth.request('/api/v1/cold-calls/' + d.item.id + '/history?page=1'),
      );
      this.historyPage = 1;
      this.setActivityMode(d.item.leadId ? 'note' : kind);
      this.notice.set(this.t('Call activity saved.', 'تم حفظ المتابعة.'));
      this.leadId.set('');
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async historyPageChange(delta: number) {
    const d = this.detail();
    if (!d || this.historyLoading()) return;
    this.historyLoading.set(true);
    try {
      const page = this.historyPage + delta;
      this.detail.set(
        await this.auth.request('/api/v1/cold-calls/' + d.item.id + '/history?page=' + page),
      );
      this.historyPage = page;
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.historyLoading.set(false);
    }
  }
  search = '';
  status = 'open';
  ownerId = '';
  file: File | null = null;
  want = '';
  segment = 'res';
  private requestId = '';
  private convertId = '';
  private serial = 0;
  constructor() {
    void this.load();
    void this.loadOptions();
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
        callback: this.callback,
        view: this.view,
        ...(this.outcomeFilter ? { outcome: this.outcomeFilter } : {}),
        ...(this.filterOwner ? { ownerId: this.filterOwner } : {}),
      });
      const r = await this.auth.request('/api/v1/cold-calls?' + p);
      if (n === this.serial) {
        this.rows.set(r.items);
        this.summary.set(r.summary ?? {});
        this.selected.set([]);
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
      await this.loadOptions();
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
