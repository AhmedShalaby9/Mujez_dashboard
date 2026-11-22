import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Subscriptions } from './pages/admin-shell/subscriptions/subscriptions';
import { SubscriptionsApi } from './subscriptions-api.service';
import { CompaniesApi } from './companies-api.service';
import { AdminUiState } from './pages/admin-shell/admin-ui-state';
afterEach(() => TestBed.resetTestingModule());
async function setup() {
  const api = {
    subscriptions: vi.fn(async () => []),
    plans: vi.fn(async () => []),
    create: vi.fn(async (_b: any) => ({ subId: 'new' })),
    action: vi.fn(async (_id: string, _a: string, _b: any) => ({ subId: 'sub' })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      { provide: SubscriptionsApi, useValue: api },
      {
        provide: CompaniesApi,
        useValue: {
          list: async () => [
            {
              id: 'company',
              nameEn: 'Office',
              status: 'active',
              aiEnabled: false,
              financeEnabled: false,
              hrEnabled: true,
            },
          ],
        },
      },
      { provide: AdminUiState, useValue: { lang: signal('en') } },
    ],
  });
  const f = TestBed.createComponent(Subscriptions);
  await f.whenStable();
  return { c: f.componentInstance, api, f };
}
describe('Custom subscription administration', () => {
  it('creates total-term contracts without selecting or quoting a plan', async () => {
    const { c, api } = await setup();
    c.openNewCustom();
    c.draft.companyId = 'company';
    c.selectCompanyModules();
    c.draft.amount = '12k';
    c.draft.years = 2;
    await c.createSubscription();
    expect(api.create).toHaveBeenCalledWith({
      companyId: 'company',
      status: 'active',
      payment: 'bank',
      customContract: { amountMinor: '1200000', durationMonths: 24 },
      aiEnabled: false,
      financeEnabled: false,
      hrEnabled: true,
    });
    expect(c.creating()).toBe(false);
  });
  it('updates versioned custom terms by explicit end date and independent modules', async () => {
    const { c, api } = await setup();
    c.openCustom({
      subId: 'sub',
      companyId: 'company',
      cycle: 'custom',
      version: 7,
      amountMinor: '1200000',
      payment: 'bank',
      renewsOn: '2028-01-01T00:00:00Z',
      durationMonths: 12,
    } as any);
    c.draft.durationMode = 'date';
    c.draft.endsOn = '2029-06-30';
    c.draft.amount = '24k';
    c.draft.aiEnabled = true;
    await c.createSubscription();
    expect(api.action).toHaveBeenCalledWith('sub', 'custom', {
      version: 7,
      amountMinor: '2400000',
      endsOn: '2029-06-30',
      aiEnabled: true,
      financeEnabled: false,
      hrEnabled: true,
    });
    expect(api.create).not.toHaveBeenCalled();
  });
});
