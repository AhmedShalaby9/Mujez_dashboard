import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Commissions } from './pages/company-shell/commissions/commissions';
import { CompanyCommissionsApi } from './company-commissions-api.service';
import { AuthService } from './auth.service';
const row: any = {
  id: 'm1',
  contractId: 'c1',
  leadId: 'l1',
  deal: 'CT-REAL',
  unit: null,
  contact: { en: 'Actual buyer', ar: 'عميل' },
  contractStatus: 'draft',
  agreedValueMinor: '900719925474099300',
  grossMinor: '22517998136852483',
  rateBps: 250,
  lines: [
    {
      payeeId: null,
      who: { en: 'Company share', ar: 'حصة الشركة' },
      shareBps: 10000,
      amountMinor: '22517998136852483',
    },
  ],
  status: 'calculated',
  forecast: true,
  needsRecalculation: false,
  version: 1,
};
const contract: any = {
  id: 'c1',
  reference: 'CT-REAL',
  contact: row.contact,
  valueMinor: row.agreedValueMinor,
  status: 'draft',
  version: 3,
};
function mock() {
  const calls: any[] = [];
  return {
    calls,
    get: async (p: string, q: any) => {
      calls.push({ p, q });
      if (p === 'commissions')
        return { items: [row], total: 1, summary: { calculated: row.grossMinor } };
      if (p === 'commissions/m1') return row;
      if (p === 'commissions/options') return { payees: [{ id: 'owner', name: 'Actual owner' }] };
      if (p === 'contracts/c1') return contract;
      if (p === 'contracts') return { items: [contract], total: 1 };
      if (p === 'documents') return { items: [], total: 0 };
      throw Error(p);
    },
    write: async (p: string, b: any) => {
      calls.push({ p, b });
      return row;
    },
    money: (v: string) =>
      'EGP ' + (BigInt(v) / 100n).toString() + '.' + (BigInt(v) % 100n).toString().padStart(2, '0'),
  };
}
async function setup(
  api: any,
  permissions = ['commissions.read', 'commissions.manage', 'contracts.read', 'documents.read'],
): Promise<any> {
  await TestBed.configureTestingModule({
    imports: [Commissions],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user: signal({ permissions }) } },
      { provide: CompanyCommissionsApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(Commissions);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Company commissions', () => {
  it('renders exact server amounts, actual shares and unsigned forecasts without preview people', async () => {
    const api = mock(),
      f = await setup(api);
    expect(f.nativeElement.textContent).toContain('225179981368524.83');
    expect(f.nativeElement.textContent).toContain('Forecast');
    expect(f.nativeElement.textContent).not.toContain('Dina El Sayed');
    const approve = Array.from(f.nativeElement.querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Approve',
    ) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
  });
  it('calculates real contract versions and basis-point shares using precise decimal conversion', async () => {
    const api = mock(),
      f = await setup(api),
      c = f.componentInstance;
    await c.calculate();
    c.contractId = 'c1';
    await c.chooseContract();
    c.rate = '2.55';
    c.splits = [
      { payeeId: 'owner', pct: '40.25' },
      { payeeId: '', pct: '59.75' },
    ];
    await c.save();
    const b = api.calls.find((x) => x.b).b;
    expect(b.contractVersion).toBe(3);
    expect(b.rateBps).toBe(255);
    expect(b.splits[0].shareBps).toBe(4025);
    expect(b.splits[1].shareBps).toBe(5975);
  });
  it('records explicit manual payment details and evidence through the backend', async () => {
    const api = mock(),
      f = await setup(api),
      c = f.componentInstance;
    c.advance({ ...row, status: 'payable', forecast: false }, 'record_paid');
    c.receiptId = 'doc1';
    c.paidDate = '2026-10-30';
    c.reference = 'external-ref';
    c.reason = 'Recorded external receipt verification';
    await c.apply();
    const b = api.calls.find((x) => x.b).b;
    expect(b.action).toBe('record_paid');
    expect(b.documentId).toBe('doc1');
    expect(b.reference).toBe('external-ref');
    expect(b.version).toBe(1);
  });
  it('shows failed persistence without fictional data and respects read-only permissions', async () => {
    const api = mock();
    api.get = async () => {
      throw Error('Access unavailable');
    };
    const f = await setup(api, ['commissions.read']);
    expect(f.nativeElement.textContent).toContain('Access unavailable');
    expect(f.nativeElement.textContent).not.toContain('Calculate commission');
    expect(f.componentInstance.commissions().length).toBe(0);
  });
});
