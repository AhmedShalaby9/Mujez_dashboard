import { Component, inject, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-leave',
  imports: [FormsModule],
  templateUrl: './leave.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../hr/hr.scss',
    './leave.scss',
  ],
})
export class Leave {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly config = inject(RUNTIME_CONFIG);
  readonly mode = inject(ActivatedRoute).snapshot.data['leaveView'] as
    'my' | 'approvals' | 'manage';
  readonly context = signal<any>(null);
  readonly policy = signal<any>(null);
  readonly balance = signal<any>(null);
  readonly targets = signal<any[]>([]);
  readonly rows = signal<any[]>([]);
  readonly calendar = signal<any[]>([]);
  readonly balanceRows = signal<any[]>([]);
  readonly calendarTruncated = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly tab = signal<'requests' | 'balances' | 'calendar' | 'policy'>('requests');
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly formError = signal('');
  readonly modal = signal<'request' | 'action' | 'balance' | 'attachment' | 'history' | null>(null);
  readonly history = signal<any[]>([]);
  private initialized = false;
  year = new Date().getFullYear();
  month = new Date().toISOString().slice(0, 7);
  status = '';
  employeeFilter = '';
  form: any = {};
  policyForm: any = {};
  file: File | null = null;
  selected: any = null;
  created: any = null;
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  readonly statuses = [
    'pending_manager',
    'pending_hr',
    'approved',
    'rejected',
    'cancelled',
    'cancellation_pending',
  ];
  readonly weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  readonly weekdaysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  readonly actionLabels: Record<string, [string, string]> = {
    manager_approve: ['Recommend approval', 'توصية بالموافقة'],
    hr_approve: ['Approve leave', 'اعتماد الإجازة'],
    reject: ['Reject', 'رفض'],
    cancel: ['Cancel leave', 'إلغاء الإجازة'],
    request_cancel: ['Request cancellation', 'طلب الإلغاء'],
    approve_cancel: ['Approve cancellation', 'اعتماد الإلغاء'],
    deny_cancel: ['Keep approved leave', 'رفض الإلغاء'],
  };
  constructor() {
    void this.reload();
  }
  title() {
    return this.mode === 'my'
      ? this.t('My leave', 'إجازاتي')
      : this.mode === 'approvals'
        ? this.t('Leave approvals', 'مراجعة الإجازات')
        : this.t('Leave management', 'إدارة الإجازات');
  }
  label(status: string) {
    const names: Record<string, [string, string]> = {
      pending_manager: ['Manager review', 'مراجعة المدير'],
      pending_hr: ['HR approval', 'اعتماد الموارد البشرية'],
      approved: ['Approved', 'معتمد'],
      rejected: ['Rejected', 'مرفوض'],
      cancelled: ['Cancelled', 'ملغي'],
      cancellation_pending: ['Cancellation pending', 'إلغاء قيد المراجعة'],
    };
    const n = names[status];
    return n ? this.t(...n) : status;
  }
  message(e: unknown) {
    return e instanceof Error
      ? e.message
      : this.t('The request could not be completed.', 'تعذر إتمام الطلب.');
  }
  async reload(reset = false) {
    if (this.busy()) return;
    if (reset) this.page.set(1);
    this.busy.set(true);
    this.error.set('');
    try {
      const [ctx, policy, options] = await Promise.all([
        this.auth.request('/api/v1/leave/context'),
        this.auth.request(
          '/api/v1/leave/policy?year=' +
            (this.tab() === 'calendar' ? this.month.slice(0, 4) : this.year),
        ),
        this.auth.request('/api/v1/leave/options'),
      ]);
      if (!this.initialized) {
        this.year = Number(ctx.today.slice(0, 4));
        this.month = ctx.today.slice(0, 7);
        this.initialized = true;
      }
      this.context.set(ctx);
      this.policy.set(policy);
      this.targets.set(options.employees);
      this.policyForm = {
        version: policy.version,
        annualDays: policy.annualDays,
        weekends: [...policy.weekends],
        carryLimitDays: policy.carryLimitDays,
        carryExpiry: policy.carryExpiry,
      };
      const q = new URLSearchParams({
        view: this.mode,
        year: String(this.year),
        page: String(this.page()),
        limit: '25',
      });
      if (this.status) q.set('status', this.status);
      if (this.employeeFilter) q.set('employeeId', this.employeeFilter);
      if (this.tab() === 'requests') {
        const data = await this.auth.request('/api/v1/leave/requests?' + q);
        this.rows.set(data.items);
        this.total.set(data.total);
      }
      if (this.mode === 'my' && ctx.self && ctx.hasSelfRole)
        this.balance.set(await this.auth.request('/api/v1/leave/balance?year=' + this.year));
      if (this.tab() === 'balances' && ctx.isHr) {
        const data = await this.auth.request('/api/v1/leave/balances?' + q);
        this.balanceRows.set(data.items);
        this.total.set(data.total);
      }
      if (this.tab() === 'calendar') {
        const data = await this.auth.request(
          '/api/v1/leave/calendar?view=' +
            this.mode +
            '&month=' +
            this.month +
            (this.employeeFilter ? '&employeeId=' + encodeURIComponent(this.employeeFilter) : ''),
        );
        this.calendar.set(data.items);
        this.calendarTruncated.set(!!data.truncated);
      }
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async switchTab(tab: 'requests' | 'balances' | 'calendar' | 'policy') {
    this.tab.set(tab);
    this.page.set(1);
    await this.reload();
  }
  async next(delta: number) {
    this.page.update((p) => p + delta);
    await this.reload();
  }
  readonly requestHolidays = signal<any>(null);
  async loadRequestHolidays() {
    this.requestHolidays.set(null);
    if (!this.form.startDate) return;
    try {
      this.requestHolidays.set(
        await this.auth.request('/api/v1/leave/policy?year=' + this.form.startDate.slice(0, 4)),
      );
    } catch (e) {
      this.formError.set(this.message(e));
    }
  }
  previewDays() {
    if (
      !this.form.startDate ||
      !this.form.endDate ||
      !this.requestHolidays()?.available ||
      this.requestHolidays()?.year !== Number(this.form.startDate.slice(0, 4))
    )
      return 0;
    let count = 0,
      iterations = 0;
    const holidays = new Set(this.requestHolidays().holidays.map((h: any) => h.date));
    for (
      let x = Date.parse(this.form.startDate + 'T00:00:00Z'),
        end = Date.parse(this.form.endDate + 'T00:00:00Z');
      x <= end && iterations++ < 367;
      x += 86400000
    ) {
      const d = new Date(x);
      if (
        !this.policy().weekends.includes(d.getUTCDay()) &&
        !holidays.has(d.toISOString().slice(0, 10))
      )
        count += this.form.half ? 0.5 : 1;
    }
    return count;
  }
  calendarWeeks() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.month)) return [];
    const [y, m] = this.month.split('-').map(Number),
      first = new Date(Date.UTC(y, m - 1, 1)),
      offset = first.getUTCDay(),
      length = new Date(Date.UTC(y, m, 0)).getUTCDate(),
      cells: any[] = [];
    for (let i = 0; i < 42; i++) {
      const day = i - offset + 1;
      if (day < 1 || day > length) {
        cells.push(null);
        continue;
      }
      const date = this.month + '-' + String(day).padStart(2, '0'),
        weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      cells.push({
        day,
        date,
        weekend: this.policy()?.weekends.includes(weekday),
        holiday: this.policy()?.holidays.find((h: any) => h.date === date)?.name,
        items: this.calendar().filter((r) => r.startDate <= date && r.endDate >= date),
      });
    }
    return Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }
  openRequest() {
    this.requestHolidays.set(null);
    this.form = {
      employeeId: this.mode === 'my' ? this.context()?.self?.id || '' : '',
      startDate: '',
      endDate: '',
      half: '',
      reason: '',
    };
    this.file = null;
    this.created = null;
    this.formError.set('');
    this.modal.set('request');
  }
  openAction(row: any, action: string) {
    this.created = null;
    this.file = null;
    this.selected = row;
    this.form = { action, note: '' };
    this.formError.set('');
    this.modal.set('action');
  }
  openBalance(row: any) {
    this.created = null;
    this.file = null;
    this.selected = row;
    this.form = { annualDays: row.annualDays, carryDays: row.carryDays, reason: '' };
    this.formError.set('');
    this.modal.set('balance');
  }
  openAttachment(row: any) {
    this.created = null;
    this.selected = row;
    this.file = null;
    this.formError.set('');
    this.modal.set('attachment');
  }
  async openHistory(row: any) {
    this.created = null;
    this.formError.set('');
    this.error.set('');
    try {
      const data = await this.auth.request('/api/v1/leave/requests/' + row.id + '/history');
      this.history.set(data.items);
      this.modal.set('history');
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  @HostListener('document:keydown.escape') close() {
    if (!this.saving()) {
      const saved = this.modal() === 'request' && this.created;
      this.modal.set(null);
      if (saved) {
        this.notice.set(
          this.t(
            'Leave request saved. You can add the attachment later.',
            'تم حفظ طلب الإجازة. يمكنك إضافة المرفق لاحقًا.',
          ),
        );
        void this.reload();
      }
    }
  }
  selectFile(e: Event) {
    this.file = (e.target as HTMLInputElement).files?.[0] || null;
  }
  actions(row: any) {
    return Object.keys(row.actions).filter((k) => row.actions[k]);
  }
  canAttach(row: any) {
    return (
      !row.hasAttachment &&
      ['pending_manager', 'pending_hr'].includes(row.status) &&
      (this.context()?.isHr ||
        (this.context()?.hasSelfRole && row.employeeId === this.context()?.self?.id))
    );
  }
  needsReason() {
    return (
      (this.form.action === 'hr_approve' && this.selected?.status === 'pending_manager') ||
      ['reject', 'cancel', 'approve_cancel', 'deny_cancel'].includes(this.form.action)
    );
  }
  async upload(row: any) {
    if (!this.file) return;
    const b = new FormData();
    b.append('requestId', crypto.randomUUID());
    b.append('version', String(row.version));
    b.append('file', this.file);
    return this.auth.request('/api/v1/leave/requests/' + row.id + '/attachment', b);
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      if (this.file && this.file.size > 5242880)
        throw new Error(this.t('Choose a file up to 5 MB.', 'اختر ملفًا حتى ٥ ميجابايت.'));
      const requestId = crypto.randomUUID();
      if (this.modal() === 'request') {
        if (!this.created)
          this.created = await this.auth.request('/api/v1/leave/requests', {
            requestId,
            ...this.form,
            half: this.form.half || null,
          });
        this.year = this.created.year;
        if (this.file) await this.upload(this.created);
      } else if (this.modal() === 'action')
        await this.auth.request('/api/v1/leave/requests/' + this.selected.id + '/action', {
          requestId,
          version: this.selected.version,
          ...this.form,
        });
      else if (this.modal() === 'balance')
        await this.auth.request('/api/v1/leave/balances', {
          requestId,
          employeeId: this.selected.employeeId,
          year: this.year,
          version: this.selected.version,
          ...this.form,
        });
      else if (this.modal() === 'attachment') {
        if (!this.file) throw new Error(this.t('Choose an attachment.', 'اختر مرفقًا.'));
        await this.upload(this.selected);
      }
      this.modal.set(null);
      this.notice.set(this.t('Saved successfully', 'تم الحفظ بنجاح'));
      await this.reload();
    } catch (e) {
      this.formError.set(
        (this.created
          ? this.t('Request saved; attachment was not saved. ', 'تم حفظ الطلب؛ لم يُحفظ المرفق. ')
          : '') + this.message(e),
      );
    } finally {
      this.saving.set(false);
    }
  }
  toggleWeekend(day: number, checked: boolean) {
    this.policyForm.weekends = checked
      ? [...new Set([...this.policyForm.weekends, day])]
      : this.policyForm.weekends.filter((d: number) => d !== day);
  }
  async savePolicy() {
    if (this.saving() || !this.context()?.canFinalize) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/api/v1/leave/policy', {
        requestId: crypto.randomUUID(),
        ...this.policyForm,
      });
      this.notice.set(
        this.t(
          'Leave policy saved. Existing initialized balances are adjusted separately.',
          'تم حفظ السياسة. تُعدّل الأرصدة الحالية بشكل منفصل.',
        ),
      );
      await this.reload();
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  async download(row: any) {
    try {
      const r = await fetch(
        this.config.apiUrl + '/api/v1/leave/requests/' + row.id + '/attachment',
        { credentials: 'include' },
      );
      if (!r.ok) throw new Error(this.t('Attachment download failed', 'تعذر تنزيل المرفق'));
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = 'leave-attachment';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
}
