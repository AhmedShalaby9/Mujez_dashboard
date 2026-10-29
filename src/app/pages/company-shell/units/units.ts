import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type UnitType = 'apt' | 'villa' | 'office' | 'retail';
type UnitStatus = 'available' | 'hold' | 'reserved' | 'under_contract' | 'sold';
type ListingType = 'primary' | 'resale' | 'rental';

interface Unit {
  code: string;
  project: string;
  projectAr: string;
  type: UnitType;
  bedrooms: number | null;
  area: number;
  view: string;
  viewAr: string;
  price: string;
  status: UnitStatus;
  listing: ListingType;
}

const SEED: Unit[] = [
  { code: 'RS-4410', project: 'Resale — Hillside Bay', projectAr: 'إعادة بيع — هيلسايد باي', type: 'apt', bedrooms: 3, area: 180, view: 'Garden', viewAr: 'حديقة', price: 'EGP 9.4M', status: 'available', listing: 'resale' },
  { code: 'RS-4388', project: 'Resale — Marina Heights', projectAr: 'إعادة بيع — مارينا هايتس', type: 'office', bedrooms: null, area: 95, view: 'Street', viewAr: 'شارع', price: 'EGP 2.8M', status: 'available', listing: 'resale' },
  { code: 'RN-3301', project: 'Rental — Hillside Bay', projectAr: 'إيجار — هيلسايد باي', type: 'villa', bedrooms: 5, area: 420, view: 'Lagoon', viewAr: 'بحيرة', price: 'EGP 85,000/mo', status: 'hold', listing: 'rental' },
  { code: 'RN-3295', project: 'Rental — Downtown', projectAr: 'إيجار — وسط البلد', type: 'retail', bedrooms: null, area: 60, view: 'Main road', viewAr: 'طريق رئيسي', price: 'EGP 32,000/mo', status: 'available', listing: 'rental' },
  { code: 'PR-HB-2201', project: 'Hillside Bay — Phase 1', projectAr: 'هيلسايد باي — المرحلة 1', type: 'apt', bedrooms: 2, area: 140, view: 'Pool', viewAr: 'حمام سباحة', price: 'EGP 8.4M', status: 'reserved', listing: 'primary' },
  { code: 'PR-MH-1105', project: 'Marina Heights — Phase 3', projectAr: 'مارينا هايتس — المرحلة 3', type: 'office', bedrooms: null, area: 150, view: 'Marina', viewAr: 'المارينا', price: 'EGP 4.5M', status: 'under_contract', listing: 'primary' },
  { code: 'RS-4372', project: 'Resale — Zamalek', projectAr: 'إعادة بيع — الزمالك', type: 'apt', bedrooms: 4, area: 260, view: 'Nile', viewAr: 'النيل', price: 'EGP 22M', status: 'sold', listing: 'resale' },
  { code: 'RN-3280', project: 'Rental — New Cairo', projectAr: 'إيجار — القاهرة الجديدة', type: 'retail', bedrooms: null, area: 85, view: 'Mall frontage', viewAr: 'واجهة مول', price: 'EGP 48,000/mo', status: 'available', listing: 'rental' },
  { code: 'PR-HB-2254', project: 'Hillside Bay — Phase 2', projectAr: 'هيلسايد باي — المرحلة 2', type: 'villa', bedrooms: 5, area: 480, view: 'Golf course', viewAr: 'ملعب جولف', price: 'EGP 31.5M', status: 'sold', listing: 'primary' },
  { code: 'RS-4360', project: 'Resale — 6th of October', projectAr: 'إعادة بيع — السادس من أكتوبر', type: 'villa', bedrooms: 4, area: 320, view: 'Garden', viewAr: 'حديقة', price: 'EGP 14.2M', status: 'available', listing: 'resale' },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  searchPh: string;
  typeAll: string;
  typeNames: Record<UnitType, string>;
  statusAll: string;
  statusNames: Record<UnitStatus, string>;
  listingNames: Record<ListingType, string>;
  bedrooms: string;
  area: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Inventory',
    title: 'Units',
    sub: 'Standalone resale and rental units, filtered by type and status.',
    searchPh: 'Search unit code or project…',
    typeAll: 'All types',
    typeNames: { apt: 'Apartment', villa: 'Villa', office: 'Office', retail: 'Retail' },
    statusAll: 'All statuses',
    statusNames: {
      available: 'Available',
      hold: 'Hold',
      reserved: 'Reserved',
      under_contract: 'Under contract',
      sold: 'Sold',
    },
    listingNames: { primary: 'Primary', resale: 'Resale', rental: 'Rental' },
    bedrooms: 'BR',
    area: 'sqm',
    emptyTitle: 'No units match these filters.',
  },
  ar: {
    eyebrow: 'المخزون',
    title: 'الوحدات',
    sub: 'الوحدات المستقلة لإعادة البيع والإيجار، مفلترة حسب النوع والحالة.',
    searchPh: 'ابحث برمز الوحدة أو المشروع…',
    typeAll: 'كل الأنواع',
    typeNames: { apt: 'شقة', villa: 'فيلا', office: 'مكتب', retail: 'تجاري' },
    statusAll: 'كل الحالات',
    statusNames: {
      available: 'متاح',
      hold: 'معلّق',
      reserved: 'محجوز',
      under_contract: 'تحت العقد',
      sold: 'مباع',
    },
    listingNames: { primary: 'أساسي', resale: 'إعادة بيع', rental: 'إيجار' },
    bedrooms: 'غرف',
    area: 'م²',
    emptyTitle: 'لا توجد وحدات مطابقة.',
  },
};

@Component({
  selector: 'app-units',
  templateUrl: './units.html',
  styleUrl: './units.scss',
})
export class Units {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly units = SEED;
  readonly search = signal('');
  readonly typeFilter = signal<UnitType | 'all'>('all');
  readonly statusFilter = signal<UnitStatus | 'all'>('all');
  readonly types: UnitType[] = ['apt', 'villa', 'office', 'retail'];
  readonly statuses: UnitStatus[] = ['available', 'hold', 'reserved', 'under_contract', 'sold'];

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.units.filter((u) => {
      if (this.typeFilter() !== 'all' && u.type !== this.typeFilter()) return false;
      if (this.statusFilter() !== 'all' && u.status !== this.statusFilter()) return false;
      if (!q) return true;
      return u.code.toLowerCase().includes(q) || u.project.toLowerCase().includes(q);
    });
  });

  project(u: Unit): string {
    return this.ar() ? u.projectAr : u.project;
  }
  view(u: Unit): string {
    return this.ar() ? u.viewAr : u.view;
  }
}
