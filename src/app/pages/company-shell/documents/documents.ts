import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CompanyFinanceApi,
  type CompanyDocument,
  type CompanyContract,
} from '../../../company-finance-api.service';
type DocKind = 'national_id' | 'ownership' | 'contract' | 'receipt' | 'power_of_attorney' | 'other';
type Doc = CompanyDocument;
interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  uploadBtn: string;
  kindAll: string;
  kindNames: Record<DocKind, string>;
  thFile: string;
  thSubject: string;
  thUploaded: string;
  thExpires: string;
  noExpiry: string;
  emptyTitle: string;
  uploadTitle: string;
  kindLabel: string;
  subjectLabel: string;
  fileLabel: string;
  cancel: string;
  upload: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Finance',
    title: 'Documents',
    sub: 'Private files linked to real leads and contracts, with expiry status.',
    uploadBtn: '+ Upload',
    kindAll: 'All kinds',
    kindNames: {
      national_id: 'National ID',
      ownership: 'Ownership',
      contract: 'Contract',
      receipt: 'Receipt',
      power_of_attorney: 'Power of attorney',
      other: 'Other',
    },
    thFile: 'File',
    thSubject: 'Linked to',
    thUploaded: 'Uploaded by',
    thExpires: 'Expires',
    noExpiry: '—',
    emptyTitle: 'No documents match this filter.',
    uploadTitle: 'Upload document',
    kindLabel: 'Kind',
    subjectLabel: 'Linked to',
    fileLabel: 'File name',
    cancel: 'Cancel',
    upload: 'Upload',
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'المستندات',
    sub: 'ملفات خاصة مرتبطة بالعملاء والعقود، مع حالة انتهاء الصلاحية.',
    uploadBtn: '+ رفع ملف',
    kindAll: 'كل الأنواع',
    kindNames: {
      national_id: 'بطاقة الرقم القومي',
      ownership: 'ملكية',
      contract: 'عقد',
      receipt: 'إيصال',
      power_of_attorney: 'توكيل',
      other: 'أخرى',
    },
    thFile: 'الملف',
    thSubject: 'مرتبط بـ',
    thUploaded: 'رفعه',
    thExpires: 'ينتهي',
    noExpiry: '—',
    emptyTitle: 'لا توجد مستندات مطابقة.',
    uploadTitle: 'رفع مستند',
    kindLabel: 'النوع',
    subjectLabel: 'مرتبط بـ',
    fileLabel: 'اسم الملف',
    cancel: 'إلغاء',
    upload: 'رفع',
  },
};

