import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type ContractStatus = 'draft' | 'sent' | 'signed' | 'expiring' | 'void';
type ContractType = 'sale' | 'reservation' | 'lease' | 'listing' | 'broker_agreement';

interface Signer {
  role: string;
  roleAr: string;
  name: string;
  nameAr: string;
  signed: boolean;
}

interface DocItem {
  label: string;
  labelAr: string;
  required: boolean;
  satisfied: boolean;
}

interface Contract {
  ref: string;
  type: ContractType;
  status: ContractStatus;
  unit: string;
  contact: string;
  contactAr: string;
  value: string;
  keyDate: string;
  owner: string;
  ownerAr: string;
  signers: Signer[];
  docs: DocItem[];
}

const SEED: Contract[] = [
  {
    ref: 'MJ-0418',
    type: 'sale',
    status: 'signed',
    unit: 'HB-P2-B1-3A',
    contact: 'Rana Farouk',
    contactAr: 'رنا فاروق',
    value: 'EGP 31.5M',
    keyDate: 'Nov 3, 2026',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    signers: [
      { role: 'Buyer', roleAr: 'المشتري', name: 'Rana Farouk', nameAr: 'رنا فاروق', signed: true },
      { role: 'Seller', roleAr: 'البائع', name: 'Nile Developments', nameAr: 'نايل للتطوير', signed: true },
      { role: 'Witness', roleAr: 'الشاهد', name: 'Mona Sami', nameAr: 'منى سامي', signed: true },
    ],
    docs: [
      { label: 'National ID — buyer', labelAr: 'بطاقة الرقم القومي — المشتري', required: true, satisfied: true },
      { label: 'Proof of payment', labelAr: 'إثبات السداد', required: true, satisfied: true },
      { label: 'Power of attorney', labelAr: 'توكيل', required: false, satisfied: false },
    ],
  },
  {
    ref: 'MJ-0422',
    type: 'sale',
    status: 'sent',
    unit: 'MH-P3-401',
    contact: 'Laila Ibrahim',
    contactAr: 'ليلى إبراهيم',
    value: 'EGP 4.5M',
    keyDate: 'Nov 6, 2026',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    signers: [
      { role: 'Buyer', roleAr: 'المشتري', name: 'Laila Ibrahim', nameAr: 'ليلى إبراهيم', signed: false },
      { role: 'Seller', roleAr: 'البائع', name: 'Delta Urban', nameAr: 'دلتا للتطوير العمراني', signed: true },
    ],
    docs: [
      { label: 'National ID — buyer', labelAr: 'بطاقة الرقم القومي — المشتري', required: true, satisfied: true },
      { label: 'Proof of payment', labelAr: 'إثبات السداد', required: true, satisfied: false },
    ],
  },
  {
    ref: 'MJ-0427',
    type: 'sale',
    status: 'draft',
    unit: 'HB-P1-A2-12C',
    contact: 'Omar Zaki',
    contactAr: 'عمر ذكي',
    value: 'EGP 9.8M',
    keyDate: 'Nov 10, 2026',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    signers: [{ role: 'Buyer', roleAr: 'المشتري', name: 'Omar Zaki', nameAr: 'عمر ذكي', signed: false }],
    docs: [
      { label: 'National ID — buyer', labelAr: 'بطاقة الرقم القومي — المشتري', required: true, satisfied: false },
      { label: 'Proof of payment', labelAr: 'إثبات السداد', required: true, satisfied: false },
    ],
  },
  {
    ref: 'MJ-0355',
    type: 'lease',
    status: 'expiring',
    unit: 'RN-3301',
    contact: 'Yara Hossam',
    contactAr: 'يارا هشام',
    value: 'EGP 85,000/mo',
    keyDate: 'Nov 20, 2026',
    owner: 'Rana Farouk',
    ownerAr: 'رنا فاروق',
    signers: [
      { role: 'Tenant', roleAr: 'المستأجر', name: 'Yara Hossam', nameAr: 'يارا هشام', signed: true },
      { role: 'Landlord', roleAr: 'المالك', name: 'Mona Sami', nameAr: 'منى سامي', signed: true },
    ],
    docs: [{ label: 'Lease agreement signed copy', labelAr: 'نسخة عقد الإيجار الموقّعة', required: true, satisfied: true }],
  },
  {
    ref: 'MJ-0301',
    type: 'listing',
    status: 'signed',
    unit: 'MH-P3-401',
    contact: 'Delta Urban',
    contactAr: 'دلتا للتطوير العمراني',
    value: '—',
    keyDate: 'Jan 1, 2027',
    owner: 'Mona Sami',
    ownerAr: 'منى سامي',
    signers: [{ role: 'Developer', roleAr: 'المطوّر', name: 'Delta Urban', nameAr: 'دلتا للتطوير العمراني', signed: true }],
    docs: [{ label: 'Listing agreement', labelAr: 'اتفاقية الإدراج', required: true, satisfied: true }],
  },
  {
    ref: 'MJ-0288',
    type: 'broker_agreement',
    status: 'void',
    unit: '—',
    contact: 'Hany Fathy',
    contactAr: 'هاني فتحي',
    value: '—',
    keyDate: '—',
    owner: 'Rana Farouk',
    ownerAr: 'رنا فاروق',
    signers: [{ role: 'Client', roleAr: 'العميل', name: 'Hany Fathy', nameAr: 'هاني فتحي', signed: false }],
    docs: [],
  },
];

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
    statusNames: { draft: 'Draft', sent: 'Awaiting signature', signed: 'Signed', expiring: 'Expiring', void: 'Void' },
    typeNames: { sale: 'Sale', reservation: 'Reservation', lease: 'Lease', listing: 'Listing', broker_agreement: 'Broker agreement' },
    thContract: 'Contract',
    thUnit: 'Unit',
    thValue: 'Value',
    thDate: 'Key date',
    thStatus: 'Status',
    thAction: 'Action',
    primaryAction: { draft: 'Continue draft', sent: 'Send reminder', signed: 'View signed copy', expiring: 'Renew', void: '—' },
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
    statusNames: { draft: 'مسودة', sent: 'انتظار التوقيع', signed: 'موقّع', expiring: 'قريب الانتهاء', void: 'باطل' },
    typeNames: { sale: 'بيع', reservation: 'حجز', lease: 'إيجار', listing: 'إدراج', broker_agreement: 'اتفاقية وساطة' },
    thContract: 'العقد',
    thUnit: 'الوحدة',
    thValue: 'القيمة',
    thDate: 'التاريخ الأساسي',
    thStatus: 'الحالة',
    thAction: 'إجراء',
    primaryAction: { draft: 'استكمال المسودة', sent: 'إرسال تذكير', signed: 'عرض النسخة الموقّعة', expiring: 'تجديد', void: '—' },
    signersTitle: 'الموقّعون',
    docsTitle: 'قائمة المستندات',
    drawerClose: 'إغلاق',
    emptyTitle: 'لا توجد عقود مطابقة.',
  },
};

