import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type DocKind = 'national_id' | 'ownership' | 'contract' | 'receipt' | 'power_of_attorney' | 'other';

interface Doc {
  id: string;
  kind: DocKind;
  file: string;
  subject: string;
  subjectAr: string;
  uploadedBy: string;
  uploadedByAr: string;
  at: string;
  expires: string | null;
  expiringSoon: boolean;
}

const SEED: Doc[] = [
  { id: 'd1', kind: 'national_id', file: 'id_rana_farouk.pdf', subject: 'Rana Farouk — MJ-0418', subjectAr: 'رنا فاروق — MJ-0418', uploadedBy: 'Dina El Sayed', uploadedByAr: 'دينا السيد', at: '2 days ago', expires: null, expiringSoon: false },
  { id: 'd2', kind: 'contract', file: 'MJ-0418_signed.pdf', subject: 'Villa HB-P2-B1-3A', subjectAr: 'فيلا HB-P2-B1-3A', uploadedBy: 'Dina El Sayed', uploadedByAr: 'دينا السيد', at: '2 days ago', expires: null, expiringSoon: false },
  { id: 'd3', kind: 'receipt', file: 'deposit_receipt_500k.pdf', subject: 'MJ-0418 deposit', subjectAr: 'عربون MJ-0418', uploadedBy: 'Mona Sami', uploadedByAr: 'منى سامي', at: '2 days ago', expires: null, expiringSoon: false },
  { id: 'd4', kind: 'ownership', file: 'title_deed_HB-P2-B1-3A.pdf', subject: 'Villa HB-P2-B1-3A', subjectAr: 'فيلا HB-P2-B1-3A', uploadedBy: 'Khaled Nabil', uploadedByAr: 'خالد نبيل', at: '1 week ago', expires: null, expiringSoon: false },
  { id: 'd5', kind: 'power_of_attorney', file: 'poa_omar_zaki.pdf', subject: 'Omar Zaki — MJ-0427', subjectAr: 'عمر ذكي — MJ-0427', uploadedBy: 'Khaled Nabil', uploadedByAr: 'خالد نبيل', at: '3 weeks ago', expires: 'Nov 5, 2026', expiringSoon: true },
  { id: 'd6', kind: 'national_id', file: 'id_laila_ibrahim.pdf', subject: 'Laila Ibrahim — MJ-0422', subjectAr: 'ليلى إبراهيم — MJ-0422', uploadedBy: 'Youssef Mansour', uploadedByAr: 'يوسف منصور', at: '5 days ago', expires: 'Feb 2027', expiringSoon: false },
  { id: 'd7', kind: 'other', file: 'floorplan_RN-3301.pdf', subject: 'Rental RN-3301', subjectAr: 'إيجار RN-3301', uploadedBy: 'Rana Farouk', uploadedByAr: 'رنا فاروق', at: '1 month ago', expires: null, expiringSoon: false },
];

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
    sub: 'Uploaded files linked to customers and deals, with expiry reminders.',
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
    sub: 'الملفات المرتبطة بالعملاء والصفقات، مع تذكيرات انتهاء الصلاحية.',
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
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly docs = signal<Doc[]>(SEED);
  readonly kindFilter = signal<DocKind | 'all'>('all');
  readonly kinds: DocKind[] = ['national_id', 'ownership', 'contract', 'receipt', 'power_of_attorney', 'other'];

  readonly filtered = computed(() =>
    this.docs().filter((d) => this.kindFilter() === 'all' || d.kind === this.kindFilter()),
  );

  subject(d: Doc): string {
    return this.ar() ? d.subjectAr : d.subject;
  }
  uploadedBy(d: Doc): string {
    return this.ar() ? d.uploadedByAr : d.uploadedBy;
  }

  readonly uploadOpen = signal(false);
  readonly newKind = signal<DocKind>('other');
  readonly newSubject = signal('');
  readonly newFile = signal('');

  openUpload(): void {
    this.uploadOpen.set(true);
    this.newKind.set('other');
    this.newSubject.set('');
    this.newFile.set('');
  }
  closeUpload(): void {
    this.uploadOpen.set(false);
  }
  submitUpload(): void {
    if (!this.newFile().trim()) return;
    this.docs.update((list) => [
      {
        id: 'd' + (list.length + 1),
        kind: this.newKind(),
        file: this.newFile(),
        subject: this.newSubject() || '—',
        subjectAr: this.newSubject() || '—',
        uploadedBy: 'Mona Sami',
        uploadedByAr: 'منى سامي',
        at: 'just now',
        expires: null,
        expiringSoon: false,
      },
      ...list,
    ]);
    this.uploadOpen.set(false);
  }
}
