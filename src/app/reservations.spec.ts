import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Reservations } from './pages/company-shell/reservations/reservations';
import { ReservationsApi } from './reservations-api.service';
import { InventoryApi } from './inventory-api.service';
import { AuthService } from './auth.service';
const r: any = {
  id: 'r1',
  reference: 'RV-REAL',
  unitId: 'u1',
  unit: 'REAL-UNIT',
  leadId: 'l1',
  contact: { en: 'Real buyer', ar: 'عميل' },
  assignee: { id: 'owner', name: 'Actual owner' },
  status: 'hold',
  expiresAt: '2026-11-01T10:00:00Z',
  depositMinor: null,
  version: 1,
  asOf: '2026-10-30T10:00:00Z',
};
const u: any = {
  id: 'u1',
  code: 'REAL-UNIT',
  project: { en: 'Cairo', ar: 'القاهرة' },
  version: 4,
  status: 'available',
  archivedAt: null,
  priceMinor: '10000',
};
function mocks() {
  const calls: any[] = [];
  return {
    calls,
    api: {
      list: async (q: any) => {
        calls.push({ q });
        return { items: [r], total: 1, asOf: r.asOf };
      },
      write: async (path: string, b: any) => {
        calls.push({ path, b });
        return { ...r, status: b.action === 'confirm' ? 'reserved' : 'hold' };
      },
    },
    inventory: {
      money: (v: string) => 'EGP ' + v,
      get: async (path: string) =>
        path === 'units/u1'
          ? u
          : path === 'leads/options'
            ? { owners: [{ id: 'owner', name: 'Actual owner' }] }
            : {
                items:
                  path === 'units' ? [u] : [{ id: 'l1', name: r.contact, reference: 'L-REAL' }],
                total: 1,
              },
    },
  };
}
async function setup(
  m: any,
  permissions = ['reservations.read', 'reservations.manage', 'leads.read', 'units.read'],
) {
  await TestBed.configureTestingModule({
    imports: [Reservations],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: AuthService, useValue: { user: signal({ id: 'owner', permissions }) } },
      { provide: ReservationsApi, useValue: m.api },
      { provide: InventoryApi, useValue: m.inventory },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(Reservations);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Connected reservations', () => {
  it('renders real reservations with server expiry and sends filters to the backend', async () => {
    const m = mocks(),
      f = await setup(m);
    expect(f.nativeElement.textContent).toContain('Real buyer');
    expect(f.nativeElement.textContent).toContain('Actual owner');
    expect(f.nativeElement.textContent).not.toContain('Rana Farouk');
    f.componentInstance.filter('expired');
    await f.whenStable();
    expect(m.calls.at(-1).q.status).toBe('expired');
  });
  it('confirmation persists a precise recorded deposit with the current version', async () => {
    const m = mocks(),
      f = await setup(m),
      c = f.componentInstance;
    c.openConfirm(r);
    c.depositInput.set('9007199254740993.00');
    c.applyConfirm();
    await f.whenStable();
    const b = m.calls.find((x) => x.b).b;
    expect(b.depositMinor).toBe('900719925474099300');
    expect(b.version).toBe(1);
    expect(b.action).toBe('confirm');
  });
  it('retries a lost hold response with the same body even when the unit now appears held', async () => {
    const m = mocks(),
      f = await setup(m),
      c = f.componentInstance;
    await c.newHold();
    c.form = { unitId: 'u1', leadId: 'l1', assigneeId: 'owner', hours: 48 };
    let attempt = 0;
    m.api.write = async (path, b) => {
      m.calls.push({ path, b });
      if (++attempt === 1) throw Error('Network lost');
      return r;
    };
    await c.create();
    expect(c.createOpen()).toBe(true);
    m.inventory.get = async () => ({ ...u, status: 'hold', version: 5 });
    await c.create();
    const writes = m.calls.filter((x) => x.b);
    expect(writes.length).toBe(2);
    expect(writes[1].b).toEqual(writes[0].b);
    expect(c.createOpen()).toBe(false);
  });
  it('keeps permission and subscription failures visible without preview data or write controls', async () => {
    const m = mocks();
    m.api.list = async () => {
      throw Error('Access unavailable');
    };
    const f = await setup(m, ['reservations.read']);
    expect(f.nativeElement.textContent).toContain('Access unavailable');
    expect(f.nativeElement.textContent).not.toContain('New hold');
    expect(f.componentInstance.reservations().length).toBe(0);
  });
});
