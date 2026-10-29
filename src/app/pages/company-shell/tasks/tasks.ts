import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type Priority = 'high' | 'med' | 'low';
type Group = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

interface Task {
  id: string;
  title: string;
  titleAr: string;
  days: number;
  dueLabel: string;
  priority: Priority;
  owner: string;
  ownerAr: string;
  done: boolean;
}

let seq = 100;

const SEED: Task[] = [
  { id: 't1', title: 'Call Ahmed Samir to confirm viewing time', titleAr: 'الاتصال بأحمد سمير لتأكيد وقت المعاينة', days: -2, dueLabel: 'Oct 27', priority: 'high', owner: 'Youssef Mansour', ownerAr: 'يوسف منصور', done: false },
  { id: 't2', title: 'Send payment plan to Nour Adel', titleAr: 'إرسال خطة السداد لنور عادل', days: -1, dueLabel: 'Oct 28', priority: 'high', owner: 'Dina El Sayed', ownerAr: 'دينا السيد', done: false },
  { id: 't3', title: 'Follow up on offer — Tarek Hamdy', titleAr: 'متابعة العرض — طارق حمدي', days: 0, dueLabel: 'Today', priority: 'med', owner: 'Dina El Sayed', ownerAr: 'دينا السيد', done: false },
  { id: 't4', title: 'Prepare viewing route for Mostafa Saeed', titleAr: 'تجهيز مسار المعاينة لمصطفى سعيد', days: 0, dueLabel: 'Today', priority: 'med', owner: 'Khaled Nabil', ownerAr: 'خالد نبيل', done: false },
  { id: 't5', title: 'Collect ID copy — Rana Mahmoud contract', titleAr: 'تحصيل نسخة البطاقة — عقد رنا محمود', days: 1, dueLabel: 'Tomorrow', priority: 'high', owner: 'Dina El Sayed', ownerAr: 'دينا السيد', done: false },
  { id: 't6', title: 'Check in with Laila Ibrahim post-signing', titleAr: 'التواصل مع ليلى إبراهيم بعد التوقيع', days: 1, dueLabel: 'Tomorrow', priority: 'low', owner: 'Youssef Mansour', ownerAr: 'يوسف منصور', done: false },
  { id: 't7', title: 'Review commission split — MJ-0418', titleAr: 'مراجعة تقسيم العمولة — MJ-0418', days: 3, dueLabel: 'Oct 31', priority: 'med', owner: 'Mona Sami', ownerAr: 'منى سامي', done: false },
  { id: 't8', title: 'Shortlist units for Yara Hossam', titleAr: 'ترشيح وحدات لـ يارا هشام', days: 4, dueLabel: 'Nov 1', priority: 'low', owner: 'Rana Farouk', ownerAr: 'رنا فاروق', done: false },
  { id: 't9', title: 'Quarterly review — North Coast campaign', titleAr: 'مراجعة فصلية — حملة الساحل الشمالي', days: 12, dueLabel: 'Nov 9', priority: 'low', owner: 'Mona Sami', ownerAr: 'منى سامي', done: false },
  { id: 't10', title: 'Renew listing agreement — Office MH-P3', titleAr: 'تجديد اتفاقية الإدراج — مكتب MH-P3', days: 18, dueLabel: 'Nov 15', priority: 'med', owner: 'Youssef Mansour', ownerAr: 'يوسف منصور', done: false },
];

function groupFor(days: number): Group {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  addPh: string;
  groupAll: string;
  groupNames: Record<Group, string>;
  ownerAll: string;
  priorityNames: Record<Priority, string>;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Sales',
    title: 'Tasks',
    sub: 'Overdue follow-ups across the whole team, so no customer is left waiting.',
    addPh: 'Quick add a task and press Enter…',
    groupAll: 'All',
    groupNames: { overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', week: 'Next week', later: 'Later' },
    ownerAll: 'All agents',
    priorityNames: { high: 'High', med: 'Medium', low: 'Low' },
    emptyTitle: 'Nothing here.',
  },
  ar: {
    eyebrow: 'المبيعات',
    title: 'المهام',
    sub: 'المتابعات المتأخرة لكل الفريق حتى لا ينتظر أي عميل.',
    addPh: 'أضف مهمة سريعة واضغط Enter…',
    groupAll: 'الكل',
    groupNames: { overdue: 'متأخرة', today: 'اليوم', tomorrow: 'غدًا', week: 'الأسبوع القادم', later: 'لاحقًا' },
    ownerAll: 'كل الوكلاء',
    priorityNames: { high: 'عالية', med: 'متوسطة', low: 'منخفضة' },
    emptyTitle: 'لا توجد مهام هنا.',
  },
};

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class Tasks {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly tasks = signal<Task[]>(SEED);
  readonly groupFilter = signal<Group | 'all'>('all');
  readonly ownerFilter = signal<string>('all');
  readonly groups: Group[] = ['overdue', 'today', 'tomorrow', 'week', 'later'];
  readonly quickAdd = signal('');

  readonly owners = computed(() => {
    const set = new Set(this.tasks().map((t) => t.owner));
    return ['all', ...Array.from(set)];
  });

  readonly filtered = computed(() =>
    this.tasks()
      .filter((t) => !t.done)
      .filter((t) => this.groupFilter() === 'all' || groupFor(t.days) === this.groupFilter())
      .filter((t) => this.ownerFilter() === 'all' || t.owner === this.ownerFilter())
      .sort((a, b) => a.days - b.days),
  );

  grouped = computed(() => {
    const byGroup = new Map<Group, Task[]>();
    for (const g of this.groups) byGroup.set(g, []);
    for (const t of this.filtered()) byGroup.get(groupFor(t.days))!.push(t);
    return this.groups.map((g) => ({ group: g, items: byGroup.get(g)! })).filter((x) => x.items.length);
  });

  title(t: Task): string {
    return this.ar() ? t.titleAr : t.title;
  }
  owner(t: Task): string {
    return this.ar() ? t.ownerAr : t.owner;
  }

  toggleDone(t: Task): void {
    this.tasks.update((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  }

  addQuick(): void {
    const title = this.quickAdd().trim();
    if (!title) return;
    this.tasks.update((list) => [
      {
        id: 'qa' + seq++,
        title,
        titleAr: title,
        days: 0,
        dueLabel: 'Today',
        priority: 'med',
        owner: 'Mona Sami',
        ownerAr: 'منى سامي',
        done: false,
      },
      ...list,
    ]);
    this.quickAdd.set('');
  }
}
