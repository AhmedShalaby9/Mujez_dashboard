import { Component, computed, inject, signal, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { CompanyUiState } from '../company-ui-state';
type View = 'employees' | 'departments' | 'documents' | 'onboarding';
@Component({
  selector: 'app-hr',
  imports: [FormsModule, RouterLink],
  templateUrl: './hr.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './hr.scss',
  ],
})
export class Hr {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;
  readonly auth = inject(AuthService);
  readonly config = inject(RUNTIME_CONFIG);
  readonly ui = inject(CompanyUiState);
  readonly route = inject(ActivatedRoute);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly view = this.route.snapshot.data['hrView'] as View;
  readonly titles: Record<string, string[]> = {
    employees: ['Employees', 'الموظفون'],
    departments: ['Departments', 'الأقسام'],
    documents: ['Employee documents', 'مستندات الموظفين'],
    onboarding: ['Employee onboarding', 'تهيئة الموظفين'],
  };
  readonly items = signal<any[]>([]);
  readonly options = signal<any>({ employees: [], departments: [], users: [] });
  readonly summary = signal<any>({});
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly notice = signal('');
  readonly open = signal(false);
  readonly editing = signal<any>(null);
  q = '';
  status = '';
  departmentId = '';
  employeeId = '';
  archived = false;
  form: any = {};
  file: File | null = null;
  readonly employeeStatuses = ['onboarding', 'active', 'on_leave', 'offboarded'];
  readonly types = ['full_time', 'part_time', 'contract', 'intern'];
  readonly kinds = ['contract', 'identity', 'certificate', 'other'];
  readonly taskStatuses = ['open', 'done', 'cancelled'];
  constructor() {
    this.employeeId = this.route.snapshot.queryParamMap.get('employeeId') || '';
    void this.reload();
  }
  title() {
    return this.t(this.titles[this.view][0], this.titles[this.view][1]);
  }
  label(s: string) {
    const labels: Record<string, string> = {
      onboarding: 'قيد التهيئة',
      active: 'نشط',
      on_leave: 'في إجازة',
      offboarded: 'انتهت الخدمة',
      full_time: 'دوام كامل',
      part_time: 'دوام جزئي',
      contract: 'عقد',
      intern: 'متدرب',
      identity: 'هوية',
      certificate: 'شهادة',
      other: 'أخرى',
      open: 'مفتوح',
      done: 'مكتمل',
      cancelled: 'ملغي',
    };
    return this.ar()
      ? labels[s] || s
      : s.replaceAll('_', ' ').replace(/^./, (x) => x.toUpperCase());
  }
  message(e: unknown) {
    return e instanceof Error
      ? e.message
      : this.t('Could not complete the request. Please retry.', 'تعذر إتمام الطلب. أعد المحاولة.');
  }
  async reload(reset = false) {
    if (this.loading()) return;
    if (reset) this.page.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams({
        q: this.q,
        page: String(this.page()),
        limit: '25',
        archived: this.archived ? 'all' : 'false',
      });
      if (this.status) params.set('status', this.status);
      if (this.departmentId) params.set('departmentId', this.departmentId);
      if (this.employeeId) params.set('employeeId', this.employeeId);
      const [data, options, summary] = await Promise.all([
        this.auth.request('/api/v1/hr/' + this.view + '?' + params),
        this.auth.request('/api/v1/hr/options'),
        this.auth.request('/api/v1/hr/overview'),
      ]);
      this.items.set(data.items);
      this.total.set(data.total);
      this.options.set(options);
      this.summary.set(summary);
    } catch (e) {
      this.error.set(this.message(e));
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }
  async paginate(n: number) {
    this.page.update((p) => p + n);
    await this.reload();
  }
  show(row?: any) {
    this.previousFocus = document.activeElement as HTMLElement;
    this.editing.set(row || null);
    this.file = null;
    this.formError.set('');
    this.notice.set('');
    if (this.view === 'employees') {
      const {
        employeeCode = '',
        name = '',
        email = '',
        phone = '',
        jobTitle = '',
        departmentId = '',
        managerId = '',
        userId = '',
        workLocation = '',
        employmentType = 'full_time',
        status = 'onboarding',
        joiningDate = '',
        endDate = '',
        notes = '',
      } = row || {};
      this.form = {
        employeeCode,
        name,
        email: email || '',
        phone,
        jobTitle,
        departmentId: departmentId || '',
        managerId: managerId || '',
        userId: userId || '',
        workLocation,
        employmentType,
        status,
        joiningDate: joiningDate || '',
        endDate: endDate || '',
        notes,
      };
    } else if (this.view === 'departments') {
      this.form = {
        name: row?.name || '',
        description: row?.description || '',
        archived: row?.archived || false,
      };
    } else if (this.view === 'onboarding') {
      this.form = {
        employeeId: row?.employeeId || this.employeeId,
        title: row?.title || '',
        assigneeId: row?.assigneeId || '',
        dueDate: row?.dueDate || '',
        status: row?.status || 'open',
      };
    } else {
      this.form = { employeeId: this.employeeId, title: '', kind: 'contract', expiresDate: '' };
    }
    this.open.set(true);
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLInputElement>(
          '.dialog input:not([disabled]),.dialog select:not([disabled])',
        )
        ?.focus(),
    );
  }
  close() {
    if (!this.saving()) {
      this.open.set(false);
      this.previousFocus?.focus();
    }
  }
  @HostListener('document:keydown.escape') escape() {
    this.close();
  }
  @HostListener('document:keydown', ['$event']) trapFocus(event: KeyboardEvent) {
    if (!this.open() || event.key !== 'Tab') return;
    const nodes = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.dialog button:not([disabled]),.dialog input:not([disabled]),.dialog select:not([disabled]),.dialog textarea:not([disabled])',
      ),
    );
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  selectFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null;
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      let b: any = { ...this.form, requestId: crypto.randomUUID() };
      const row = this.editing();
      if (row) b.version = row.version;
      if (this.view === 'employees') {
        for (const k of ['departmentId', 'managerId', 'userId', 'joiningDate', 'endDate', 'email'])
          b[k] = b[k] || null;
      }
      if (this.view === 'onboarding') {
        b.assigneeId = b.assigneeId || null;
        b.dueDate = b.dueDate || null;
      }
      if (this.view === 'documents') {
        if (!this.file)
          throw new Error(this.t('Choose a document to upload.', 'اختر مستندًا للرفع.'));
        if (this.file.size > 5242880)
          throw new Error(this.t('File must be up to 5 MB.', 'الحد الأقصى للملف ٥ ميجابايت.'));
        const data = new FormData();
        Object.entries(b).forEach(([k, v]) => data.append(k, String(v)));
        data.append('file', this.file);
        b = data;
      }
      await this.auth.request('/api/v1/hr/' + this.view + (row ? '/' + row.id : ''), b);
      this.open.set(false);
      this.notice.set(this.t('Saved successfully', 'تم الحفظ بنجاح'));
      await this.reload();
    } catch (e) {
      this.formError.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  async archive(row: any) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/api/v1/hr/documents/' + row.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: row.version,
        archived: !row.archived,
      });
      await this.reload();
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  async download(row: any) {
    this.error.set('');
    try {
      const r = await fetch(this.config.apiUrl + '/api/v1/hr/documents/' + row.id + '/download', {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(this.t('Document download failed', 'تعذر تنزيل المستند'));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = row.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
}
