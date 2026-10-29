import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type Segment = 'all' | 'res' | 'com';

interface HotLead {
  id: string;
  name: string;
  nameAr: string;
  want: string;
  wantAr: string;
  budget: string;
  score: number;
  owner: string;
  ownerAr: string;
  segment: Segment;
}

interface TodayEvent {
  id: string;
  time: string;
  type: 'viewing' | 'call' | 'meeting' | 'signing';
  title: string;
  titleAr: string;
  owner: string;
  ownerAr: string;
}

interface Closing {
  id: string;
  deal: string;
  dealAr: string;
  value: string;
  owner: string;
  ownerAr: string;
  date: string;
  segment: Segment;
}

const HOT_LEADS: HotLead[] = [
  {
    id: 'L-2041',
    name: 'Ahmed Samir',
    nameAr: 'أحمد سمير',
    want: '3BR apartment, New Cairo, EGP 9–11M',
    wantAr: 'شقة 3 غرف، القاهرة الجديدة، 9-11 مليون جنيه',
    budget: 'EGP 10M',
    score: 92,
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    segment: 'res',
  },
  {
    id: 'L-2038',
    name: 'Nour Adel',
    nameAr: 'نور عادل',
    want: 'Retail unit, Sheikh Zayed, ground floor',
    wantAr: 'وحدة تجارية، الشيخ زايد، أرضي',
    budget: 'EGP 6.2M',
    score: 88,
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    segment: 'com',
  },
  {
    id: 'L-2035',
    name: 'Mostafa Saeed',
    nameAr: 'مصطفى سعيد',
    want: 'Villa, Hillside Bay, delivery 2027',
    wantAr: 'فيلا، هيلسايد باي، تسليم 2027',
    budget: 'EGP 18M',
    score: 85,
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    segment: 'res',
  },
  {
    id: 'L-2029',
    name: 'Laila Ibrahim',
    nameAr: 'ليلى إبراهيم',
    want: 'Office, Marina Heights, 150 sqm',
    wantAr: 'مكتب، مارينا هايتس، 150 م²',
    budget: 'EGP 4.5M',
    score: 79,
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    segment: 'com',
  },
];

const TODAY_EVENTS: TodayEvent[] = [
  {
    id: 'E-1',
    time: '10:30',
    type: 'viewing',
    title: 'Unit viewing — HB-P2-B1-3A with Ahmed Samir',
    titleAr: 'معاينة وحدة — HB-P2-B1-3A مع أحمد سمير',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
  },
  {
    id: 'E-2',
    time: '13:00',
    type: 'signing',
    title: 'Contract signing — MJ-0418, Rana Farouk',
    titleAr: 'توقيع عقد — MJ-0418، رنا فاروق',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
  },
  {
    id: 'E-3',
    time: '16:00',
    type: 'call',
    title: 'Follow-up call with Nour Adel',
    titleAr: 'مكالمة متابعة مع نور عادل',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
  },
  {
    id: 'E-4',
    time: '18:30',
    type: 'meeting',
    title: 'Investor meeting — Marina Heights phase 3',
    titleAr: 'اجتماع مستثمر — مارينا هايتس مرحلة 3',
    owner: 'Mona Sami',
    ownerAr: 'منى سامي',
  },
];

const CLOSINGS: Closing[] = [
  {
    id: 'MJ-0418',
    deal: 'Villa HB-P2-B1-3A — Rana Farouk',
    dealAr: 'فيلا HB-P2-B1-3A — رنا فاروق',
    value: 'EGP 31.5M',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    date: 'Nov 3',
    segment: 'res',
  },
  {
    id: 'MJ-0422',
    deal: 'Office MH-P3-401 — Laila Ibrahim',
    dealAr: 'مكتب MH-P3-401 — ليلى إبراهيم',
    value: 'EGP 4.5M',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    date: 'Nov 6',
    segment: 'com',
  },
  {
    id: 'MJ-0427',
    deal: 'Apartment HB-P1-A2-12C — Omar Zaki',
    dealAr: 'شقة HB-P1-A2-12C — عمر ذكي',
    value: 'EGP 9.8M',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    date: 'Nov 10',
    segment: 'res',
  },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  segAll: string;
  segRes: string;
  segCom: string;
  kpis: { pipeline: string; commission: string; showings: string; newLeads: string };
  todayTitle: string;
  hotTitle: string;
  closingsTitle: string;
  score: string;
  owner: string;
  typeNames: Record<TodayEvent['type'], string>;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Sales',
    title: 'Dashboard',
    sub: 'Company-wide pipeline, commission and activity for today.',
    segAll: 'All',
    segRes: 'Residential',
    segCom: 'Commercial',
    kpis: {
      pipeline: 'Pipeline value',
      commission: 'Commission MTD vs goal',
      showings: 'Showings this week',
      newLeads: 'New leads (7d)',
    },
    todayTitle: "Today's events",
    hotTitle: 'Hot leads',
    closingsTitle: 'Closings in 14 days',
    score: 'Score',
    owner: 'Owner',
    typeNames: { viewing: 'Viewing', call: 'Call', meeting: 'Meeting', signing: 'Signing' },
  },
  ar: {
    eyebrow: 'المبيعات',
    title: 'لوحة التحكم',
    sub: 'صفقات الشركة والعمولات والنشاط اليومي.',
    segAll: 'الكل',
    segRes: 'سكني',
    segCom: 'تجاري',
    kpis: {
      pipeline: 'قيمة الصفقات',
      commission: 'العمولة الشهرية مقابل الهدف',
      showings: 'المعاينات هذا الأسبوع',
      newLeads: 'عملاء جدد (7 أيام)',
    },
    todayTitle: 'أحداث اليوم',
    hotTitle: 'العملاء الجادّون',
    closingsTitle: 'إغلاقات خلال 14 يومًا',
    score: 'التقييم',
    owner: 'المسؤول',
    typeNames: { viewing: 'معاينة', call: 'مكالمة', meeting: 'اجتماع', signing: 'توقيع' },
  },
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  readonly segment = signal<Segment>('all');
  setSegment(s: Segment): void {
    this.segment.set(s);
  }

  private matches(segment: Segment): boolean {
    return this.segment() === 'all' || this.segment() === segment;
  }

  readonly hotLeads = computed(() => HOT_LEADS.filter((l) => this.matches(l.segment)));
  readonly closings = computed(() => CLOSINGS.filter((c) => this.matches(c.segment)));
  readonly todayEvents = TODAY_EVENTS;

  readonly ar = computed(() => this.lang() === 'ar');

  name(l: HotLead): string {
    return this.ar() ? l.nameAr : l.name;
  }
  want(l: HotLead): string {
    return this.ar() ? l.wantAr : l.want;
  }
  owner(x: { owner: string; ownerAr: string }): string {
    return this.ar() ? x.ownerAr : x.owner;
  }
  deal(c: Closing): string {
    return this.ar() ? c.dealAr : c.deal;
  }
  eventTitle(e: TodayEvent): string {
    return this.ar() ? e.titleAr : e.title;
  }
}
