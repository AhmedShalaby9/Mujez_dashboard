import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import { ReservationsApi, type CompanyReservation } from '../../../reservations-api.service';
import { InventoryApi, type InventoryUnit } from '../../../inventory-api.service';
import { minorAmount } from '../../../sales-api.service';
type ResStatus = CompanyReservation['status'];
type Reservation = CompanyReservation;
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  statusAll: string;
  statusNames: Record<ResStatus, string>;
  thUnit: string;
  thContact: string;
  thAgent: string;
  thExpiry: string;
  thStatus: string;
  thActions: string;
  confirmBtn: string;
  extendBtn: string;
  cancelBtn: string;
  confirmTitle: string;
  depositLabel: string;
  extendTitle: string;
  durations: string[];
  reasonLabel: string;
  reasonPh: string;
  cancelTitle: string;
  cancelReasonPh: string;
  cancel: string;
  apply: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Inventory',
    title: 'Reservations',
    sub: 'Active holds and reservations with expiry; extend, convert or release units.',
    statusAll: 'All',
    statusNames: {
      hold: 'Hold',
      reserved: 'Reserved',
      converted: 'Converted',
      expired: 'Expired',
      canceled: 'Canceled',
    },
    thUnit: 'Unit',
    thContact: 'Contact',
    thAgent: 'Agent',
    thExpiry: 'Expires in',
    thStatus: 'Status',
    thActions: 'Actions',
    confirmBtn: 'Confirm',
    extendBtn: 'Extend',
    cancelBtn: 'Cancel',
    confirmTitle: 'Confirm reservation',
    depositLabel: 'Deposit amount (EGP)',
    extendTitle: 'Extend hold (audited)',
    durations: ['24h', '48h', '72h'],
    reasonLabel: 'Reason',
    reasonPh: 'e.g. client traveling, awaiting bank approval',
    cancelTitle: 'Cancel reservation',
    cancelReasonPh: 'e.g. client withdrew, unit sold elsewhere',
    cancel: 'Dismiss',
    apply: 'Apply',
    emptyTitle: 'No reservations match this filter.',
  },
  ar: {
    eyebrow: 'المخزون',
    title: 'الحجوزات',
    sub: 'الحجوزات النشطة ومواعيد انتهائها؛ تمديد أو تحويل أو تحرير الوحدات.',
    statusAll: 'الكل',
    statusNames: {
      hold: 'معلّق',
      reserved: 'محجوز',
      converted: 'مكتمل',
      expired: 'منتهي',
      canceled: 'ملغى',
    },
    thUnit: 'الوحدة',
    thContact: 'العميل',
    thAgent: 'الوكيل',
    thExpiry: 'ينتهي بعد',
    thStatus: 'الحالة',
    thActions: 'إجراءات',
    confirmBtn: 'تأكيد',
    extendBtn: 'تمديد',
    cancelBtn: 'إلغاء',
    confirmTitle: 'تأكيد الحجز',
    depositLabel: 'مبلغ العربون (جنيه)',
    extendTitle: 'تمديد التعليق (مُدقّق)',
    durations: ['24 س', '48 س', '72 س'],
    reasonLabel: 'السبب',
    reasonPh: 'مثال: العميل مسافر، في انتظار موافقة البنك',
    cancelTitle: 'إلغاء الحجز',
    cancelReasonPh: 'مثال: انسحب العميل، بيعت الوحدة لجهة أخرى',
    cancel: 'إغلاق',
    apply: 'تطبيق',
    emptyTitle: 'لا توجد حجوزات مطابقة.',
  },
};

