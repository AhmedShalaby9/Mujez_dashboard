import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type UnitStatus = 'available' | 'hold' | 'reserved' | 'under_contract' | 'sold';

interface StackUnit {
  code: string;
  floor: number;
  status: UnitStatus;
  price: string;
}

interface Building {
  code: string;
  name: string;
  nameAr: string;
  floors: number;
  units: StackUnit[];
}

interface Phase {
  code: string;
  name: string;
  nameAr: string;
  deliveryYear: number;
  buildings: Building[];
}

interface ProjectCard {
  id: string;
  name: string;
  nameAr: string;
  developer: string;
  developerAr: string;
  location: string;
  locationAr: string;
  segment: 'res' | 'com';
  total: number;
  available: number;
  heldOrReserved: number;
  sold: number;
  fromPrice: string;
  phases: Phase[];
}

function buildBuilding(code: string, name: string, nameAr: string, floors: number, statuses: UnitStatus[]): Building {
  const units: StackUnit[] = [];
  let i = 0;
  for (let f = floors; f >= 1; f--) {
    for (const letter of ['A', 'B', 'C', 'D']) {
      const status = statuses[i % statuses.length];
      units.push({
        code: `${code}-${f}${letter}`,
        floor: f,
        status,
        price: status === 'sold' ? '—' : `EGP ${(9 + (i % 5) * 1.3).toFixed(1)}M`,
      });
      i++;
    }
  }
  return { code, name, nameAr, floors, units };
}

const PROJECTS: ProjectCard[] = [
  {
    id: 'HB',
    name: 'Hillside Bay',
    nameAr: 'هيلسايد باي',
    developer: 'Nile Developments',
    developerAr: 'نايل للتطوير',
    location: 'New Cairo',
    locationAr: 'القاهرة الجديدة',
    segment: 'res',
    total: 164,
    available: 58,
    heldOrReserved: 14,
    sold: 92,
    fromPrice: 'EGP 8.4M',
    phases: [
      {
        code: 'P1',
        name: 'Phase 1',
        nameAr: 'المرحلة 1',
        deliveryYear: 2026,
        buildings: [
          buildBuilding(
            'HB-P1-A',
            'Building A',
            'المبنى أ',
            6,
            ['sold', 'sold', 'under_contract', 'available', 'reserved', 'available', 'hold', 'sold'],
          ),
        ],
      },
      {
        code: 'P2',
        name: 'Phase 2',
        nameAr: 'المرحلة 2',
        deliveryYear: 2027,
        buildings: [
          buildBuilding(
            'HB-P2-B1',
            'Villas cluster B1',
            'مجموعة فلل B1',
            3,
            ['under_contract', 'available', 'available', 'reserved'],
          ),
        ],
      },
    ],
  },
  {
    id: 'MH',
    name: 'Marina Heights',
    nameAr: 'مارينا هايتس',
    developer: 'Delta Urban',
    developerAr: 'دلتا للتطوير العمراني',
    location: 'Sheikh Zayed',
    locationAr: 'الشيخ زايد',
    segment: 'com',
    total: 82,
    available: 31,
    heldOrReserved: 6,
    sold: 45,
    fromPrice: 'EGP 3.1M',
    phases: [
      {
        code: 'P2',
        name: 'Phase 2',
        nameAr: 'المرحلة 2',
        deliveryYear: 2025,
        buildings: [
          buildBuilding(
            'MH-P2-C',
            'Office building C',
            'مبنى المكاتب C',
            5,
            ['sold', 'available', 'sold', 'hold', 'available'],
          ),
        ],
      },
      {
        code: 'P3',
        name: 'Phase 3',
        nameAr: 'المرحلة 3',
        deliveryYear: 2026,
        buildings: [
          buildBuilding('MH-P3', 'Office building (single)', 'مبنى مكاتب واحد', 4, ['available', 'reserved', 'sold', 'available']),
        ],
      },
    ],
  },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  total: string;
  available: string;
  heldOrReserved: string;
  sold: string;
  fromLabel: string;
  viewStacking: string;
  statusNames: Record<UnitStatus, string>;
  stackingTitle: string;
  close: string;
  unitActions: { reserve: string; hold: string; release: string; share: string };
  toastDone: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Inventory',
    title: 'Projects',
    sub: 'Developer → Project → Phase → Building → Unit, with live counts.',
    total: 'Total',
    available: 'Available',
    heldOrReserved: 'Hold + reserved',
    sold: 'Sold',
    fromLabel: 'from',
    viewStacking: 'View stacking plan',
    statusNames: {
      available: 'Available',
      hold: 'Hold',
      reserved: 'Reserved',
      under_contract: 'Under contract',
      sold: 'Sold',
    },
    stackingTitle: 'Stacking plan',
    close: 'Close',
    unitActions: {
      reserve: 'Reserve for client',
      hold: 'Hold 48h',
      release: 'Release',
      share: 'Share',
    },
    toastDone: 'Unit updated.',
  },
  ar: {
    eyebrow: 'المخزون',
    title: 'المشروعات',
    sub: 'مطوّر ← مشروع ← مرحلة ← مبنى ← وحدة، مع أعداد مباشرة.',
    total: 'الإجمالي',
    available: 'متاح',
    heldOrReserved: 'محجوز/معلّق',
    sold: 'مباع',
    fromLabel: 'من',
    viewStacking: 'عرض مخطط الوحدات',
    statusNames: {
      available: 'متاح',
      hold: 'معلّق',
      reserved: 'محجوز',
      under_contract: 'تحت العقد',
      sold: 'مباع',
    },
    stackingTitle: 'مخطط الوحدات',
    close: 'إغلاق',
    unitActions: {
      reserve: 'حجز لعميل',
      hold: 'تعليق 48 ساعة',
      release: 'تحرير',
      share: 'مشاركة',
    },
    toastDone: 'تم تحديث الوحدة.',
  },
};

