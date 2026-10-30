import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Projects } from './pages/company-shell/projects/projects';
import { Units } from './pages/company-shell/units/units';
import { InventoryEditor } from './inventory-editor';
import { InventoryApi } from './inventory-api.service';
import { AuthService } from './auth.service';
const project: any = {
  id: 'p1',
  code: 'REAL',
  name: { en: 'Saved project', ar: 'مشروع محفوظ' },
  developer: { en: 'Developer', ar: 'مطور' },
  location: { en: 'Cairo', ar: 'القاهرة' },
  segment: 'res',
  version: 2,
  archivedAt: null,
  sample: false,
  total: 1,
  available: 1,
  heldOrReserved: 0,
  sold: 0,
  underContract: 0,
  fromPriceMinor: '900719925474099300',
  phases: [
    {
      id: 'ph1',
      code: 'PH',
      name: { en: 'Phase', ar: 'مرحلة' },
      deliveryYear: 2027,
      version: 0,
      buildings: [
        { id: 'b1', code: 'BU', name: { en: 'Building', ar: 'مبنى' }, floors: 3, version: 0 },
      ],
    },
  ],
};
const unit: any = {
  id: 'u1',
  code: 'UNIT-REAL',
  projectId: 'p1',
  project: project.name,
  location: project.location,
  buildingId: 'b1',
  building: { en: 'Building', ar: 'مبنى' },
  phaseId: 'ph1',
  listing: 'primary',
  type: 'apt',
  bedrooms: 3,
  area: '140.25',
  view: { en: 'Garden', ar: 'حديقة' },
  floor: 2,
  priceMinor: '900719925474099300',
  status: 'available',
  version: 3,
  archivedAt: null,
  sample: false,
};
function api() {
  const calls: any[] = [];
  return {
    calls,
    get: async (path: string, q: any) => {
      calls.push({ path, q });
      if (path === 'projects') return { items: [project], total: 1 };
      if (path === 'projects/p1') return project;
      if (path === 'units') return { items: [unit], total: 1 };
      if (path === 'units/u1') return unit;
      throw Error(path);
    },
    write: async (path: string, b: any) => {
      calls.push({ path, b });
      return { ...unit, version: 4 };
    },
    money: (v: string | null) =>
      v === null
        ? '—'
        : 'EGP ' +
          (BigInt(v) / 100n).toString() +
          '.' +
          (BigInt(v) % 100n).toString().padStart(2, '0'),
  };
}
const permissions = ['projects.read', 'projects.manage', 'units.read', 'units.manage'];
async function setup(type: any, a: any, perms = permissions): Promise<any> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: AuthService, useValue: { user: signal({ permissions: perms }) } },
      { provide: InventoryApi, useValue: a },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(type);
  if (type === InventoryEditor) f.componentRef.setInput('kind', 'project');
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Connected company inventory', () => {
  it('renders saved project counts and loads actual building units without fabricated cells', async () => {
    const a = api(),
      f = await setup(Projects, a);
    expect(f.nativeElement.textContent).toContain('Saved project');
    expect(f.nativeElement.textContent).not.toContain('Hillside Bay');
    await f.componentInstance.view(project);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(a.calls.some((c: any) => c.path === 'units' && c.q.buildingId === 'b1')).toBe(true);
    expect(f.nativeElement.querySelectorAll('.unit-cell').length).toBe(1);
    expect(f.nativeElement.textContent).toContain('2027');
  });
  it('filters units through API and preserves exact minor-unit prices', async () => {
    const a = api(),
      f = await setup(Units, a);
    expect(f.nativeElement.textContent).toContain('UNIT-REAL');
    expect(f.nativeElement.textContent).toContain('9007199254740993.00');
    f.componentInstance.setType('office');
    await f.whenStable();
    expect(a.calls.at(-1).q.type).toBe('office');
  });
  it('shows access failures without preview fallback or writable controls for read-only owners', async () => {
    const a = api();
    a.get = async () => {
      throw Error('Subscription unavailable');
    };
    const f = await setup(Projects, a, ['projects.read']);
    expect(f.nativeElement.textContent).toContain('Subscription unavailable');
    expect(f.nativeElement.textContent).not.toContain('New project');
    expect(f.componentInstance.projects().length).toBe(0);
  });
  it('saves unit form with exact EGP conversion, parent IDs, version and stable retry identity', async () => {
    const a = api(),
      f = await setup(InventoryEditor, a);
    f.componentRef.setInput('kind', 'unit');
    f.componentRef.setInput('record', unit);
    await f.componentInstance.ngOnInit();
    f.detectChanges();
    const c = f.componentInstance;
    await c.save();
    await c.save();
    const writes = a.calls.filter((x: any) => x.b);
    expect(writes[0].path).toBe('units/u1/update');
    expect(writes[0].b.priceMinor).toBe(unit.priceMinor);
    expect(writes[0].b.version).toBe(3);
    expect(writes[0].b.buildingId).toBe('b1');
    expect(writes[1].b.requestId).toBe(writes[0].b.requestId);
  });
  it('keeps unsaved records out of lists when persistence fails', async () => {
    const a = api();
    a.write = async () => {
      throw Error('Quota reached');
    };
    const f = await setup(InventoryEditor, a);
    f.componentRef.setInput('kind', 'project');
    const c = f.componentInstance;
    c.form = {
      ...c.form,
      code: 'NEW',
      name: 'New project',
      developer: 'Developer',
      location: 'Cairo',
    };
    let saved = false;
    c.saved.subscribe(() => (saved = true));
    await c.save();
    expect(c.error()).toBe('Quota reached');
    expect(saved).toBe(false);
  });
});
