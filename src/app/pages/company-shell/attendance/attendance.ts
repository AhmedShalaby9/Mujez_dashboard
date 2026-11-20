import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-attendance',
  imports: [FormsModule, RouterLink],
  templateUrl: './attendance.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../hr/hr.scss',
    './attendance.scss',
  ],
})
export class Attendance {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly mode = this.route.snapshot.data['attendanceView'] as
    'my' | 'team' | 'company' | 'schedules';
  readonly context = signal<any>(null);
  readonly report = signal<any>({ items: [], monthly: [], summary: {}, total: 0 });
  readonly corrections = signal<any>({ items: [], total: 0 });
  readonly schedules = signal<any[]>([]);
  readonly options = signal<any>({ employees: [], departments: [] });
  readonly assignments = signal<any>({ items: [], total: 0 });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dialog = signal<'' | 'schedule' | 'assign' | 'correction' | 'review'>('');
  readonly formError = signal('');
  readonly activeTab = signal<'records' | 'corrections'>('records');
  readonly page = signal(1);
  readonly correctionPage = signal(1);
  readonly assignmentPage = signal(1);
  period: 'daily' | 'monthly' = 'daily';
  date = '';
  month = '';
  employeeId = '';
  departmentId = '';
  correctionStatus = 'pending';
  form: any = {};
  editing: any = null;
  reviewing: any = null;
  private previousFocus: HTMLElement | null = null;
  private serial = 0;
  readonly scope = computed(() =>
    this.mode === 'team' ? 'team' : this.mode === 'company' ? 'company' : 'my',
  );
  readonly title = computed(() =>
    this.mode === 'schedules'
      ? this.t('Work schedules', 'جداول العمل')
      : this.mode === 'team'
        ? this.t('Team attendance', 'حضور الفريق')
        : this.mode === 'company'
          ? this.t('Attendance overview', 'متابعة الحضور')
          : this.t('My attendance', 'حضوري'),
  );
  readonly days = [
    ['Sunday', 'الأحد'],
    ['Monday', 'الإثنين'],
    ['Tuesday', 'الثلاثاء'],
    ['Wednesday', 'الأربعاء'],
    ['Thursday', 'الخميس'],
    ['Friday', 'الجمعة'],
    ['Saturday', 'السبت'],
  ];
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  constructor() {
    void this.reload();
  }
  private query() {
    let from = this.date,
      to = this.date;
    if (this.period === 'monthly') {
      from = this.month + '-01';
      const [y, m] = this.month.split('-').map(Number);
      to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    }
    return new URLSearchParams({
      view: this.scope(),
      from,
      to,
      page: String(this.page()),
      limit: '50',
      ...(this.employeeId ? { employeeId: this.employeeId } : {}),
      ...(this.departmentId ? { departmentId: this.departmentId } : {}),
    });
  }
  async reload(reset = false) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    if (reset) {
      this.page.set(1);
      this.correctionPage.set(1);
      this.assignmentPage.set(1);
    }
    try {
      const context = await this.auth.request('/api/v1/attendance/context');
      if (serial !== this.serial) return;
      this.context.set(context);
      this.date ||= context.today;
      this.month ||= context.today.slice(0, 7);
      if (this.mode === 'schedules') {
        const [s, o, a] = await Promise.all([
          this.auth.request('/api/v1/attendance/schedules'),
          this.auth.request('/api/v1/attendance/options'),
          this.auth.request(
            '/api/v1/attendance/assignments?page=' + this.assignmentPage() + '&limit=25',
          ),
        ]);
        if (serial !== this.serial) return;
        this.schedules.set(s.items);
        this.options.set(o);
        this.assignments.set(a);
      } else {
        if (this.mode === 'company')
          this.options.set(await this.auth.request('/api/v1/attendance/options'));
        const [r, c] = await Promise.all([
          this.auth.request('/api/v1/attendance/report?' + this.query()),
          this.auth.request(
            '/api/v1/attendance/corrections?' +
              new URLSearchParams({
                view: this.scope(),
                status: this.correctionStatus,
                page: String(this.correctionPage()),
                limit: '25',
              }),
          ),
        ]);
        if (serial !== this.serial) return;
        this.report.set(r);
        this.corrections.set(c);
      }
    } catch (e) {
      if (serial === this.serial) {
        this.error.set((e as Error).message);
        this.report.set({ items: [], monthly: [], summary: {}, total: 0 });
        this.corrections.set({ items: [], total: 0 });
        this.schedules.set([]);
        this.assignments.set({ items: [], total: 0 });
      }
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  async punch(action: 'in' | 'out') {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/api/v1/attendance/punch', {
        requestId: crypto.randomUUID(),
        action,
      });
      this.notice.set(
        action === 'in'
          ? this.t('Checked in successfully', 'تم تسجيل الحضور')
          : this.t('Checked out successfully', 'تم تسجيل الانصراف'),
      );
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  time(x: string | null) {
    return x
      ? new Intl.DateTimeFormat(this.ui.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: 'short',
        }).format(new Date(x))
      : this.t('Not set', 'غير محدد');
  }
  hours(n: number) {
    n = Number(n) || 0;
    return Math.floor(n / 60) + this.t('h ', 'س ') + (n % 60) + this.t('m', 'د');
  }
  label(key: string) {
    const labels: Record<string, [string, string]> = {
      present: ['Present', 'حاضر'],
      late: ['Late', 'متأخر'],
      absent: ['Absent', 'غائب'],
      on_leave: ['On leave', 'في إجازة'],
      public_holiday: ['Public holiday', 'عطلة رسمية'],
      weekend: ['Day off', 'يوم راحة'],
      scheduled: ['Scheduled', 'مجدول'],
      not_scheduled: ['No schedule', 'بدون جدول'],
      calendar_unavailable: ['Calendar unavailable', 'التقويم غير متاح'],
      partial_leave: ['Half-day leave', 'إجازة نصف يوم'],
      holiday: ['Public holiday', 'عطلة رسمية'],
      leave: ['On leave', 'في إجازة'],
      pending: ['Pending review', 'بانتظار المراجعة'],
      approved: ['Approved', 'مقبول'],
      rejected: ['Rejected', 'مرفوض'],
      cancelled: ['Cancelled', 'ملغي'],
    };
    return labels[key] ? this.t(...labels[key]) : key;
  }
  clockTime(n: number) {
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  }
  dayNames(days: number[]) {
    return days.map((d) => this.t(...(this.days[d] as [string, string]))).join(' · ');
  }
  private open(kind: 'schedule' | 'assign' | 'correction' | 'review') {
    this.previousFocus = document.activeElement as HTMLElement;
    this.formError.set('');
    this.dialog.set(kind);
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(
          '.dialog input:not([disabled]),.dialog select,.dialog textarea,.dialog button',
        )
        ?.focus(),
    );
  }
  editSchedule(row?: any) {
    this.editing = row ?? null;
    this.form = {
      name: row?.name ?? '',
      workdays: [...(row?.workdays ?? [])],
      start: this.clockTime(row?.startMinute ?? 540),
      end: this.clockTime(row?.endMinute ?? 1020),
      graceMinutes: row?.graceMinutes ?? 0,
      archived: row?.archived ?? false,
    };
    this.open('schedule');
  }
  assign() {
    this.form = {
      scheduleId: '',
      target: 'employee',
      targetId: '',
      effectiveFrom: this.context()?.today,
    };
    this.open('assign');
  }
  private localInput(value: string | null) {
    if (!value) return '';
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(value))
        .map((p) => [p.type, p.value]),
    );
    return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}`;
  }
  correct(row?: any) {
    this.form = {
      workDate: row?.date ?? this.context()?.today,
      checkIn: this.localInput(row?.checkIn),
      checkOut: this.localInput(row?.checkOut),
      reason: '',
    };
    this.open('correction');
  }
  review(row: any, action: 'approve' | 'reject' | 'cancel') {
    this.reviewing = row;
    this.form = { action, note: '' };
    this.open('review');
  }
  toggleDay(day: number, checked: boolean) {
    this.form.workdays = checked
      ? [...this.form.workdays, day]
      : this.form.workdays.filter((d: number) => d !== day);
  }
  close() {
    if (this.saving()) return;
    this.dialog.set('');
    this.previousFocus?.focus();
  }
  @HostListener('document:keydown.escape') escape() {
    this.close();
  }
  @HostListener('document:keydown', ['$event']) focusTrap(e: KeyboardEvent) {
    if (!this.dialog() || e.key !== 'Tab') return;
    const nodes = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.dialog button:not([disabled]),.dialog input:not([disabled]),.dialog select:not([disabled]),.dialog textarea:not([disabled])',
      ),
    ];
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      let path = '',
        body: any = { requestId: crypto.randomUUID() };
      const f = this.form;
      if (this.dialog() === 'schedule') {
        if (!f.workdays.length)
          throw new Error(
            this.t('Choose at least one working day', 'اختر يوم عمل واحدًا على الأقل'),
          );
        const minutes = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
        path = '/schedules' + (this.editing ? '/' + this.editing.id : '');
        body = {
          ...body,
          name: f.name,
          workdays: f.workdays,
          startMinute: minutes(f.start),
          endMinute: minutes(f.end),
          graceMinutes: Number(f.graceMinutes),
          archived: f.archived,
          ...(this.editing ? { version: this.editing.version } : {}),
        };
      }
      if (this.dialog() === 'assign') {
        path = '/assignments';
        body = {
          ...body,
          scheduleId: f.scheduleId,
          scheduleVersion: this.schedules().find((s) => s.id === f.scheduleId)?.version,
          target: f.target,
          ...(f.target !== 'all' ? { targetId: f.targetId } : {}),
          effectiveFrom: f.effectiveFrom,
        };
      }
      if (this.dialog() === 'correction') {
        path = '/corrections';
        body = {
          ...body,
          workDate: f.workDate,
          checkIn: f.checkIn,
          checkOut: f.checkOut || null,
          reason: f.reason,
        };
      }
      if (this.dialog() === 'review') {
        path = '/corrections/' + this.reviewing.id + '/action';
        body = { ...body, version: this.reviewing.version, action: f.action, note: f.note };
      }
      await this.auth.request('/api/v1/attendance' + path, body);
      this.dialog.set('');
      this.previousFocus?.focus();
      this.notice.set(this.t('Saved successfully', 'تم الحفظ بنجاح'));
      await this.reload();
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async paginate(kind: 'records' | 'corrections' | 'assignments', delta: number) {
    const page =
      kind === 'records'
        ? this.page
        : kind === 'corrections'
          ? this.correctionPage
          : this.assignmentPage;
    page.update((n) => n + delta);
    await this.reload();
  }
  exportMonthly() {
    const esc = (x: any) => {
      let s = String(x ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const rows = [
      [
        'Employee',
        'Code',
        'Present',
        'Late',
        'Absent',
        'Leave days',
        'Worked minutes',
        'Late minutes',
        'Missing check-out',
      ],
      ...this.report().monthly.map((r: any) => [
        r.employee,
        r.employeeCode,
        r.present + r.late,
        r.late,
        r.absent,
        r.leaveDays,
        r.workedMinutes,
        r.lateMinutes,
        r.missingCheckout,
      ]),
    ];
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-' + this.month + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
