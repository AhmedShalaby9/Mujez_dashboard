import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type Stage = 'new' | 'qualified' | 'viewing' | 'offer' | 'contract' | 'won' | 'lost';

interface Lead {
  id: string;
  name: string;
  nameAr: string;
  phone: string;
  segment: 'res' | 'com';
  want: string;
  wantAr: string;
  budget: string;
  source: string;
  sourceAr: string;
  owner: string;
  ownerAr: string;
  stage: Stage;
  score: number;
  lastTouch: string;
}

interface TimelineEntry {
  kind: string;
  kindAr: string;
  at: string;
}

const LEADS: Lead[] = [
  {
    id: 'L-2041',
    name: 'Ahmed Samir',
    nameAr: 'أحمد سمير',
    phone: '+20 100 123 4567',
    segment: 'res',
    want: '3BR apartment, New Cairo',
    wantAr: 'شقة 3 غرف، القاهرة الجديدة',
    budget: 'EGP 10M',
    source: 'Property Finder',
    sourceAr: 'بروبرتي فايندر',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'viewing',
    score: 92,
    lastTouch: '2h ago',
  },
  {
    id: 'L-2038',
    name: 'Nour Adel',
    nameAr: 'نور عادل',
    phone: '+20 101 234 5678',
    segment: 'com',
    want: 'Retail unit, Sheikh Zayed',
    wantAr: 'وحدة تجارية، الشيخ زايد',
    budget: 'EGP 6.2M',
    source: 'Facebook',
    sourceAr: 'فيسبوك',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'offer',
    score: 88,
    lastTouch: '40m ago',
  },
  {
    id: 'L-2035',
    name: 'Mostafa Saeed',
    nameAr: 'مصطفى سعيد',
    phone: '+20 111 345 6789',
    segment: 'res',
    want: 'Villa, Hillside Bay',
    wantAr: 'فيلا، هيلسايد باي',
    budget: 'EGP 18M',
    source: 'Referral',
    sourceAr: 'توصية',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    stage: 'qualified',
    score: 85,
    lastTouch: '1d ago',
  },
  {
    id: 'L-2029',
    name: 'Laila Ibrahim',
    nameAr: 'ليلى إبراهيم',
    phone: '+20 122 456 7890',
    segment: 'com',
    want: 'Office, Marina Heights',
    wantAr: 'مكتب، مارينا هايتس',
    budget: 'EGP 4.5M',
    source: 'Website',
    sourceAr: 'الموقع',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'contract',
    score: 79,
    lastTouch: '3d ago',
  },
  {
    id: 'L-2019',
    name: 'Yara Hossam',
    nameAr: 'يارا هشام',
    phone: '+20 109 876 5432',
    segment: 'res',
    want: 'Chalet, North Coast',
    wantAr: 'شاليه، الساحل الشمالي',
    budget: 'EGP 5.4M',
    source: 'Instagram',
    sourceAr: 'انستجرام',
    owner: 'Rana Farouk',
    ownerAr: 'رنا فاروق',
    stage: 'new',
    score: 61,
    lastTouch: '5h ago',
  },
  {
    id: 'L-2011',
    name: 'Tarek Hamdy',
    nameAr: 'طارق حمدي',
    phone: '+20 155 765 4321',
    segment: 'com',
    want: 'Warehouse, 10th of Ramadan',
    wantAr: 'مستودع، العاشر من رمضان',
    budget: 'EGP 7.1M',
    source: 'Past client',
    sourceAr: 'عميل سابق',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'offer',
    score: 73,
    lastTouch: '2d ago',
  },
  {
    id: 'L-2003',
    name: 'Salma Hegazy',
    nameAr: 'سلمى حجازي',
    phone: '+20 112 654 3210',
    segment: 'res',
    want: 'Apartment, Marina Heights',
    wantAr: 'شقة، مارينا هايتس',
    budget: 'EGP 8.6M',
    source: 'Google',
    sourceAr: 'جوجل',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'qualified',
    score: 68,
    lastTouch: '6h ago',
  },
  {
    id: 'L-1996',
    name: 'Hany Fathy',
    nameAr: 'هاني فتحي',
    phone: '+20 127 543 2109',
    segment: 'res',
    want: 'Apartment, under EGP 6M',
    wantAr: 'شقة، أقل من 6 مليون',
    budget: 'EGP 6M',
    source: 'Walk-in',
    sourceAr: 'زيارة مباشرة',
    owner: 'Rana Farouk',
    ownerAr: 'رنا فاروق',
    stage: 'lost',
    score: 32,
    lastTouch: '9d ago',
  },
  {
    id: 'MJ-0418',
    name: 'Rana Mahmoud',
    nameAr: 'رنا محمود',
    phone: '+20 100 987 6543',
    segment: 'res',
    want: 'Villa, Hillside Bay',
    wantAr: 'فيلا، هيلسايد باي',
    budget: 'EGP 31.5M',
    source: 'Referral',
    sourceAr: 'توصية',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'won',
    score: 97,
    lastTouch: '1d ago',
  },
];

