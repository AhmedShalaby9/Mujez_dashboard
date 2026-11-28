import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PhoneInput } from '../../../phone-input';
import { RUNTIME_CONFIG } from '../../../runtime-config';
import { FormsModule } from '@angular/forms';
import { AuthService, officeWorkspace, type User } from '../../../auth.service';
import {
  BrokerageDealsApi,
  type Deal,
  type DealOptions,
  type DealStatus,
} from '../../../brokerage-deals-api.service';
import { DealCommissionsApi, type CommissionEntry } from '../../../deal-commissions-api.service';
import { CompanyUiState } from '../company-ui-state';

type Upload = { kind: string; fileName: string; mimeType: string; data: string };
const empty = () => ({
  leadId: '',
  agentId: '',
  clientName: '',
  clientPhone: '',
  sellingType: 'primary' as 'primary' | 'resale',
  status: 'reservation' as DealStatus,
  developerId: '',
  projectId: '',
  unitValueMinor: '',
  details: {
    unitNumber: '',
    unitType: '',
    developerSalesperson: '',
    developerSalespersonMobile: '',
    area: '',
    finishing: '',
    deliveryYears: '',
    paymentPlanYears: '',
    downPaymentPercent: '',
    expectedContractDate: '',
    reservationPrice: '',
    reservationDate: '',
    tenPercentDate: '',
    sellerOwner: '',
    nationalId: '',
    birthDate: '',
    socialStatus: '',
    jobTitle: '',
    nationality: '',
    email: '',
    livingAddress: '',
    correspondenceAddress: '',
    nationalIdAddress: '',
    comment: '',
  } as Record<string, string>,
  documents: [] as Upload[],
});
@Component({
  selector: 'app-brokerage-deals',
  imports: [FormsModule, DatePipe, RouterLink, PhoneInput],
  templateUrl: './deals.html',
  styleUrls: ['../company-ui.scss', './deals.scss'],
})
export class Deals {
  readonly config = inject(RUNTIME_CONFIG);
  readonly api = inject(BrokerageDealsApi);
  readonly commissionsApi = inject(DealCommissionsApi);
  readonly dealCommissions = signal<CommissionEntry[]>([]);
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly isBrokerage = computed(
    () =>
      (this.auth.user()?.company?.type ?? this.auth.user()?.workspace?.company?.type) ===
        'brokerage' && !officeWorkspace(this.auth.user()),
  );
  readonly isSales = computed(
    () => (this.auth.user() as (User & { scope?: string }) | null)?.scope === 'own',
  );
  rows = signal<Deal[]>([]);
  total = signal(0);
  counts = signal<Record<string, number>>({});
  options = signal<DealOptions | null>(null);
  leadOptions = signal<DealOptions['leads']>([]);
  leadSearch = '';
  leadOpen = signal(false);
  private leadSerial = 0;
  private leadTimer?: ReturnType<typeof setTimeout>;
  agentOpen = signal(false);
  agentQuery = signal('');
  readonly filteredAgents = computed(() => {
    const q = this.agentQuery().trim().toLowerCase();
    const list = this.options()?.agents ?? [];
    return q ? list.filter((a) => a.name.toLowerCase().includes(q)) : list;
  });
  selected = signal<Deal | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  view = signal<'list' | 'board'>('list');
  status = signal<string>('');
  approval = signal<string>('');
  search = '';
  page = signal(1);
  step = signal(0);
  readonly stepDefs = [
    { n: 1, en: 'Client & deal', ar: 'المشتري والصفقة' },
    { n: 2, en: 'Project & unit', ar: 'المشروع والوحدة' },
    { n: 3, en: 'Financials & reservation', ar: 'البيانات المالية والحجز' },
    { n: 4, en: 'Documents', ar: 'المستندات' },
    { n: 5, en: 'Review', ar: 'مراجعة' },
  ];
  editing = signal<string | null>(null);
  form = empty();
  rejectReason = '';
  inventoryOpen = signal<'developer' | 'project' | null>(null);
  inventoryForm = { name: '', code: '', location: '', segment: 'res', developerId: '' };
  readonly statuses: DealStatus[] = ['eoi', 'reservation', 'contracted', 'cancelled'];
  readonly kinds = ['eoi', 'reservation', 'contract', 'id_copy', 'other'];
  get detailFields() {
    return [
      ['unitNumber', 'Unit number', 'رقم الوحدة'],
      ['unitType', 'Unit type', 'نوع الوحدة'],
      ['developerSalesperson', 'Developer salesperson', 'مندوب المطوّر'],
      ['developerSalespersonMobile', 'Salesperson mobile', 'هاتف مندوب المطوّر'],
      ['area', 'Area (m²)', 'المساحة (م²)'],
      ['finishing', 'Finishing', 'التشطيب'],
      ['deliveryYears', 'Delivery in years', 'التسليم خلال سنوات'],
      ['paymentPlanYears', 'Payment plan (years)', 'خطة السداد (سنوات)'],
      ['downPaymentPercent', 'Down payment %', 'المقدم %'],
      ['reservationPrice', 'Reservation price', 'سعر الحجز'],
      ['reservationDate', 'Reservation date', 'تاريخ الحجز'],
      ['expectedContractDate', 'Expected contract date', 'تاريخ التعاقد المتوقع'],
      ['tenPercentDate', '10% date', 'تاريخ 10%'],
      ['sellerOwner', 'Seller / owner', 'البائع / المالك'],
      ...this.fields,
    ];
  }
  readonly fields: [string, string, string, string, string][] = [
    ['nationalId', 'National ID', 'الرقم القومي', '14-digit national ID', 'رقم قومي من 14 رقمًا'],
    ['birthDate', 'Birth date', 'تاريخ الميلاد', 'YYYY-MM-DD', 'سنة-شهر-يوم'],
    ['socialStatus', 'Social status', 'الحالة الاجتماعية', 'e.g. Married', 'مثال: متزوج'],
    ['jobTitle', 'Job title', 'الوظيفة', 'e.g. Engineer', 'مثال: مهندس'],
    ['nationality', 'Nationality', 'الجنسية', 'e.g. Egyptian', 'مثال: مصري'],
    ['email', 'Email', 'البريد الإلكتروني', 'name@example.com', 'name@example.com'],
    [
      'livingAddress',
      'Living address',
      'عنوان السكن',
      'Street, building, area',
      'الشارع، المبنى، المنطقة',
    ],
    [
      'correspondenceAddress',
      'Correspondence address',
      'عنوان المراسلة',
      'Street, building, area',
      'الشارع، المبنى، المنطقة',
    ],
    [
      'nationalIdAddress',
      'Address on national ID',
      'عنوان البطاقة',
      'As printed on the ID',
      'كما هو مكتوب بالبطاقة',
    ],
    ['comment', 'Comment', 'ملاحظة', 'Optional notes', 'ملاحظات اختيارية'],
  ];
  constructor() {
    if (this.isBrokerage()) void this.refreshAll();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  label(s: string) {
    const x: Record<string, [string, string]> = {
      eoi: ['EOI', 'إبداء اهتمام'],
      reservation: ['Reservation', 'حجز'],
      contracted: ['Contracted', 'تم التعاقد'],
      cancelled: ['Cancelled', 'ملغاة'],
      pending: ['Pending approval', 'بانتظار الموافقة'],
      approved: ['Approved', 'تمت الموافقة'],
      rejected: ['Rejected', 'مرفوضة'],
      primary: ['Primary', 'بيع أول'],
      resale: ['Resale', 'إعادة بيع'],
    };
    const value = x[s] ?? [s, s];
    return this.t(value[0], value[1]);
  }
  async downloadDocument(dealId: string, doc: { id: string; fileName: string }) {
    this.error.set('');
    try {
      const response = await fetch(
        this.config.apiUrl + '/api/v1/brokerage/deals/' + dealId + '/documents/' + doc.id,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error(this.t('Document download failed.', 'تعذر تنزيل المستند.'));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  count(s: DealStatus) {
    return this.counts()[s] ?? 0;
  }
  async refreshAll() {
    try {
      this.options.set(await this.api.options());
      this.leadOptions.set(this.options()?.leads ?? []);
      await this.reload();
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  async reload() {
    if (!this.isBrokerage()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const q: Record<string, string> = { page: String(this.page()), limit: '30' };
      if (this.status()) q['status'] = this.status();
      if (this.approval()) q['approval'] = this.approval();
      if (this.search.trim()) q['search'] = this.search.trim();
      const r = await this.api.list(q);
      this.rows.set(r.items);
      this.total.set(r.total);
      this.counts.set(r.summary ?? {});
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.loading.set(false);
    }
  }
  filter(status: string) {
    this.status.set(status);
    this.page.set(1);
    void this.reload();
  }
  approvalFilter(s: string) {
    this.approval.set(s);
    this.page.set(1);
    void this.reload();
  }
  availableStatuses() {
    const statuses = ['eoi', 'reservation', 'contracted'];
    return this.editing() ? [...statuses, 'cancelled'] : statuses;
  }
  projectName(id: string) {
    return this.options()?.projects.find((p) => p.id === id)?.name ?? '—';
  }
  leadName(id: string) {
    return this.leadOptions().find((p) => p.id === id)?.name ?? '—';
  }
  leadPhone(id: string) {
    return this.leadOptions().find((p) => p.id === id)?.phone ?? '';
  }
  /** unitValueMinor is EGP minor units (×100); the input shows plain EGP. */
  get unitValueEgp() {
    return this.form.unitValueMinor ? String(Number(this.form.unitValueMinor) / 100) : '';
  }
  set unitValueEgp(v: string) {
    const n = Number(v);
    this.form.unitValueMinor = v && n > 0 ? String(Math.round(n * 100)) : '';
  }
  agentName(id: string) {
    return this.options()?.agents.find((p) => p.id === id)?.name ?? '—';
  }
  projects() {
    return (this.options()?.projects ?? []).filter((p) => p.developerId === this.form.developerId);
  }
  chooseLead() {
    const l = this.leadOptions().find((x) => x.id === this.form.leadId);
    if (l && this.isSales()) this.form.agentId = this.auth.user()?.id ?? '';
  }
  readonly leadPickerEl = viewChild<ElementRef<HTMLElement>>('leadPicker');
  toggleLeadPicker() {
    this.leadOpen.update((v) => !v);
  }
  closeLeadPicker() {
    this.leadOpen.set(false);
  }
  /** No backdrop: that would block scrolling the rest of the wizard while the panel is open. */
  @HostListener('document:click', ['$event'])
  onDocumentClickForLeadPicker(e: MouseEvent) {
    if (!this.leadOpen()) return;
    const el = this.leadPickerEl()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.closeLeadPicker();
  }
  @HostListener('document:keydown.escape')
  onEscapeForLeadPicker() {
    if (this.leadOpen()) this.closeLeadPicker();
  }
  pickLead(id: string) {
    this.form.leadId = id;
    this.chooseLead();
    this.leadOpen.set(false);
  }
  readonly agentPickerEl = viewChild<ElementRef<HTMLElement>>('agentPicker');
  toggleAgentPicker() {
    if (this.isSales()) return;
    this.agentOpen.update((v) => !v);
    if (this.agentOpen()) this.agentQuery.set('');
  }
  closeAgentPicker() {
    this.agentOpen.set(false);
  }
  @HostListener('document:click', ['$event'])
  onDocumentClickForAgentPicker(e: MouseEvent) {
    if (!this.agentOpen()) return;
    const el = this.agentPickerEl()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.closeAgentPicker();
  }
  @HostListener('document:keydown.escape')
  onEscapeForAgentPicker() {
    if (this.agentOpen()) this.closeAgentPicker();
  }
  pickAgent(id: string) {
    this.form.agentId = id;
    this.agentOpen.set(false);
  }
  copyLead() {
    const l = this.leadOptions().find((x) => x.id === this.form.leadId);
    if (l) {
      this.form.clientName = l.name;
      this.form.clientPhone = l.phone;
    }
  }
  newDeal() {
    this.form = empty();
    this.leadSearch = '';
    void this.loadLeads('');
    this.selected.set(null);
    if (this.isSales()) this.form.agentId = this.auth.user()?.id ?? '';
    this.editing.set(null);
    this.step.set(1);
    this.error.set('');
  }
  closeWizard() {
    this.step.set(0);
    this.error.set('');
  }
  async open(id: string) {
    this.dealCommissions.set([]);
    try {
      this.selected.set(await this.api.detail(id));
      this.error.set('');
    } catch (e) {
      this.error.set(this.message(e));
    }
    try {
      this.dealCommissions.set((await this.commissionsApi.list({ dealId: id })).items);
    } catch {
      /* commission status is a nice-to-have on this panel; the deal itself already loaded */
    }
  }
  editDeal() {
    const d = this.selected();
    if (!d) return;
    this.leadOptions.set([
      { id: d.leadId, name: d.lead, phone: '', ownerId: d.agentId },
      ...this.leadOptions().filter((l) => l.id !== d.leadId),
    ]);
    this.form = {
      leadId: d.leadId,
      agentId: d.agentId,
      clientName: d.clientName,
      clientPhone: d.clientPhone,
      sellingType: d.sellingType,
      status: d.status,
      developerId: d.developerId,
      projectId: d.projectId,
      unitValueMinor: d.unitValueMinor ?? '',
      details: { ...empty().details, ...d.details },
      documents: [],
    };
    this.editing.set(d.id);
    this.step.set(1);
    this.error.set('');
  }
  searchLeads(value: string) {
    if (this.leadTimer) clearTimeout(this.leadTimer);
    this.leadTimer = setTimeout(() => void this.loadLeads(value), 250);
  }
  async loadLeads(value: string) {
    const serial = ++this.leadSerial;
    try {
      const rows = await this.api.leads(value);
      if (serial !== this.leadSerial) return;
      const selected = this.leadOptions().find((l) => l.id === this.form.leadId);
      this.leadOptions.set(
        selected && !rows.some((l) => l.id === selected.id) ? [selected, ...rows] : rows,
      );
    } catch (e) {
      if (serial === this.leadSerial) this.error.set(this.message(e));
    }
  }
  next() {
    this.error.set('');
    if (this.step() === 1) {
      if (
        !this.form.leadId ||
        !this.form.clientName.trim() ||
        !/^\+[1-9][0-9]{7,14}$/.test(this.form.clientPhone) ||
        !this.form.agentId
      ) {
        this.error.set(
          this.t(
            'Choose a lead and agent, then enter the buyer name and international phone number.',
            'اختر العميل المحتمل والمندوب، ثم أدخل اسم المشتري ورقم هاتفه بصيغة دولية.',
          ),
        );
        return;
      }
      if (this.form.sellingType === 'resale' && this.form.status === 'eoi')
        this.form.status = 'reservation';
    }
    if (this.step() === 2) {
      const d = this.form.details;
      if (
        !this.form.developerId ||
        !this.form.projectId ||
        !String(d['developerSalesperson'] ?? '').trim() ||
        !String(d['developerSalespersonMobile'] ?? '').trim()
      ) {
        this.error.set(
          this.t(
            'Choose a developer and project, then enter the developer salesperson details.',
            'اختر المطوّر والمشروع، ثم أدخل بيانات مندوب المطوّر.',
          ),
        );
        return;
      }
    }
    if (this.step() === 3) {
      const d = this.form.details;
      if (!this.form.unitValueMinor) {
        this.error.set(this.t('Enter the unit total sale price.', 'أدخل سعر بيع الوحدة الإجمالي.'));
        return;
      }
      const required = [
        'area',
        'finishing',
        'deliveryYears',
        'paymentPlanYears',
        'downPaymentPercent',
        'expectedContractDate',
        'reservationPrice',
        'reservationDate',
      ];
      if (
        required.some((k) => !String(d[k] ?? '').trim()) ||
        (this.form.sellingType === 'resale' && !d['sellerOwner']?.trim())
      ) {
        this.error.set(
          this.t(
            'Complete all required unit financial and reservation fields.',
            'أكمل بيانات الوحدة المالية وبيانات الحجز المطلوبة.',
          ),
        );
        return;
      }
    }
    if (
      this.step() === 4 &&
      this.form.documents.length === 0 &&
      !(this.editing() && this.selected()?.documents?.length)
    ) {
      this.error.set(this.t('Add at least one document.', 'ارفع مستندًا واحدًا على الأقل.'));
      return;
    }
    this.step.update((x) => Math.min(x + 1, 5));
  }
  back() {
    this.error.set('');
    this.step.update((x) => Math.max(1, x - 1));
  }
  /** The stepper nav only ever jumps backward; each forward step is gated by next()'s validation. */
  goToStep(n: number) {
    if (n < this.step()) {
      this.error.set('');
      this.step.set(n);
    }
  }
  async addFiles(event: Event, kind: string) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const f of files) {
      if (f.size > 5242880) {
        this.error.set(
          this.t('Each file must be 5 MB or less.', 'حجم كل ملف يجب ألا يتجاوز 5 ميجابايت.'),
        );
        continue;
      }
      if (
        ![
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png',
          'image/jpeg',
        ].includes(f.type)
      ) {
        this.error.set(
          this.t('Use PDF, Word, PNG or JPG files.', 'ارفع PDF أو Word أو PNG أو JPG.'),
        );
        continue;
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(f);
      });
      this.form.documents.push({ kind, fileName: f.name, mimeType: f.type, data });
    }
    input.value = '';
  }
  removeFile(index: number) {
    this.form.documents.splice(index, 1);
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const id = this.editing();
      const body: Record<string, unknown> = {
        ...this.form,
        details: this.form.details,
        documents: this.form.documents,
      };
      if (id) {
        body['version'] = this.selected()!.version;
      }
      const r = await this.api.save(body, id ?? undefined);
      this.closeWizard();
      await this.reload();
      await this.open(r.id);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  async decide(decision: 'approved' | 'rejected') {
    const d = this.selected();
    if (!d) return;
    this.saving.set(true);
    this.error.set('');
    try {
      if (decision === 'rejected' && !this.rejectReason.trim()) {
        this.error.set(this.t('Enter a rejection reason.', 'اكتب سبب الرفض.'));
        return;
      }
      await this.api.decide(d.id, d.version, decision, this.rejectReason);
      this.rejectReason = '';
      await this.open(d.id);
      await this.reload();
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  async createInventory() {
    this.saving.set(true);
    this.error.set('');
    try {
      if (this.inventoryOpen() === 'developer') {
        await this.api.createDeveloper(this.inventoryForm.name);
      } else {
        await this.api.createProject(this.inventoryForm);
      }
      this.options.set(await this.api.options());
      this.inventoryOpen.set(null);
      this.inventoryForm = { name: '', code: '', location: '', segment: 'res', developerId: '' };
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.saving.set(false);
    }
  }
  private message(e: unknown) {
    const x = e as any;
    return x?.error?.message ?? x?.message ?? String(e);
  }
}