@Component({
  selector: 'app-documents',
  imports: [FormsModule, RouterLink],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(CompanyFinanceApi);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('documents.manage') ?? false,
  );
  readonly canLeads = computed(() => this.auth.user()?.permissions.includes('leads.read') ?? false);
  readonly canContracts = computed(
    () => this.auth.user()?.permissions.includes('contracts.read') ?? false,
  );
  docs = signal<Doc[]>([]);
  kindFilter = signal<DocKind | 'all'>('all');
  kinds: DocKind[] = [
    'national_id',
    'ownership',
    'contract',
    'receipt',
    'power_of_attorney',
    'other',
  ];
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  total = signal(0);
  page = signal(1);
  storageBytes = signal('0');
  search = '';
  archived = false;
  contractFilter = signal('');
  uploadOpen = signal(false);
  newKind = signal<DocKind>('other');
  newSubject = signal('');
  newFile = signal<File | null>(null);
  leadId = '';
  contractId = '';
  expiresDate = '';
  leadOptions = signal<any[]>([]);
  contractOptions = signal<CompanyContract[]>([]);
  leadQuery = '';
  contractQuery = '';
  leadPage = 0;
  contractPage = 0;
  leadTotal = signal(0);
  contractTotal = signal(0);
  requestId = crypto.randomUUID();
  private serial = 0;
  private leadSerial = 0;
  private contractSerial = 0;
  private sub = this.route.queryParamMap.subscribe((p) => {
    this.contractFilter.set(p.get('contractId') ?? '');
    this.page.set(1);
    void this.reload();
    if (p.get('new') === '1' && this.canManage()) {
      this.openUpload();
      const kind = p.get('kind');
      if (kind && this.kinds.includes(kind as DocKind)) this.newKind.set(kind as DocKind);
    }
  });
  ngOnDestroy() {
    this.serial++;
    this.leadSerial++;
    this.contractSerial++;
    this.sub.unsubscribe();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  date(v: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      dateStyle: 'medium',
      ...(v.length > 10 ? { timeStyle: 'short' as const } : {}),
      timeZone: 'Africa/Cairo',
    }).format(new Date(v.length === 10 ? v + 'T12:00:00Z' : v));
  }
  subject(d: Doc) {
    return d.contractReference ?? d.lead?.[this.lang()] ?? d.title;
  }
  uploadedBy(d: Doc) {
    return d.uploadedBy?.name ?? this.t('System seed', 'بيانات أولية');
  }
  download(d: Doc) {
    return this.api.downloadUrl(d.id);
  }
  changed() {
    this.requestId = crypto.randomUUID();
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    const q: Record<string, string> = {
      q: this.search,
      page: String(this.page()),
      limit: '30',
      archived: this.archived ? 'all' : 'active',
    };
    if (this.kindFilter() !== 'all') q['kind'] = this.kindFilter();
    if (this.contractFilter()) q['contractId'] = this.contractFilter();
    try {
      const r = await this.api.get<{ items: Doc[]; total: number; storageBytes: string }>(
        'documents',
        q,
      );
      if (n !== this.serial) return;
      this.docs.set(r.items);
      this.total.set(r.total);
      this.storageBytes.set(r.storageBytes);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter(k: DocKind | 'all' = this.kindFilter()) {
    this.kindFilter.set(k);
    this.page.set(1);
    void this.reload();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  showAll() {
    void this.router.navigate(['/company/documents']);
  }
  openUpload() {
    this.changed();
    this.error.set('');
    this.uploadOpen.set(true);
    this.newKind.set('other');
    this.newSubject.set('');
    this.newFile.set(null);
    this.leadId = '';
    this.contractId = this.contractFilter();
    this.expiresDate = '';
    if (this.canLeads()) void this.loadLeads(true);
    if (this.canContracts()) void this.loadContracts(true);
  }
  closeUpload() {
    if (!this.busy()) {
      this.leadSerial++;
      this.contractSerial++;
      this.uploadOpen.set(false);
    }
  }
  fileSelected(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.changed();
    if (f && (!f.size || f.size > 5242880)) {
      this.error.set(
        this.t('Choose a non-empty file up to 5 MB.', 'اختر ملفاً غير فارغ حتى ٥ ميجابايت.'),
      );
      this.newFile.set(null);
      return;
    }
    this.newFile.set(f);
    this.error.set('');
  }
  async loadLeads(reset: boolean) {
    const n = ++this.leadSerial,
      page = reset ? 1 : this.leadPage + 1;
    try {
      const r = await this.api.get<any>('leads', {
        q: this.leadQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.leadSerial) return;
      let items = reset ? r.items : [...this.leadOptions(), ...r.items];
      if (this.leadId && !items.some((x: any) => x.id === this.leadId)) {
        const l = await this.api.get<any>('leads/' + this.leadId);
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
  async loadContracts(reset: boolean) {
    const n = ++this.contractSerial,
      page = reset ? 1 : this.contractPage + 1;
    try {
      const r = await this.api.get<any>('contracts', {
        q: this.contractQuery,
        page: String(page),
        limit: '50',
      });
      if (n !== this.contractSerial) return;
      let items = reset ? r.items : [...this.contractOptions(), ...r.items];
      if (this.contractId && !items.some((x: any) => x.id === this.contractId)) {
        const c = await this.api.get<CompanyContract>('contracts/' + this.contractId);
        if (n !== this.contractSerial) return;
        items = [c, ...items];
      }
      this.contractOptions.set(items);
      this.contractTotal.set(r.total);
      this.contractPage = page;
      if (this.contractId) this.chooseContract();
    } catch (e: any) {
      if (n === this.contractSerial) this.error.set(e.message);
    }
  }
  chooseContract() {
    const c = this.contractOptions().find((c) => c.id === this.contractId);
    if (c) this.leadId = c.leadId;
    this.changed();
  }
  async submitUpload() {
    const file = this.newFile();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const form = new FormData();
      form.set('requestId', this.requestId);
      form.set('kind', this.newKind());
      form.set('title', this.newSubject().trim());
      if (this.leadId) form.set('leadId', this.leadId);
      if (this.contractId) form.set('contractId', this.contractId);
      if (this.expiresDate) form.set('expiresDate', this.expiresDate);
      form.set('file', file);
      await this.api.upload(form);
      this.uploadOpen.set(false);
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
  async archive(d: Doc) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('documents/' + d.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: d.version,
        action: d.archivedAt ? 'restore' : 'archive',
      });
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