const TIMELINE: TimelineEntry[] = [
  { kind: 'Viewing scheduled for HB-P2-B1-3A', kindAr: 'تحديد معاينة لـ HB-P2-B1-3A', at: 'Today, 10:30' },
  { kind: 'WhatsApp sent: payment plan options', kindAr: 'رسالة واتساب: خيارات خطة السداد', at: 'Yesterday, 17:05' },
  { kind: 'Status changed: Qualified → Viewing', kindAr: 'تغيير الحالة: مؤهّل ← معاينة', at: 'Yesterday, 09:20' },
  { kind: 'Lead assigned to owner', kindAr: 'إسناد العميل للمسؤول', at: '3 days ago' },
  { kind: 'Lead created from Property Finder', kindAr: 'إنشاء العميل من بروبرتي فايندر', at: '4 days ago' },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  newBtn: string;
  searchPh: string;
  stageAll: string;
  stageNames: Record<Stage, string>;
  thContact: string;
  thWant: string;
  thSource: string;
  thOwner: string;
  thScore: string;
  thStage: string;
  emptyTitle: string;
  drawerActivity: string;
  drawerClose: string;
  dupTitle: string;
  dupBody: string;
  dupPhone: string;
  dupMerge: string;
  dupLink: string;
  dupCreate: string;
  dupReasonLabel: string;
  dupReasonPh: string;
  cancel: string;
  newTitle: string;
  nameLabel: string;
  phoneLabel: string;
  wantLabel: string;
  budgetLabel: string;
  create: string;
  toastCreated: string;
  toastCreatedAnyway: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Sales',
    title: 'Leads',
    sub: 'Every lead, its owner, source and stage.',
    newBtn: '+ New lead',
    searchPh: 'Search name, phone, want…',
    stageAll: 'All stages',
    stageNames: {
      new: 'New',
      qualified: 'Qualified',
      viewing: 'Viewing',
      offer: 'Offer',
      contract: 'Contract',
      won: 'Won',
      lost: 'Lost',
    },
    thContact: 'Contact',
    thWant: 'Want',
    thSource: 'Source',
    thOwner: 'Owner',
    thScore: 'Score',
    thStage: 'Stage',
    emptyTitle: 'No leads match these filters.',
    drawerActivity: 'Activity timeline',
    drawerClose: 'Close',
    dupTitle: 'Possible duplicate',
    dupBody: 'A lead with this phone number already exists: Ahmed Samir (L-2041).',
    dupPhone: 'Phone',
    dupMerge: 'Merge into existing',
    dupLink: 'Link as related',
    dupCreate: 'Create anyway',
    dupReasonLabel: 'Reason (required to create anyway)',
    dupReasonPh: 'e.g. different buyer, same shared office number',
    cancel: 'Cancel',
    newTitle: 'New lead',
    nameLabel: 'Full name',
    phoneLabel: 'Phone',
    wantLabel: 'What they want',
    budgetLabel: 'Budget',
    create: 'Check & create',
    toastCreated: 'Lead created.',
    toastCreatedAnyway: 'Lead created (duplicate override logged).',
  },
  ar: {
    eyebrow: 'المبيعات',
    title: 'العملاء المحتملون',
    sub: 'كل العملاء ومسؤوليهم ومصادرهم ومراحلهم.',
    newBtn: '+ عميل جديد',
    searchPh: 'ابحث بالاسم أو الهاتف أو الطلب…',
    stageAll: 'كل المراحل',
    stageNames: {
      new: 'جديد',
      qualified: 'مؤهّل',
      viewing: 'معاينة',
      offer: 'عرض',
      contract: 'عقد',
      won: 'مغلق',
      lost: 'فاقد',
    },
    thContact: 'العميل',
    thWant: 'الطلب',
    thSource: 'المصدر',
    thOwner: 'المسؤول',
    thScore: 'التقييم',
    thStage: 'المرحلة',
    emptyTitle: 'لا يوجد عملاء مطابقون.',
    drawerActivity: 'سجل النشاط',
    drawerClose: 'إغلاق',
    dupTitle: 'احتمال تكرار',
    dupBody: 'يوجد عميل بنفس رقم الهاتف: أحمد سمير (L-2041).',
    dupPhone: 'الهاتف',
    dupMerge: 'دمج مع الموجود',
    dupLink: 'ربط كسجل ذي صلة',
    dupCreate: 'إنشاء مع ذلك',
    dupReasonLabel: 'السبب (مطلوب للإنشاء مع ذلك)',
    dupReasonPh: 'مثال: مشتري مختلف، نفس رقم المكتب المشترك',
    cancel: 'إلغاء',
    newTitle: 'عميل جديد',
    nameLabel: 'الاسم الكامل',
    phoneLabel: 'الهاتف',
    wantLabel: 'ماذا يريد',
    budgetLabel: 'الميزانية',
    create: 'فحص وإنشاء',
    toastCreated: 'تم إنشاء العميل.',
    toastCreatedAnyway: 'تم إنشاء العميل (تم تسجيل تجاوز التكرار).',
  },
};