@Component({
  selector: 'app-reservations',
  imports: [FormsModule, RouterLink],
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss',
})
export class Reservations implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(ReservationsApi);
  readonly inventory = inject(InventoryApi);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('reservations.manage') ?? false,
  );
  readonly canCreate = computed(
    () =>
      this.canManage() &&
      this.auth.user()?.permissions.includes('leads.read') &&
      this.auth.user()?.permissions.includes('units.read'),
  );
  reservations = signal<Reservation[]>([]);
  statusFilter = signal<ResStatus | 'all'>('all');
  statuses: ResStatus[] = ['hold', 'reserved', 'converted', 'expired', 'canceled'];
  page = signal(1);
  total = signal(0);
  search = '';
  unitFilter = signal('');
  asOf = signal('');
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  confirmTarget = signal<Reservation | null>(null);
  extendTarget = signal<Reservation | null>(null);
  cancelTarget = signal<Reservation | null>(null);
  depositInput = signal('');
  extendDuration = signal(48);
  extendReason = signal('');
  cancelReason = signal('');
  createOpen = signal(false);
  unitOptions = signal<InventoryUnit[]>([]);
  leadOptions = signal<any[]>([]);
  assignees = signal<any[]>([]);
  unitTotal = signal(0);
  leadTotal = signal(0);
  unitQuery = '';
  leadQuery = '';
  unitPage = 0;
  leadPage = 0;
  form = { unitId: '', leadId: '', assigneeId: '', hours: 48 };
  private serial = 0;
  private unitSerial = 0;
  private leadSerial = 0;
  private createSerial = 0;
  private pendingHold: Record<string, unknown> | null = null;
  requestId = crypto.randomUUID();
  private sub = this.route.queryParamMap.subscribe((params) => {
    this.unitFilter.set(params.get('unitId') ?? '');
    this.page.set(1);
    void this.reload();
    if (params.get('new') === '1' && this.canCreate()) void this.newHold();
  });
  ngOnDestroy() {
    this.serial++;
    this.unitSerial++;
    this.leadSerial++;
    this.createSerial++;
    this.sub.unsubscribe();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  contact(r: Reservation) {
    return r.contact[this.lang()];
  }
  agent(r: Reservation) {
    return r.assignee?.name ?? this.t('Unassigned', 'غير مسند');
  }
  money(v: string | null) {
    return this.inventory.money(v);
  }
  date(v: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Cairo',
    }).format(new Date(v));
  }
  expiry(r: Reservation) {
    if (!['hold', 'reserved'].includes(r.status)) return '—';
    const min = Math.max(0, Math.ceil((Date.parse(r.expiresAt) - Date.parse(r.asOf)) / 60000));
    return min < 60
      ? min + ' ' + this.t('min', 'دقيقة')
      : Math.ceil(min / 60) + ' ' + this.t('hours', 'ساعة');
  }
  changed() {
    this.pendingHold = null;
    this.requestId = crypto.randomUUID();
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    const q: Record<string, string> = { page: String(this.page()), limit: '30', q: this.search };
    if (this.statusFilter() !== 'all') q['status'] = this.statusFilter();
    if (this.unitFilter()) q['unitId'] = this.unitFilter();
    try {
      const r = await this.api.list(q);
      if (n !== this.serial) return;
      this.reservations.set(r.items);
      this.total.set(r.total);
      this.asOf.set(r.asOf);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter(s: ResStatus | 'all' = this.statusFilter()) {
    this.statusFilter.set(s);
    this.page.set(1);
    void this.reload();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  showAll() {
    void this.router.navigate(['/company/reservations']);
  }
  async newHold() {
    if (!this.canCreate()) return;
    const n = ++this.createSerial;
    this.changed();
    this.createOpen.set(true);
    this.error.set('');
    this.form = {
      unitId: this.unitFilter(),
      leadId: '',
      assigneeId: this.auth.user()?.id ?? '',
      hours: 48,
    };
    try {
      await Promise.all([this.loadUnits(true), this.loadLeads(true)]);
      const opts = await this.inventory.get<any>('leads/options');
      if (n !== this.createSerial) return;
      this.assignees.set(opts.owners);
    } catch (e: any) {
      if (n === this.createSerial) this.error.set(e.message);
    }
  }
  async loadUnits(reset: boolean) {
    const n = ++this.unitSerial,
      page = reset ? 1 : this.unitPage + 1;
    try {
      const r = await this.inventory.get<{ items: InventoryUnit[]; total: number }>('units', {
        status: 'available',
        q: this.unitQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.unitSerial) return;
      let items = reset ? r.items : [...this.unitOptions(), ...r.items];
      if (reset && this.form.unitId && !items.some((u) => u.id === this.form.unitId)) {
        const u = await this.inventory.get<InventoryUnit>('units/' + this.form.unitId);
        if (n !== this.unitSerial) return;
        items = [u, ...items];
      }
      this.unitOptions.set(items);
      this.unitTotal.set(r.total);
      this.unitPage = page;
    } catch (e: any) {
      if (n === this.unitSerial) this.error.set(e.message);
    }
  }
  async loadLeads(reset: boolean) {
    const n = ++this.leadSerial,
      page = reset ? 1 : this.leadPage + 1;
    try {
      const r = await this.inventory.get<any>('leads', {
        q: this.leadQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.leadSerial) return;
      let items = reset ? r.items : [...this.leadOptions(), ...r.items];
      if (reset && this.form.leadId && !items.some((l: any) => l.id === this.form.leadId)) {
        const l = await this.inventory.get<any>('leads/' + this.form.leadId);
        if (n !== this.leadSerial) return;
        items = [l, ...items];
      }
      this.leadOptions.set(items);
      this.leadTotal.set(r.total);
      this.leadPage = page;
    } catch (e: any) {
      if (n === this.leadSerial) this.error.set(e.message);
    }
  }
  async create() {
    if (this.busy() || !this.canCreate()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (!this.pendingHold) {
        const u = await this.inventory.get<InventoryUnit>('units/' + this.form.unitId);
        if (u.status !== 'available' || u.archivedAt)
          throw Error(
            this.t(
              'Unit is not available. Refresh the options.',
              'الوحدة غير متاحة. حدّث الخيارات.',
            ),
          );
        this.pendingHold = {
          requestId: this.requestId,
          unitId: u.id,
          unitVersion: u.version,
          leadId: this.form.leadId,
          assigneeId: this.form.assigneeId || null,
          hours: Number(this.form.hours),
        };
      }
      await this.api.write('reservations', this.pendingHold);
      this.createOpen.set(false);
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  openConfirm(r: Reservation) {
    this.closeAll();
    this.confirmTarget.set(r);
    this.depositInput.set('');
    this.changed();
  }
  openExtend(r: Reservation) {
    this.closeAll();
    this.extendTarget.set(r);
    this.extendDuration.set(48);
    this.extendReason.set('');
    this.changed();
  }
  openCancel(r: Reservation) {
    this.closeAll();
    this.cancelTarget.set(r);
    this.cancelReason.set('');
    this.changed();
  }
  closeAll() {
    if (this.busy()) return;
    this.createSerial++;
    this.unitSerial++;
    this.leadSerial++;
    this.createOpen.set(false);
    this.confirmTarget.set(null);
    this.extendTarget.set(null);
    this.cancelTarget.set(null);
  }
  async mutate(r: Reservation, action: string, extra: Record<string, unknown>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('reservations/' + r.id + '/action', {
        requestId: this.requestId,
        version: r.version,
        action,
        ...extra,
      });
      this.confirmTarget.set(null);
      this.extendTarget.set(null);
      this.cancelTarget.set(null);
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  applyConfirm() {
    const r = this.confirmTarget();
    if (!r) return;
    try {
      void this.mutate(r, 'confirm', { depositMinor: minorAmount(this.depositInput()) });
    } catch (e: any) {
      this.error.set(e.message);
    }
  }
  applyExtend() {
    const r = this.extendTarget();
    if (r)
      void this.mutate(r, 'extend', {
        hours: this.extendDuration(),
        reason: this.extendReason().trim(),
      });
  }
  applyCancel() {
    const r = this.cancelTarget();
    if (r) void this.mutate(r, 'cancel', { reason: this.cancelReason().trim() });
  }
}
