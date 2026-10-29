import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type StageKey = 'new' | 'qualified' | 'viewing' | 'offer' | 'contract' | 'won';

interface Deal {
  id: string;
  title: string;
  titleAr: string;
  contact: string;
  contactAr: string;
  value: number;
  type: 'sale' | 'lease';
  owner: string;
  ownerAr: string;
  stage: StageKey;
}

const STAGE_ORDER: StageKey[] = ['new', 'qualified', 'viewing', 'offer', 'contract', 'won'];

const SEED: Deal[] = [
  {
    id: 'D-301',
    title: 'Apartment HB-P1-A2-9B',
    titleAr: 'شقة HB-P1-A2-9B',
    contact: 'Ahmed Samir',
    contactAr: 'أحمد سمير',
    value: 10_200_000,
    type: 'sale',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'new',
  },
  {
    id: 'D-298',
    title: 'Retail unit, Sheikh Zayed',
    titleAr: 'وحدة تجارية، الشيخ زايد',
    contact: 'Nour Adel',
    contactAr: 'نور عادل',
    value: 6_200_000,
    type: 'sale',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'new',
  },
  {
    id: 'D-292',
    title: 'Office MH-P3-401',
    titleAr: 'مكتب MH-P3-401',
    contact: 'Laila Ibrahim',
    contactAr: 'ليلى إبراهيم',
    value: 4_500_000,
    type: 'sale',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'qualified',
  },
  {
    id: 'D-287',
    title: 'Villa HB-P2-B1-3A',
    titleAr: 'فيلا HB-P2-B1-3A',
    contact: 'Mostafa Saeed',
    contactAr: 'مصطفى سعيد',
    value: 18_000_000,
    type: 'sale',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    stage: 'qualified',
  },
  {
    id: 'D-280',
    title: 'Apartment HB-P1-A2-12C',
    titleAr: 'شقة HB-P1-A2-12C',
    contact: 'Omar Zaki',
    contactAr: 'عمر ذكي',
    value: 9_800_000,
    type: 'sale',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    stage: 'viewing',
  },
  {
    id: 'D-276',
    title: 'Chalet, North Coast',
    titleAr: 'شاليه، الساحل الشمالي',
    contact: 'Yara Hossam',
    contactAr: 'يارا هشام',
    value: 5_400_000,
    type: 'sale',
    owner: 'Rana Farouk',
    ownerAr: 'رنا فاروق',
    stage: 'viewing',
  },
  {
    id: 'D-271',
    title: 'Warehouse, 10th of Ramadan',
    titleAr: 'مستودع، العاشر من رمضان',
    contact: 'Tarek Hamdy',
    contactAr: 'طارق حمدي',
    value: 7_100_000,
    type: 'lease',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'offer',
  },
  {
    id: 'D-266',
    title: 'Apartment MH-P2-C3-5A',
    titleAr: 'شقة MH-P2-C3-5A',
    contact: 'Salma Hegazy',
    contactAr: 'سلمى حجازي',
    value: 8_600_000,
    type: 'sale',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'offer',
  },
  {
    id: 'MJ-0422',
    title: 'Office MH-P3-401',
    titleAr: 'مكتب MH-P3-401',
    contact: 'Laila Ibrahim',
    contactAr: 'ليلى إبراهيم',
    value: 4_500_000,
    type: 'sale',
    owner: 'Youssef Mansour',
    ownerAr: 'يوسف منصور',
    stage: 'contract',
  },
  {
    id: 'MJ-0427',
    title: 'Apartment HB-P1-A2-12C',
    titleAr: 'شقة HB-P1-A2-12C',
    contact: 'Omar Zaki',
    contactAr: 'عمر ذكي',
    value: 9_800_000,
    type: 'sale',
    owner: 'Khaled Nabil',
    ownerAr: 'خالد نبيل',
    stage: 'contract',
  },
  {
    id: 'MJ-0418',
    title: 'Villa HB-P2-B1-3A',
    titleAr: 'فيلا HB-P2-B1-3A',
    contact: 'Rana Farouk (buyer)',
    contactAr: 'رنا فاروق (مشترية)',
    value: 31_500_000,
    type: 'sale',
    owner: 'Dina El Sayed',
    ownerAr: 'دينا السيد',
    stage: 'won',
  },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  stageNames: Record<StageKey, string>;
  moveBtn: string;
  lastStageHint: string;
  totalLabel: string;
  dealsLabel: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Sales',
    title: 'Pipeline',
    sub: 'Every deal by stage across all agents. Column totals show sale value only.',
    stageNames: {
      new: 'New',
      qualified: 'Qualified',
      viewing: 'Viewing',
      offer: 'Offer',
      contract: 'Contract',
      won: 'Won',
    },
    moveBtn: 'Move to next stage →',
    lastStageHint: 'Final stage',
    totalLabel: 'Total',
    dealsLabel: 'deals',
  },
  ar: {
    eyebrow: 'المبيعات',
    title: 'مراحل الصفقات',
    sub: 'كل الصفقات حسب المرحلة لكل الوكلاء. إجمالي العمود لصفقات البيع فقط.',
    stageNames: {
      new: 'جديدة',
      qualified: 'مؤهّلة',
      viewing: 'معاينة',
      offer: 'عرض',
      contract: 'عقد',
      won: 'مغلقة',
    },
    moveBtn: '← نقل للمرحلة التالية',
    lastStageHint: 'المرحلة الأخيرة',
    totalLabel: 'الإجمالي',
    dealsLabel: 'صفقة',
  },
};

@Component({
  selector: 'app-pipeline',
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss',
})
export class Pipeline {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly deals = signal<Deal[]>(SEED);
  readonly stages = STAGE_ORDER;

  readonly columns = computed(() =>
    this.stages.map((stage) => {
      const items = this.deals().filter((d) => d.stage === stage);
      const total = items
        .filter((d) => d.type === 'sale')
        .reduce((sum, d) => sum + d.value, 0);
      return { stage, items, total };
    }),
  );

  title(d: Deal): string {
    return this.ar() ? d.titleAr : d.title;
  }
  contact(d: Deal): string {
    return this.ar() ? d.contactAr : d.contact;
  }
  owner(d: Deal): string {
    return this.ar() ? d.ownerAr : d.owner;
  }

  nextStage(stage: StageKey): StageKey | null {
    const i = this.stages.indexOf(stage);
    return i < this.stages.length - 1 ? this.stages[i + 1] : null;
  }

  move(deal: Deal): void {
    const next = this.nextStage(deal.stage);
    if (!next) return;
    this.deals.update((list) =>
      list.map((d) => (d.id === deal.id ? { ...d, stage: next } : d)),
    );
  }

  money(n: number): string {
    if (n >= 1_000_000) return 'EGP ' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    return 'EGP ' + n.toLocaleString('en-US');
  }
}
