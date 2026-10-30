import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Marketing } from './pages/company-shell/marketing/marketing';
import { LeadRouting } from './pages/company-shell/lead-routing/lead-routing';
import { Leads } from './pages/company-shell/leads/leads';
import { CompanyGrowthApi } from './company-growth-api.service';
import { AuthService } from './auth.service';
import { SalesApi } from './sales-api.service';
const campaign: any = {
  id: 'c1',
  name: { en: 'Registered campaign', ar: 'حملة مسجلة' },
  source: 'website',
  projectId: null,
  project: null,
  status: 'active',
  spendMinor: '101',
  leads: 2,
  deals: 0,
  saleValueMinor: '0',
  cplMinor: '51',
  version: 3,
  archivedAt: null,
};
const rule: any = {
  id: 'r1',
  name: { en: 'Saved roster rule', ar: 'قاعدة قائمة محفوظة' },
  source: 'website',
  segment: null,
  minBudgetMinor: null,
  strategy: 'round_robin',
  teamName: null,
  slaMinutes: 10,
  active: false,
  priority: '10',
  version: 3,
  archivedAt: null,
  targets: [{ userId: 'owner', name: 'Actual owner', weight: 1, active: true }],
};
function apiMock() {
  const calls: any[] = [];
  return {
    calls,
    get: async (p: string, q: any) => {
      calls.push({ p, q });
      if (p === 'marketing')
        return {
          items: [campaign],
          total: 1,
          totals: { spendMinor: '101', leads: 2, deals: 0, saleValueMinor: '0', cplMinor: '51' },
        };
      if (p === 'routing')
        return { items: [rule], worker: { healthy: true, lastSeenAt: '2026-10-30T10:00Z' } };
      if (p === 'routing/options') return { users: [{ id: 'owner', name: 'Actual owner' }] };
      throw Error(p);
    },
    write: async (p: string, b: any) => {
      calls.push({ p, b });
      return p === 'routing/simulate'
        ? { assignment: { userName: 'Actual owner', ruleName: rule.name }, advancesRotation: false }
        : rule;
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
async function setup(type: any, api: any, permissions: string[]): Promise<any> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user: signal({ id: 'owner', permissions }) } },
      { provide: CompanyGrowthApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(type);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Company marketing and routing', () => {
  it('renders real campaign counts and precise CPL without invented ad-network performance', async () => {
    const api = apiMock(),
      f = await setup(Marketing, api, ['marketing.read', 'marketing.manage']);
    expect(f.nativeElement.textContent).toContain('Registered campaign');
    expect(f.nativeElement.textContent).toContain('EGP 0.51');
    expect(f.nativeElement.textContent).not.toContain('Hillside Bay');
    f.componentInstance.statusFilter = 'ended';
    f.componentInstance.filter();
    await f.whenStable();
    expect(api.calls.at(-1).q.status).toBe('ended');
  });
  it('saves a real campaign registry with exact manually recorded spend', async () => {
    const api = apiMock(),
      f = await setup(Marketing, api, ['marketing.read', 'marketing.manage']),
      c = f.componentInstance;
    c.edit();
    c.form.name = 'New campaign';
    c.form.spend = '9007199254740993.00';
    await c.save();
    const b = api.calls.find((x) => x.b).b;
    expect(b.spendMinor).toBe('900719925474099300');
    expect(b.status).toBe('draft');
  });
  it('renders saved actual routing rosters and observed worker health', async () => {
    const api = apiMock(),
      f = await setup(LeadRouting, api, ['routing.read', 'routing.manage']);
    expect(f.nativeElement.textContent).toContain('Actual owner');
    expect(f.nativeElement.textContent).toContain('Healthy');
    expect(f.nativeElement.textContent).not.toContain('Dina El Sayed');
    f.componentInstance.simBudget.set('100.10');
    await f.componentInstance.simulate();
    const b = api.calls.find((x) => x.b).b;
    expect(b.budgetMinor).toBe('10010');
    expect(f.componentInstance.resultAgent()).toBe('Actual owner');
  });
  it('does not pretend a routing toggle succeeded when the backend rejects the version', async () => {
    const api = apiMock();
    api.write = async () => {
      throw Error('Rule changed');
    };
    const f = await setup(LeadRouting, api, ['routing.read', 'routing.manage']);
    await f.componentInstance.toggleActive(rule);
    await f.whenStable();
    expect(f.componentInstance.rules()[0].active).toBe(false);
    expect(f.componentInstance.error()).toBe('Rule changed');
  });
  it('keeps unavailable campaign statistics unknown and respects read-only permissions', async () => {
    const api = apiMock();
    api.get = async () => {
      throw Error('Subscription required');
    };
    const f = await setup(Marketing, api, ['marketing.read']);
    expect(f.componentInstance.totals()).toBe(null);
    expect(f.nativeElement.textContent).toContain('Subscription required');
    expect(f.nativeElement.textContent).not.toContain('New campaign');
  });
});
const lead: any = {
  id: 'l1',
  reference: 'L-REAL',
  name: { en: 'Actual buyer', ar: 'عميل' },
  phone: '+12025550101',
  segment: 'res',
  want: { en: 'Apartment', ar: 'شقة' },
  budgetMinor: null,
  source: 'website',
  owner: { id: 'owner', name: 'Actual owner' },
  stage: 'new',
  score: null,
  version: 0,
  archivedAt: null,
  campaign: null,
  firstContactAt: null,
  createdAt: '2026-10-30T10:00Z',
  updatedAt: '2026-10-30T10:00Z',
};
async function leadSetup() {
  let current = { ...lead };
  const calls: any[] = [];
  const api = {
    get: async (p: string) =>
      p === 'leads/options'
        ? { owners: [{ id: 'owner', name: 'Actual owner' }] }
        : p === 'leads'
          ? { items: [current], total: 1 }
          : p === 'marketing'
            ? { items: [campaign], total: 1 }
            : p.endsWith('/activities')
              ? { items: [], total: 0 }
              : current,
    write: async (p: string, b: any) => {
      calls.push({ p, b });
      if (p.endsWith('/contact'))
        current = { ...current, firstContactAt: '2026-10-30T11:00Z', version: 1 };
      return current;
    },
  };
  await TestBed.configureTestingModule({
    imports: [Leads],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({
            id: 'owner',
            permissions: ['leads.read', 'leads.manage', 'marketing.read'],
          }),
        },
      },
      { provide: SalesApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(Leads);
  f.detectChanges();
  await f.whenStable();
  return { f, calls };
}
describe('Lead campaign attribution and contact recording', () => {
  it('lets the server route automatically and sends an actual selected campaign', async () => {
    const { f, calls } = await leadSetup(),
      c = f.componentInstance;
    c.openNew();
    await f.whenStable();
    c.draft.name = 'Actual new buyer';
    c.draft.phone = lead.phone;
    c.draft.campaignId = 'c1';
    c.campaignChanged();
    await c.submit();
    const b = calls.find((x) => x.p === 'leads').b;
    expect(b.ownerId).toBeUndefined();
    expect(b.campaignId).toBe('c1');
    expect(b.source).toBe('website');
  });
  it('records explicit first contact through the backend and displays the returned timestamp', async () => {
    const { f, calls } = await leadSetup(),
      c = f.componentInstance;
    await c.open('l1');
    c.contactChannel.set('phone');
    c.contactNote.set('Actual external call recorded for verification');
    await c.recordContact();
    expect(calls[0].p).toBe('leads/l1/contact');
    expect(calls[0].b.channel).toBe('phone');
    expect(c.selected()?.firstContactAt).toBe('2026-10-30T11:00Z');
  });
});
