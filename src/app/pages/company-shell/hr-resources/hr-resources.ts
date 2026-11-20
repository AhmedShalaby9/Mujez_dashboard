import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompactAmountDirective } from '../../../compact-amount.directive';
import { compactMoney, parseCompactAmount } from '../../../compact-numbers';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-hr-resources',
  imports: [FormsModule, CompactAmountDirective],
  templateUrl: './hr-resources.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../hr/hr.scss',
    '../attendance/attendance.scss',
    './hr-resources.scss',
  ],
})
export class HrResources {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly route = inject(ActivatedRoute);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly mode = this.route.snapshot.data['resourcesView'] as
    'my-assets' | 'assets' | 'my-advances' | 'advances';
  readonly isAsset = this.mode.includes('assets');
  readonly mine = this.mode.startsWith('my-');
  readonly base = '/api/v1/hr-resources/';
  readonly context = signal<any>(null);
  readonly data = signal<any>({ items: [], total: 0, summary: {}, stats: [] });
  readonly options = signal<any>({ employees: [] });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly formError = signal('');
  readonly page = signal(1);
  readonly dialog = signal<'' | 'asset' | 'request' | 'detail' | 'action'>('');
  readonly selected = signal<any>(null);
  form: any = {};
  action = '';
  search = '';
  status = 'all';
  private serial = 0;
  private previousFocus: HTMLElement | null = null;
  readonly title = computed(() =>
    this.isAsset
      ? this.mine
        ? this.t('My assets', 'عُهدي')
        : this.t('Company assets', 'عُهد الشركة')
      : this.mine
        ? this.t('My salary advances', 'سُلَفي')
        : this.t('Salary advances', 'سُلَف الموظفين'),
  );
  readonly kinds = [
    ['sim_card', 'SIM card', 'شريحة اتصال'],
    ['laptop', 'Laptop', 'حاسوب محمول'],
    ['phone', 'Phone', 'هاتف'],
    ['tablet', 'Tablet', 'جهاز لوحي'],
  ];
  money = compactMoney;
  readonly unreversed = (p: any) => !p.reversed_at;
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  label(v: string) {
    const map: Record<string, string[]> = {
      available: ['Available', 'متاح'],
      assigned: ['Assigned', 'مُسلّم'],
      repair: ['Under repair', 'قيد الصيانة'],
      retired: ['Retired', 'خارج الخدمة'],
      pending: ['Pending review', 'بانتظار المراجعة'],
      approved: ['Awaiting payout', 'بانتظار الصرف'],
      rejected: ['Rejected', 'مرفوض'],
      cancelled: ['Cancelled', 'ملغي'],
      active: ['Repaying', 'قيد السداد'],
      paid: ['Paid in full', 'مسدد بالكامل'],
      assign: ['Assign asset', 'تسليم عهدة'],
      return: ['Return asset', 'استرداد عهدة'],
      acknowledge: ['Acknowledge receipt', 'تأكيد الاستلام'],
      approve: ['Approve request', 'قبول الطلب'],
      reject: ['Reject request', 'رفض الطلب'],
      cancel: ['Cancel request', 'إلغاء الطلب'],
      payout: ['Record payout', 'تسجيل صرف السلفة'],
      repay: ['Record repayment', 'تسجيل سداد'],
      reverse: ['Reverse repayment', 'عكس تسجيل السداد'],
    };
    const a = map[v] ?? [v, v];
    return this.t(a[0], a[1]);
  }
  kind(v: string) {
    const a = this.kinds.find((x) => x[0] === v);
    return a ? this.t(a[1], a[2]) : v;
  }
  constructor() {
    void this.reload();
  }
  async reload(reset = false) {
    const n = ++this.serial;
    if (reset) this.page.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      const ctx = await this.auth.request(this.base + 'context');
      if (n !== this.serial) return;
      this.context.set(ctx);
      const q = new URLSearchParams({
        view: this.mine ? 'my' : 'company',
        page: String(this.page()),
        limit: '25',
        search: this.search,
        status: this.status,
      });
      const [data, options] = await Promise.all([
        this.auth.request(this.base + (this.isAsset ? 'assets' : 'advances') + '?' + q),
        !this.mine && this.isAsset && ctx.canManageAssets
          ? this.auth.request(this.base + 'options')
          : Promise.resolve({ employees: [] }),
      ]);
      if (n !== this.serial) return;
      this.data.set(data);
      this.options.set(options);
    } catch (e) {
      if (n === this.serial) {
        this.error.set((e as Error).message);
        this.data.set({ items: [], total: 0, summary: {}, stats: [] });
        this.context.set(null);
        this.options.set({ employees: [] });
      }
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  count(status: string) {
    return this.data().stats.find((x: any) => x.status === status)?.count ?? 0;
  }
  async paginate(d: number) {
    this.page.update((n) => n + d);
    await this.reload();
  }
  private open(kind: 'asset' | 'request' | 'detail' | 'action') {
    this.previousFocus = document.activeElement as HTMLElement;
    this.formError.set('');
    this.dialog.set(kind);
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.dialog input,.dialog select,.dialog textarea,.dialog button')
        ?.focus(),
    );
  }
  editAsset(row?: any) {
    this.selected.set(row ?? null);
    this.form = {
      kind: row?.kind ?? 'laptop',
      name: row?.name ?? '',
      details: {
        brand: '',
        model: '',
        serial: '',
        imei: '',
        phoneNumber: '',
        iccid: '',
        carrier: '',
        plan: '',
        purchaseDate: null,
        warrantyUntil: null,
        notes: '',
        ...row?.details,
      },
      status: row?.status ?? 'available',
    };
    this.open('asset');
  }
  request() {
    this.selected.set(null);
    const d = new Date(this.context().today + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    this.form = {
      amount: '',
      mode: 'monthly',
      installments: 3,
      firstDue: d.toISOString().slice(0, 10),
      reason: '',
    };
    this.open('request');
  }
  async details(row: any) {
    this.error.set('');
    try {
      const r = await this.auth.request(
        this.base + (this.isAsset ? 'assets/' : 'advances/') + row.id,
      );
      this.selected.set(r);
      this.open('detail');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  startAction(action: string) {
    this.action = action;
    this.form = {
      date: this.context().today,
      employeeId: '',
      condition: '',
      amount: '',
      note: '',
      reference: '',
      paymentId: '',
    };
    this.formError.set('');
    this.dialog.set('action');
    setTimeout(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.dialog input,.dialog select,.dialog textarea')
        ?.focus(),
    );
  }
  close() {
    if (this.saving()) return;
    this.dialog.set('');
    this.selected.set(null);
    this.previousFocus?.focus();
  }
  @HostListener('document:keydown.escape') escape() {
    this.close();
  }
  @HostListener('document:keydown', ['$event']) trap(e: KeyboardEvent) {
    if (!this.dialog() || e.key !== 'Tab') return;
    const nodes = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.dialog button:not([disabled]),.dialog input:not([disabled]),.dialog select:not([disabled]),.dialog textarea:not([disabled])',
      ),
    ];
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (!first || !last) return;
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
      const f = this.form,
        r = this.selected();
      if (this.dialog() === 'asset') {
        path = 'assets' + (r ? '/' + r.id : '');
        body = {
          ...body,
          kind: f.kind,
          name: f.name,
          details: {
            ...f.details,
            purchaseDate: f.details.purchaseDate || null,
            warrantyUntil: f.details.warrantyUntil || null,
          },
          ...(r ? { version: r.version } : {}),
          ...(f.status !== 'assigned' ? { status: f.status } : {}),
        };
      } else if (this.dialog() === 'request') {
        path = 'advances';
        body = {
          ...body,
          amountMinor: parseCompactAmount(f.amount),
          mode: f.mode,
          installments: f.mode === 'lump_sum' ? 1 : Number(f.installments),
          firstDue: f.firstDue,
          reason: f.reason,
        };
      } else {
        path = (this.isAsset ? 'assets/' : 'advances/') + r.id + '/action';
        body = { ...body, version: r.version, action: this.action };
        if (this.isAsset) {
          if (this.action !== 'acknowledge') {
            body.date = f.date;
            body.condition = f.condition;
          }
          if (this.action === 'assign') body.employeeId = f.employeeId;
        } else {
          body.note = f.note;
          if (['repay', 'payout'].includes(this.action)) {
            body.date = f.date;
            body.reference = f.reference;
          }
          if (this.action === 'repay') body.amountMinor = parseCompactAmount(f.amount);
          if (this.action === 'reverse') body.paymentId = f.paymentId;
        }
      }
      await this.auth.request(this.base + path, body);
      this.dialog.set('');
      this.selected.set(null);
      this.previousFocus?.focus();
      this.notice.set(this.t('Saved successfully', 'تم الحفظ بنجاح'));
      await this.reload();
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