@Component({
  selector: 'app-contracts',
  templateUrl: './contracts.html',
  styleUrl: './contracts.scss',
})
export class Contracts {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly contracts = signal<Contract[]>(SEED);
  readonly statusFilter = signal<ContractStatus | 'all'>('all');
  readonly statuses: ContractStatus[] = ['draft', 'sent', 'signed', 'expiring', 'void'];

  readonly filtered = computed(() =>
    this.contracts().filter((c) => this.statusFilter() === 'all' || c.status === this.statusFilter()),
  );

  contact(c: Contract): string {
    return this.ar() ? c.contactAr : c.contact;
  }
  owner(c: Contract): string {
    return this.ar() ? c.ownerAr : c.owner;
  }

  readonly selected = signal<Contract | null>(null);
  open(c: Contract): void {
    this.selected.set(c);
  }
  close(): void {
    this.selected.set(null);
  }
  signerName(s: Signer): string {
    return this.ar() ? s.nameAr : s.name;
  }
  signerRole(s: Signer): string {
    return this.ar() ? s.roleAr : s.role;
  }
  docLabel(d: DocItem): string {
    return this.ar() ? d.labelAr : d.label;
  }

  toggleDoc(d: DocItem): void {
    const c = this.selected();
    if (!c) return;
    c.docs = c.docs.map((x) => (x === d ? { ...x, satisfied: !x.satisfied } : x));
    this.selected.set({ ...c });
  }
}
