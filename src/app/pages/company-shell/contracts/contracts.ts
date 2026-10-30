import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CompanyFinanceApi,
  type CompanyContract,
  type CompanyDocument,
} from '../../../company-finance-api.service';
import { majorAmount, minorAmount } from '../../../sales-api.service';
type ContractStatus = CompanyContract['status'];
type ContractType = CompanyContract['type'];
type Contract = CompanyContract;
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  statusAll: string;
  statusNames: Record<ContractStatus, string>;
  typeNames: Record<ContractType, string>;
  thContract: string;
  thUnit: string;
  thValue: string;
  thDate: string;
  thStatus: string;
  thAction: string;
  primaryAction: Record<ContractStatus, string>;
  signersTitle: string;
  docsTitle: string;
  drawerClose: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Finance',
    title: 'Contracts',
    sub: 'Draft → Awaiting signature → Signed, plus Expiring.',
    statusAll: 'All',
    statusNames: {
      draft: 'Draft',
      sent: 'Awaiting signature',
      signed: 'Signed',
      expiring: 'Expiring',
      void: 'Void',
    },
    typeNames: {
      sale: 'Sale',
      reservation: 'Reservation',
      lease: 'Lease',
      listing: 'Listing',
      broker_agreement: 'Broker agreement',
    },
    thContract: 'Contract',
    thUnit: 'Unit',
    thValue: 'Value',
    thDate: 'Key date',
    thStatus: 'Status',
    thAction: 'Action',
    primaryAction: {
      draft: 'Continue draft',
      sent: 'Send reminder',
      signed: 'View signed copy',
      expiring: 'Renew',
      void: '—',
    },
    signersTitle: 'Signers',
    docsTitle: 'Document checklist',
    drawerClose: 'Close',
    emptyTitle: 'No contracts match this filter.',
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'العقود',
    sub: 'مسودة ← انتظار التوقيع ← موقّع، بالإضافة لحالة قريبة الانتهاء.',
    statusAll: 'الكل',
    statusNames: {
      draft: 'مسودة',
      sent: 'انتظار التوقيع',
      signed: 'موقّع',
      expiring: 'قريب الانتهاء',
      void: 'باطل',
    },
    typeNames: {
      sale: 'بيع',
      reservation: 'حجز',
      lease: 'إيجار',
      listing: 'إدراج',
      broker_agreement: 'اتفاقية وساطة',
    },
    thContract: 'العقد',
    thUnit: 'الوحدة',
    thValue: 'القيمة',
    thDate: 'التاريخ الأساسي',
    thStatus: 'الحالة',
    thAction: 'إجراء',
    primaryAction: {
      draft: 'استكمال المسودة',
      sent: 'إرسال تذكير',
      signed: 'عرض النسخة الموقّعة',
      expiring: 'تجديد',
      void: '—',
    },
    signersTitle: 'الموقّعون',
    docsTitle: 'قائمة المستندات',
    drawerClose: 'إغلاق',
    emptyTitle: 'لا توجد عقود مطابقة.',
  },
};

