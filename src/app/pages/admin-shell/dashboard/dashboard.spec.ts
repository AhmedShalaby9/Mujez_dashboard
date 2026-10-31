import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { OverviewApi, overviewMoney } from '../../../overview-api.service';
import { AuthService } from '../../../auth.service';
const snapshot = (finance = true) => ({
  asOf: '2026-10-29T12:00:00Z',
  window: { range: '12m', from: '2025-11-01', to: '2026-10-29', bucket: 'month' },
  companies: {
    total: 3,
    pending: 0,
    active: 1,
    trial: 1,
    suspended: 1,
    archived: 0,
    added: 3,
    crmUsers: '2',
  },
  finance: finance
    ? {
        currency: 'EGP',
        mrrMinor: '10000',
        arrMinor: '120000',
        grossMinor: '15000',
        refundMinor: '5000',
        netMinor: '10000',
        series: [
          { date: '2026-10-01', grossMinor: '15000', refundMinor: '5000', netMinor: '10000' },
        ],
      }
    : null,
  plans: [
    { key: 'starter', name: { en: 'Starter', ar: 'Starter' }, companies: 2 },
    { key: 'pro', name: { en: 'Pro', ar: 'Pro' }, companies: 1 },
  ],
  growth: [
    {
      id: 'MJ-REAL',
      name: { en: 'Real company', ar: 'Real company' },
      createdAt: '2026-10-28T12:00:00Z',
      users: 2,
    },
  ],
  alerts: [
    {
      id: 'trial:1',
      kind: 'trial_ending',
      severity: 'med',
      nameEn: 'Real company',
      nameAr: 'Real company',
      value: '2026-10-30T12:00:00Z',
      path: '/admin/subscriptions',
    },
  ],
  sampleDataIncluded: false,
  capabilities: { companies: true, finance, historicalMrr: false, churn: false },
});
describe('Live overview', () => {
  it('loads actual statistics and refreshes with the chosen range and custom dates', async () => {
    const calls: any[] = [];
    const api = {
      alerts: signal([]),
      load: async (q: any) => {
        calls.push(q);
        return snapshot();
      },
    };
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: OverviewApi, useValue: api },
        { provide: AuthService, useValue: { user: signal({ name: 'Omar Mansour' }) } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Dashboard);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(f.nativeElement.textContent).toContain('Real company');
    expect(f.nativeElement.textContent).toContain('EGP 100.00');
    expect(c.donut()[0].pct).toBe(67);
    c.setRange('30d');
    await f.whenStable();
    expect(calls.at(-1)).toEqual({ range: '30d' });
    c.setRange('custom');
    c.from.set('2026-10-01');
    c.to.set('2026-10-29');
    await c.reload();
    expect(calls.at(-1)).toEqual({ range: 'custom', from: '2026-10-01', to: '2026-10-29' });
  });
  it('does not fabricate financial figures when the API redacts them and marks stale results on failure', async () => {
    let fail = false;
    const api = {
      alerts: signal([]),
      load: async () => {
        if (fail) throw Error('API unavailable');
        return snapshot(false);
      },
    };
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: OverviewApi, useValue: api },
        { provide: AuthService, useValue: { user: signal({ name: 'Omar Mansour' }) } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Dashboard);
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.kpis().some((k) => k.label === 'MRR')).toBe(false);
    expect(f.nativeElement.textContent).toContain('Billing permission');
    expect(f.componentInstance.bars()).toEqual([]);
    fail = true;
    await f.componentInstance.reload();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('stale');
  });
  it('formats large money values exactly and supports negative recorded net', () => {
    expect(overviewMoney('900719925474099399')).toBe('EGP 9,007,199,254,740,993.99');
    expect(overviewMoney('-10001')).toBe('-EGP 100.01');
  });
});
