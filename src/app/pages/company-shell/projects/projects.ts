import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyUiState, type Lang } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  InventoryApi,
  type Project,
  type Phase,
  type Building,
  type InventoryUnit,
} from '../../../inventory-api.service';
import { InventoryEditor } from '../../../inventory-editor';
type UnitStatus = InventoryUnit['status'];
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
  imports: [FormsModule, RouterLink, InventoryEditor],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnDestroy {
  readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(InventoryApi);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');
  readonly canReserve = computed(
    () =>
      this.auth.user()?.permissions.includes('reservations.manage') &&
      this.auth.user()?.permissions.includes('reservations.read'),
  );
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('projects.manage') ?? false,
  );
  readonly canUnits = computed(() => this.auth.user()?.permissions.includes('units.read') ?? false);
  readonly canManageUnits = computed(
    () => this.auth.user()?.permissions.includes('units.manage') ?? false,
  );
  projects = signal<Project[]>([]);
  total = signal(0);
  page = signal(1);
  search = '';
  archived = false;
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  openProject = signal<Project | null>(null);
  openBuilding = signal<Building | null>(null);
  selectedUnit = signal<InventoryUnit | null>(null);
  stack = signal<InventoryUnit[]>([]);
  stackTotal = signal(0);
  stackPage = signal(1);
  stackLoading = signal(false);
  editor = signal<any>(null);
  private serial = 0;
  private detailSerial = 0;
  private stackSerial = 0;
  constructor() {
    void this.reload();
  }
  ngOnDestroy() {
    this.serial++;
    this.detailSerial++;
    this.stackSerial++;
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  name(v: Project | Phase | Building) {
    return v.name[this.lang()];
  }
  developer(p: Project) {
    return p.developer[this.lang()];
  }
  location(p: Project) {
    return p.location[this.lang()];
  }
  money(v: string | null) {
    return this.api.money(v);
  }
  async reload() {
    const n = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get<{ items: Project[]; total: number }>('projects', {
        q: this.search,
        page: String(this.page()),
        limit: '24',
        archived: this.archived ? 'all' : 'active',
      });
      if (n !== this.serial) return;
      this.projects.set(r.items);
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
  paginate(delta: number) {
    this.page.update((p) => p + delta);
    void this.reload();
  }
  async view(p: Project, keep = false) {
    const n = ++this.detailSerial;
    this.error.set('');
    try {
      const d = await this.api.get<Project>('projects/' + p.id);
      if (n !== this.detailSerial) return;
      this.openProject.set(d);
      const prior = keep ? this.openBuilding()?.id : null;
      this.openBuilding.set(
        d.phases.flatMap((ph) => ph.buildings).find((b) => b.id === prior) ??
          d.phases[0]?.buildings[0] ??
          null,
      );
      this.selectedUnit.set(null);
      this.stackPage.set(1);
      await this.loadStack();
    } catch (e: any) {
      if (n === this.detailSerial) this.error.set(e.message);
    }
  }
  closeDialog() {
    this.detailSerial++;
    this.stackSerial++;
    this.openProject.set(null);
    this.openBuilding.set(null);
    this.selectedUnit.set(null);
    this.stack.set([]);
  }
  selectBuilding(b: Building) {
    this.openBuilding.set(b);
    this.selectedUnit.set(null);
    this.stackPage.set(1);
    void this.loadStack();
  }
  async loadStack() {
    const n = ++this.stackSerial,
      b = this.openBuilding();
    this.stack.set([]);
    this.stackTotal.set(0);
    if (!b || !this.canUnits()) return;
    this.stackLoading.set(true);
    try {
      const r = await this.api.get<{ items: InventoryUnit[]; total: number }>('units', {
        buildingId: b.id,
        page: String(this.stackPage()),
        limit: '100',
      });
      if (n !== this.stackSerial) return;
      this.stack.set(r.items);
      this.stackTotal.set(r.total);
    } catch (e: any) {
      if (n === this.stackSerial) this.error.set(e.message);
    } finally {
      if (n === this.stackSerial) this.stackLoading.set(false);
    }
  }
  stackPaginate(delta: number) {
    this.stackPage.update((p) => p + delta);
    void this.loadStack();
  }
  floorsOf(b: Building) {
    return Array.from(new Set(this.stack().map((u) => u.floor ?? 0))).sort((a, b) => b - a);
  }
  unitsOnFloor(b: Building, f: number) {
    return this.stack().filter((u) => (u.floor ?? 0) === f);
  }
  selectUnit(u: InventoryUnit, ev: Event) {
    ev.stopPropagation();
    this.selectedUnit.set(this.selectedUnit()?.id === u.id ? null : u);
  }
  legendStatuses: UnitStatus[] = ['available', 'hold', 'reserved', 'under_contract', 'sold'];
  edit(kind: string, record: any = null, parent = '', initial: any = {}) {
    this.editor.set({ kind, record, parent, initial });
  }
  async saved() {
    this.editor.set(null);
    await this.reload();
    const p = this.openProject();
    if (p) await this.view(p, true);
  }
  async archive(p: Project) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write('projects/' + p.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: p.version,
        action: p.archivedAt ? 'restore' : 'archive',
      });
      this.closeDialog();
      await this.reload();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