@Component({
  selector: 'app-contracts',
  imports: [FormsModule, RouterLink],
  templateUrl: './contracts.html',
  styleUrl: './contracts.scss',
})
export class Contracts implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(CompanyFinanceApi);
  readonly route = inject(ActivatedRoute);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('contracts.manage') ?? false,
  );
  readonly canDocuments = computed(
    () => this.auth.user()?.permissions.includes('documents.read') ?? false,
  );
  readonly canUpload = computed(
    () => this.auth.user()?.permissions.includes('documents.manage') ?? false,
  );
  readonly canLeads = computed(() => this.auth.user()?.permissions.includes('leads.read') ?? false);
  readonly canUnits = computed(() => this.auth.user()?.permissions.includes('units.read') ?? false);
  readonly canReservations = computed(
    () => this.auth.user()?.permissions.includes('reservations.read') ?? false,
  );
  contracts = signal<Contract[]>([]);
  statusFilter = signal<ContractStatus | 'all'>('all');
  statuses: ContractStatus[] = ['draft', 'sent', 'signed', 'expiring', 'void'];
  types: ContractType[] = ['sale', 'reservation', 'lease', 'listing', 'broker_agreement'];
  search = '';
  typeFilter = '';
  page = signal(1);
  total = signal(0);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  selected = signal<Contract | null>(null);
  formOpen = signal(false);
  editing = signal<Contract | null>(null);
  actionOpen = signal('');
  attachTarget = signal<any>(null);
  docId = '';
  reason = '';
  sharedReference = '';
  signedDate = '';
  requestId = crypto.randomUUID();
  private pendingCreate: Record<string, unknown> | null = null;
  private serial = 0;
  private detailSerial = 0;
  private optionSerial: Record<string, number> = {};
  form: any = {
    type: 'sale',
    leadId: '',
    reservationId: '',
    unitId: '',
    title: '',
    titleAr: '',
    value: '',
    keyDate: '',
    signers: [{ name: '', nameAr: '', role: 'Client', roleAr: 'العميل' }],
    requireId: false,
    requireReceipt: false,
  };
  options = signal<Record<string, any[]>>({
    leads: [],
    units: [],
    reservations: [],
    documents: [],
  });
  queries: Record<string, string> = { leads: '', units: '', reservations: '', documents: '' };
  optionPage: Record<string, number> = { leads: 0, units: 0, reservations: 0, documents: 0 };
  optionTotal = signal<Record<string, number>>({});
  private sub = this.route.queryParamMap.subscribe((p) => {
    void this.reload();
    const id = p.get('contractId');
    if (id) void this.open(id);
  });
  ngOnDestroy() {
    this.serial++;
    this.detailSerial++;
    for (const k of Object.keys(this.optionSerial)) this.optionSerial[k]++;
    this.sub.unsubscribe();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  contact(c: Contract) {
    return c.contact[this.lang()];
  }
  owner(c: Contract) {
    return c.owner?.name ?? this.t('Unassigned', 'غير مسند');
  }
  money(v: string) {
    return this.api.money(v);
  }
  date(v: string | null) {
    if (!v) return '—';
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      dateStyle: 'medium',
      timeZone: 'Africa/Cairo',
    }).format(new Date(v.length === 10 ? v + 'T12:00:00Z' : v));
  }
  changed() {
    this.requestId = crypto.randomUUID();
    this.pendingCreate = null;
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    const q: Record<string, string> = { q: this.search, page: String(this.page()), limit: '30' };
    if (this.statusFilter() !== 'all') q['status'] = this.statusFilter();
    if (this.typeFilter) q['type'] = this.typeFilter;
    try {
      const r = await this.api.get<{ items: Contract[]; total: number }>('contracts', q);
      if (n !== this.serial) return;
      this.contracts.set(r.items);
      this.total.set(r.total);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter(s: ContractStatus | 'all' = this.statusFilter()) {
    this.statusFilter.set(s);
    this.page.set(1);
    void this.reload();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  async open(id: string) {
    const n = ++this.detailSerial;
    this.error.set('');
    try {
      const c = await this.api.get<Contract>('contracts/' + id);
      if (n === this.detailSerial) this.selected.set(c);
    } catch (e: any) {
      if (n === this.detailSerial) this.error.set(e.message);
    }
  }
  close() {
    this.detailSerial++;
    this.selected.set(null);
  }
  newContract() {
    this.editing.set(null);
    this.changed();
    this.form = {
      type: 'sale',
      leadId: '',
      reservationId: '',
      unitId: '',
      title: '',
      titleAr: '',
      value: '',
      keyDate: '',
      signers: [{ name: '', nameAr: '', role: 'Client', roleAr: 'العميل' }],
      requireId: false,
      requireReceipt: false,
    };
    this.formOpen.set(true);
    if (this.canLeads()) void this.loadOptions('leads', true);
    if (this.canUnits()) void this.loadOptions('units', true);
    if (this.canReservations()) void this.loadOptions('reservations', true);
  }
  edit(c: Contract) {
    this.editing.set(c);
    this.changed();
    this.form = {
      ...this.form,
      title: c.title.en,
      titleAr: c.title.ar,
      value: majorAmount(c.valueMinor),
      keyDate: c.keyDate,
      signers: c.signers.map((s) => ({
        name: s.name.en,
        nameAr: s.name.ar,
        role: s.role.en,
        roleAr: s.role.ar,
      })),
    };
    this.formOpen.set(true);
  }
  addSigner() {
    if (this.form.signers.length < 20) {
      this.form.signers.push({ name: '', nameAr: '', role: '', roleAr: '' });
      this.changed();
    }
  }
  removeSigner(i: number) {
    if (this.form.signers.length > 1) {
      this.form.signers.splice(i, 1);
      this.changed();
    }
  }
  async loadOptions(key: string, reset: boolean) {
    const n = (this.optionSerial[key] ?? 0) + 1;
    this.optionSerial[key] = n;
    const page = reset ? 1 : this.optionPage[key] + 1;
    const q: Record<string, string> = { q: this.queries[key], page: String(page), limit: '50' };
    if (key === 'reservations') q['status'] = 'reserved';
    if (key === 'documents') {
      const c = this.selected();
      if (!c) return;
      q['leadId'] = c.leadId;
      q['kind'] = this.attachTarget()?.kind ?? 'contract';
    }
    try {
      const r = await this.api.get<any>(key, q);
      if (n !== this.optionSerial[key]) return;
      const items =
        key === 'documents'
          ? r.items.filter(
              (d: CompanyDocument) =>
                !d.archivedAt &&
                !d.expired &&
                (!d.contractId || d.contractId === this.selected()?.id),
            )
          : r.items;
      this.options.update((o) => ({ ...o, [key]: reset ? items : [...(o[key] ?? []), ...items] }));
      this.optionTotal.update((o) => ({ ...o, [key]: r.total }));
      this.optionPage[key] = page;
    } catch (e: any) {
      if (n === this.optionSerial[key]) this.error.set(e.message);
    }
  }
  chooseReservation() {
    const r = this.options()['reservations'].find((r) => r.id === this.form.reservationId);
    if (r) {
      this.form.leadId = r.leadId;
      this.form.unitId = r.unitId;
      this.fillClient(r.contact);
    }
    this.changed();
  }
  chooseLead() {
    const l = this.options()['leads'].find((l) => l.id === this.form.leadId);
    if (l) this.fillClient(l.name);
    this.changed();
  }
  fillClient(name: any) {
    if (!this.form.signers[0].name) {
      this.form.signers[0].name = name.en;
      this.form.signers[0].nameAr = name.ar;
    }
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const f = this.form,
        c = this.editing();
      let body: Record<string, unknown> = {
        requestId: this.requestId,
        title: f.title,
        titleAr: f.titleAr || undefined,
        valueMinor: minorAmount(f.value),
        keyDate: f.keyDate,
        signers: f.signers.map((s: any) => ({
          name: s.name,
          nameAr: s.nameAr || undefined,
          role: s.role,
          roleAr: s.roleAr || undefined,
        })),
      };
      if (c) {
        body['version'] = c.version;
      } else {
        if (!this.pendingCreate) {
          body = { ...body, type: f.type, leadId: f.leadId };
          if (['sale', 'lease'].includes(f.type)) {
            const r = await this.api.get<any>('reservations/' + f.reservationId),
              u = await this.api.get<any>('units/' + r.unitId);
            body = {
              ...body,
              reservationId: r.id,
              reservationVersion: r.version,
              unitId: u.id,
              unitVersion: u.version,
            };
          } else if (f.unitId) body['unitId'] = f.unitId;
          body['requirements'] = [
            { kind: 'contract', label: 'Externally signed contract', required: true },
            ...(f.requireId
              ? [{ kind: 'national_id', label: 'Client identity evidence', required: true }]
              : []),
            ...(f.requireReceipt
              ? [{ kind: 'receipt', label: 'Payment evidence', required: true }]
              : []),
          ];
          this.pendingCreate = JSON.parse(JSON.stringify(body));
        }
        body = this.pendingCreate!;
      }
      const saved = await this.api.write<Contract>(
        'contracts' + (c ? '/' + c.id + '/update' : ''),
        body,
      );
      this.formOpen.set(false);
      await this.reload();
      await this.open(saved.id);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  openAction(action: string) {
    this.changed();
    this.actionOpen.set(action);
    this.attachTarget.set(null);
    this.reason = '';
    this.sharedReference = '';
    this.signedDate = '';
    this.docId = '';
    this.error.set('');
    if (action === 'record_signed' && this.canDocuments()) void this.loadOptions('documents', true);
  }
  attach(req: any) {
    this.openAction('attach');
    this.attachTarget.set(req);
    if (this.canDocuments()) void this.loadOptions('documents', true);
  }
  async applyAction() {
    const c = this.selected();
    if (!c || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const action = this.actionOpen();
      let path = 'contracts/' + c.id + '/action',
        b: Record<string, unknown> = {
          requestId: this.requestId,
          version: c.version,
          action,
          reason: this.reason,
        };
      if (action === 'record_shared') b['reference'] = this.sharedReference;
      if (action === 'record_signed') {
        b['signedDate'] = this.signedDate;
        b['documentId'] = this.docId;
      }
      if (action === 'attach') {
        path = 'contracts/' + c.id + '/requirements/' + this.attachTarget().id + '/attach';
        b = { requestId: this.requestId, version: c.version, documentId: this.docId };
      }
      await this.api.write(path, b);
      this.actionOpen.set('');
      await this.reload();
      await this.open(c.id);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