@Component({
  selector: 'app-projects',
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly projects = signal<ProjectCard[]>(PROJECTS);

  name(p: ProjectCard | Phase | Building): string {
    return this.ar() ? (p as any).nameAr : (p as any).name;
  }
  developer(p: ProjectCard): string {
    return this.ar() ? p.developerAr : p.developer;
  }
  location(p: ProjectCard): string {
    return this.ar() ? p.locationAr : p.location;
  }

  readonly openProject = signal<ProjectCard | null>(null);
  readonly openBuilding = signal<Building | null>(null);
  readonly toast = signal<string | null>(null);

  view(p: ProjectCard): void {
    this.openProject.set(p);
    this.openBuilding.set(p.phases[0]?.buildings[0] ?? null);
  }
  closeDialog(): void {
    this.openProject.set(null);
    this.openBuilding.set(null);
  }
  selectBuilding(b: Building): void {
    this.openBuilding.set(b);
  }

  floorsOf(b: Building): number[] {
    const set = new Set(b.units.map((u) => u.floor));
    return Array.from(set).sort((a, b2) => b2 - a);
  }
  unitsOnFloor(b: Building, floor: number): StackUnit[] {
    return b.units.filter((u) => u.floor === floor);
  }

  readonly legendStatuses: UnitStatus[] = ['available', 'hold', 'reserved', 'under_contract', 'sold'];

  readonly selectedUnit = signal<StackUnit | null>(null);
  selectUnit(u: StackUnit, ev: Event): void {
    ev.stopPropagation();
    this.selectedUnit.set(this.selectedUnit()?.code === u.code ? null : u);
  }

  applyAction(status: UnitStatus): void {
    const u = this.selectedUnit();
    const b = this.openBuilding();
    if (!u || !b) return;
    b.units = b.units.map((x) => (x.code === u.code ? { ...x, status } : x));
    this.openBuilding.set({ ...b });
    this.selectedUnit.set(null);
    this.toast.set(this.L().toastDone);
    setTimeout(() => this.toast.set(null), 2600);
  }
}
