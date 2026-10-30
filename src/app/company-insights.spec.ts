import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Reports } from './pages/company-shell/reports/reports';
import { AuditLog } from './pages/company-shell/audit-log/audit-log';
import { Dashboard } from './pages/company-shell/dashboard/dashboard';
import { CompanyInsightsApi, volumePercent } from './company-insights-api.service';
import { InventoryApi } from './inventory-api.service';
import { AuthService } from './auth.service';
const money = (v: string | null) =>
  v === null
    ? '—'
    : 'EGP ' + (BigInt(v) / 100n).toString() + '.' + (BigInt(v) % 100n).toString().padStart(2, '0');
const report = {
  asOf: '2026-10-30T10:00:00Z',
  from: '2026-10-01',
  to: '2026-10-30',
  timeZone: 'Africa/Cairo',
  volume: [{ month: '2026-10', deals: 1, valueMinor: '900719925474099300' }],
  funnel: [{ key: 'new', count: 1 }],
  sources: [{ key: 'website', leads: 0, won: 0, conversion: null }],
  owners: [
    { id: 'u1', name: 'Actual owner', leads: 1, deals: 1, saleValueMinor: '900719925474099300' },
  ],
  summary: {
    leads: 1,
    signedSales: 1,
    signedSaleValueMinor: '900719925474099300',
    recordedPaidCommissionMinor: null,
  },
};
async function setup(type: any, api: any, permissions: string[] = []): Promise<any> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [
      provideRouter([]),
      { provide: CompanyInsightsApi, useValue: api },
      { provide: AuthService, useValue: { user: signal({ permissions }) } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(type);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Company insights', () => {
  it('shows exact saved report values, unknown conversion, and reloads the selected real period', async () => {
    const calls: any[] = [];
    const f = await setup(Reports, {
      money,
      get: async (p: string, q: any) => {
        calls.push({ p, q });
        return report;
      },
    });
    expect(f.nativeElement.textContent).toContain('9007199254740993.00');
    expect(f.nativeElement.textContent).toContain('Actual owner');
    expect(f.nativeElement.textContent).toContain('—');
    expect(f.nativeElement.textContent).not.toContain('Dina El Sayed');
    await f.componentInstance.load('ytd');
    expect(calls.at(-1).q.period).toBe('ytd');
    expect(f.componentInstance.canExport()).toBe(false);
  });
  it('keeps failed reports unknown instead of replacing them with preview statistics', async () => {
    const f = await setup(Reports, {
      money,
      get: async () => {
        throw Error('Subscription required');
      },
    });
    expect(f.componentInstance.data()).toBe(null);
    expect(f.nativeElement.textContent).toContain('Subscription required');
    expect(f.nativeElement.querySelector('.bars')).toBeNull();
  });
  it('scales large exact financial chart values without converting money to floating point', () => {
    expect(
      volumePercent('900719925474099300', [
        { month: 'x', deals: 1, valueMinor: '900719925474099300' },
      ]),
    ).toBe(100);
    expect(volumePercent('0', [{ month: 'x', deals: 0, valueMinor: '0' }])).toBe(0);
  });
  it('applies server audit filters, loads a real detail, and paginates with the opaque cursor', async () => {
    const calls: any[] = [];
    const entry = {
      id: 'a1',
      actor: null,
      action: 'task.created',
      resourceType: 'task',
      resourceId: 't1',
      before: null,
      after: { title: 'Actual task' },
      at: '2026-10-30T10:00:00Z',
    };
    const api = {
      get: async (p: string, q: any) => {
        calls.push({ p, q });
        return p.endsWith('/options')
          ? { actors: [{ id: null, name: null }], actions: ['task.created'] }
          : p.endsWith('/a1')
            ? entry
            : {
                items: [{ ...entry, id: q.cursor ? 'a2' : 'a1' }],
                total: 2,
                nextCursor: q.cursor ? null : 'opaque-microsecond-cursor',
                asOf: 'now',
              };
      },
    };
    const f = await setup(AuditLog, api),
      c = f.componentInstance;
    expect(f.nativeElement.textContent).toContain('System');
    await c.load(true);
    expect(c.entries().map((e: any) => e.id)).toEqual(['a1', 'a2']);
    expect(calls.at(-1).q.cursor).toBe('opaque-microsecond-cursor');
    c.actionFilter = 'task.created';
    await c.load();
    expect(calls.at(-1).q.action).toBe('task.created');
    expect(c.entries().length).toBe(1);
    await c.open(entry);
    expect(c.selected().after.title).toBe('Actual task');
  });
  it('renders real overview zeros and links without sample people or fake targets', async () => {
    const calls: any[] = [];
    const d = {
      asOf: 'now',
      today: '2026-10-30',
      timeZone: 'Africa/Cairo',
      metrics: {
        pipeline: { saleValueMinor: '12345', saleCount: 1, leaseCount: 0 },
        todayTasks: 0,
        newLeads7d: 2,
      },
      todayTasks: [],
      scoredLeads: [],
      keyDates: [],
      inventory: { available: 3, hold: 0, reserved: 0, under_contract: 0, sold: 0 },
      chart: report.volume,
      attentionLeads: [],
      alerts: [{ id: 'overdue-tasks', count: 2, route: '/company/tasks' }],
    };
    const f = await setup(Dashboard, {
      money,
      get: async (p: string, q: any) => {
        calls.push({ p, q });
        return d;
      },
    });
    expect(f.nativeElement.textContent).toContain('123.45');
    expect(f.nativeElement.textContent).toContain('Overdue open tasks');
    expect(f.nativeElement.textContent).not.toContain('186.4M');
    expect(f.nativeElement.textContent).not.toContain('Recorded paid commissions');
    await f.componentInstance.load('com');
    expect(calls.at(-1).q.segment).toBe('com');
  });
  it('uses canonical API paths and exports through the shared write request mechanism', async () => {
    const get = vi.fn(async () => report),
      write = vi.fn(async () => ({ content: 'real', fileName: 'report.csv' }));
    TestBed.configureTestingModule({
      providers: [{ provide: InventoryApi, useValue: { get, write, money } }],
    });
    const api = TestBed.inject(CompanyInsightsApi);
    await api.get('/reports', { period: 'month' });
    await api.exportReport('month', 'en');
    expect(get).toHaveBeenCalledWith('reports', { period: 'month' });
    expect(write).toHaveBeenCalledWith('reports/export', { period: 'month', lang: 'en' });
  });
});
