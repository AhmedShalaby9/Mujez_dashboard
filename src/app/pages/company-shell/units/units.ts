import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import { InventoryApi, type InventoryUnit } from '../../../inventory-api.service';
import { InventoryEditor } from '../../../inventory-editor';
type UnitType = InventoryUnit['type'];
type UnitStatus = InventoryUnit['status'];
type ListingType = InventoryUnit['listing'];
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
  imports: [FormsModule, RouterLink, InventoryEditor],
  templateUrl: './units.html',
  styleUrl: './units.scss',
})
export class Units implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(InventoryApi);
  readonly auth = inject(AuthService);
  readonly route = inject(ActivatedRoute);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canReserve = computed(
    () =>
      this.auth.user()?.permissions.includes('reservations.manage') &&
      this.auth.user()?.permissions.includes('reservations.read'),
  );
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('units.manage') ?? false,
  );
  readonly types: UnitType[] = ['apt', 'villa', 'office', 'retail'];
  readonly statuses: UnitStatus[] = ['available', 'hold', 'reserved', 'under_contract', 'sold'];
  units = signal<InventoryUnit[]>([]);
  search = signal('');
  typeFilter = signal<UnitType | 'all'>('all');
  statusFilter = signal<UnitStatus | 'all'>('all');
  listing = 'all';
  archived = false;
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  editor = signal<any>(null);
  selected = signal<InventoryUnit | null>(null);
  private serial = 0;
  private detailSerial = 0;
  private routeSub = this.route.queryParamMap.subscribe((params) => {
    const id = params.get('unitId');
    if (id) void this.open(id);
  });
  constructor() {
    void this.reload();
  }
  ngOnDestroy() {
    this.serial++;
    this.detailSerial++;
    this.routeSub.unsubscribe();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  project(u: InventoryUnit) {
    return u.project[this.lang()];
  }
  view(u: InventoryUnit) {
    return u.view[this.lang()];
  }
  money(v: string) {
    return this.api.money(v);
  }
  async reload() {
    const n = ++this.serial;
    this.error.set('');
    this.loading.set(true);
    const q: Record<string, string> = {
      q: this.search(),
      page: String(this.page()),
      limit: '30',
      archived: this.archived ? 'all' : 'active',
    };
    if (this.typeFilter() !== 'all') q['type'] = this.typeFilter();
    if (this.statusFilter() !== 'all') q['status'] = this.statusFilter();
    if (this.listing !== 'all') q['listing'] = this.listing;
    try {
      const r = await this.api.get<{ items: InventoryUnit[]; total: number }>('units', q);
      if (n !== this.serial) return;
      this.units.set(r.items);
      this.total.set(r.total);
    } catch (e: any) {
      if (n === this.serial) this.error.set(e.message);
    } finally {
      if (n === this.serial) this.loading.set(false);
    }
  }
  filter() {
    this.page.set(1);
    void this.reload();
  }
  setType(t: UnitType | 'all') {
    this.typeFilter.set(t);
    this.filter();
  }
  setStatus(s: UnitStatus | 'all') {
    this.statusFilter.set(s);
    this.filter();
  }
  paginate(d: number) {
    this.page.update((p) => p + d);
    void this.reload();
  }
  async open(id: string) {
    const n = ++this.detailSerial;
    try {
      const u = await this.api.get<InventoryUnit>('units/' + id);
      if (n === this.detailSerial) this.selected.set(u);
    } catch (e: any) {
      if (n === this.detailSerial) this.error.set(e.message);
    }
  }
  edit(u: InventoryUnit | null = null) {
    this.editor.set({ record: u });
  }
  async saved() {
    this.editor.set(null);
    await this.reload();
    if (this.selected()) await this.open(this.selected()!.id);
  }
  async archive(u: InventoryUnit) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('units/' + u.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: u.version,
        action: u.archivedAt ? 'restore' : 'archive',
      });
      await this.reload();
      await this.open(u.id);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