@Component({
  selector: 'app-leads',
  templateUrl: './leads.html',
  styleUrl: './leads.scss',
})
export class Leads {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly leads = signal<Lead[]>(LEADS);
  readonly search = signal('');
  readonly stageFilter = signal<Stage | 'all'>('all');
  readonly stages: Stage[] = ['new', 'qualified', 'viewing', 'offer', 'contract', 'won', 'lost'];

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.leads().filter((l) => {
      if (this.stageFilter() !== 'all' && l.stage !== this.stageFilter()) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.want.toLowerCase().includes(q)
      );
    });
  });

  name(l: Lead): string {
    return this.ar() ? l.nameAr : l.name;
  }
  want(l: Lead): string {
    return this.ar() ? l.wantAr : l.want;
  }
  source(l: Lead): string {
    return this.ar() ? l.sourceAr : l.source;
  }
  owner(l: Lead): string {
    return this.ar() ? l.ownerAr : l.owner;
  }

  readonly selected = signal<Lead | null>(null);
  readonly timeline = TIMELINE;
  open(l: Lead): void {
    this.selected.set(l);
  }
  closeDrawer(): void {
    this.selected.set(null);
  }
  timelineText(t: TimelineEntry): string {
    return this.ar() ? t.kindAr : t.kind;
  }

  readonly newOpen = signal(false);
  readonly newName = signal('');
  readonly newPhone = signal('');
  readonly newWant = signal('');
  readonly newBudget = signal('');
  readonly dupOpen = signal(false);
  readonly dupReason = signal('');
  readonly toast = signal<string | null>(null);

  openNew(): void {
    this.newOpen.set(true);
    this.newName.set('');
    this.newPhone.set('');
    this.newWant.set('');
    this.newBudget.set('');
  }
  closeNew(): void {
    this.newOpen.set(false);
  }

  submitNew(): void {
    const isDuplicate = this.newPhone().replace(/\s/g, '') === '+201001234567';
    if (isDuplicate) {
      this.newOpen.set(false);
      this.dupOpen.set(true);
      this.dupReason.set('');
      return;
    }
    this.finishCreate(false);
  }

  resolveDuplicate(mode: 'merge' | 'link' | 'create'): void {
    if (mode === 'create' && this.dupReason().trim().length < 5) return;
    this.dupOpen.set(false);
    this.finishCreate(mode === 'create');
  }

  cancelDuplicate(): void {
    this.dupOpen.set(false);
  }

  private finishCreate(wasOverride: boolean): void {
    const id = 'L-' + Math.floor(2050 + Math.random() * 40);
    this.leads.update((list) => [
      {
        id,
        name: this.newName() || 'New lead',
        nameAr: this.newName() || 'عميل جديد',
        phone: this.newPhone(),
        segment: 'res',
        want: this.newWant() || '—',
        wantAr: this.newWant() || '—',
        budget: this.newBudget() || '—',
        source: 'Manual',
        sourceAr: 'إدخال يدوي',
        owner: 'Mona Sami',
        ownerAr: 'منى سامي',
        stage: 'new',
        score: 50,
        lastTouch: 'now',
      },
      ...list,
    ]);
    this.toast.set(wasOverride ? this.L().toastCreatedAnyway : this.L().toastCreated);
    setTimeout(() => this.toast.set(null), 3200);
  }
}
