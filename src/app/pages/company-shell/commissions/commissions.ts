import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type CommStatus = 'calculated' | 'approved' | 'payable' | 'paid';

interface Line {
  who: string;
  whoAr: string;
  pct: number;
  amount: number;
}

interface Commission {
  deal: string;
  unit: string;
  contact: string;
  contactAr: string;
  gross: number;
  rate: number;
  status: CommStatus;
  lines: Line[];
}

function pesos(n: number): string {
  return 'EGP ' + Math.round(n).toLocaleString('en-US');
}

const SEED: Commission[] = [
  {
    deal: 'MJ-0418',
    unit: 'HB-P2-B1-3A',
    contact: 'Rana Farouk',
    contactAr: 'رنا فاروق',
    gross: 787_500,
    rate: 2.5,
    status: 'payable',
    lines: [
      { who: 'Dina El Sayed (agent)', whoAr: 'دينا السيد (الوكيل)', pct: 40, amount: 315_000 },
      { who: 'Khaled Nabil (team lead)', whoAr: 'خالد نبيل (قائد الفريق)', pct: 10, amount: 78_750 },
      { who: 'Horizon Realty (company)', whoAr: 'هورايزن للعقارات (الشركة)', pct: 50, amount: 393_750 },
    ],
  },
  {
    deal: 'MJ-0422',
    unit: 'MH-P3-401',
    contact: 'Laila Ibrahim',
    contactAr: 'ليلى إبراهيم',
    gross: 112_500,
    rate: 2.5,
    status: 'approved',
    lines: [
      { who: 'Youssef Mansour (agent)', whoAr: 'يوسف منصور (الوكيل)', pct: 40, amount: 45_000 },
      { who: 'Horizon Realty (company)', whoAr: 'هورايزن للعقارات (الشركة)', pct: 60, amount: 67_500 },
    ],
  },
  {
    deal: 'MJ-0427',
    unit: 'HB-P1-A2-12C',
    contact: 'Omar Zaki',
    contactAr: 'عمر ذكي',
    gross: 245_000,
    rate: 2.5,
    status: 'calculated',
    lines: [
      { who: 'Khaled Nabil (agent)', whoAr: 'خالد نبيل (الوكيل)', pct: 40, amount: 98_000 },
      { who: 'Horizon Realty (company)', whoAr: 'هورايزن للعقارات (الشركة)', pct: 60, amount: 147_000 },
    ],
  },
  {
    deal: 'MJ-0355',
    unit: 'RN-3301',
    contact: 'Yara Hossam',
    contactAr: 'يارا هشام',
    gross: 170_000,
    rate: 2,
    status: 'paid',
    lines: [
      { who: 'Rana Farouk (agent)', whoAr: 'رنا فاروق (الوكيل)', pct: 50, amount: 85_000 },
      { who: 'Horizon Realty (company)', whoAr: 'هورايزن للعقارات (الشركة)', pct: 50, amount: 85_000 },
    ],
  },
];

const NEXT: Record<CommStatus, CommStatus | null> = {
  calculated: 'approved',
  approved: 'payable',
  payable: 'paid',
  paid: null,
};

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  statusAll: string;
  statusNames: Record<CommStatus, string>;
  nextAction: Record<CommStatus, string>;
  thDeal: string;
  thGross: string;
  thStatus: string;
  thAction: string;
  linesTitle: string;
  close: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Finance',
    title: 'Commissions',
    sub: 'Calculated on deal won. Gross = value × rate, split by scheme.',
    statusAll: 'All',
    statusNames: { calculated: 'Calculated', approved: 'Approved', payable: 'Payable', paid: 'Paid' },
    nextAction: { calculated: 'Approve', approved: 'Mark payable', payable: 'Mark paid', paid: '—' },
    thDeal: 'Deal',
    thGross: 'Gross',
    thStatus: 'Status',
    thAction: 'Action',
    linesTitle: 'Split',
    close: 'Close',
    emptyTitle: 'No commissions match this filter.',
  },
  ar: {
    eyebrow: 'الفوترة',
    title: 'العمولات',
    sub: 'تُحسب عند إغلاق الصفقة. الإجمالي = القيمة × النسبة، مقسّمة حسب النظام.',
    statusAll: 'الكل',
    statusNames: { calculated: 'محسوبة', approved: 'معتمدة', payable: 'جاهزة للصرف', paid: 'مصروفة' },
    nextAction: { calculated: 'اعتماد', approved: 'جاهزة للصرف', payable: 'تم الصرف', paid: '—' },
    thDeal: 'الصفقة',
    thGross: 'الإجمالي',
    thStatus: 'الحالة',
    thAction: 'إجراء',
    linesTitle: 'التقسيم',
    close: 'إغلاق',
    emptyTitle: 'لا توجد عمولات مطابقة.',
  },
};

@Component({
  selector: 'app-commissions',
  templateUrl: './commissions.html',
  styleUrl: './commissions.scss',
})
export class Commissions {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly commissions = signal<Commission[]>(SEED);
  readonly statusFilter = signal<CommStatus | 'all'>('all');
  readonly statuses: CommStatus[] = ['calculated', 'approved', 'payable', 'paid'];

  readonly filtered = computed(() =>
    this.commissions().filter((c) => this.statusFilter() === 'all' || c.status === this.statusFilter()),
  );

  contact(c: Commission): string {
    return this.ar() ? c.contactAr : c.contact;
  }
  money(n: number): string {
    return pesos(n);
  }

  readonly selected = signal<Commission | null>(null);
  open(c: Commission): void {
    this.selected.set(c);
  }
  close(): void {
    this.selected.set(null);
  }
  lineWho(l: Line): string {
    return this.ar() ? l.whoAr : l.who;
  }

  advance(c: Commission): void {
    const next = NEXT[c.status];
    if (!next) return;
    this.commissions.update((list) => list.map((x) => (x.deal === c.deal ? { ...x, status: next } : x)));
    if (this.selected()?.deal === c.deal) this.selected.set({ ...c, status: next });
  }
}
