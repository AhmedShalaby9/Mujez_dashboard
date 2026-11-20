import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HrResources } from './pages/company-shell/hr-resources/hr-resources';
import { AuthService, hasFinanceAccess } from './auth.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
async function setup(mode = 'my-advances') {
  const request = vi.fn(async (path: string, body?: any): Promise<any> => {
    if (body) return { id: 'saved' };
    if (path.endsWith('/context'))
      return {
        self: { id: 'staff' },
        canRequest: true,
        canFinance: mode === 'advances',
        canManageAssets: mode === 'assets',
        today: '2026-11-20',
      };
    if (path.endsWith('/options'))
      return { employees: [{ id: 'staff', name: 'Employee', code: 'EMP-0001' }] };
    return { items: [], total: 0, summary: { outstandingMinor: '1000000' }, stats: [] };
  });
  TestBed.configureTestingModule({
    imports: [HrResources],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { request, user: signal(null) } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { resourcesView: mode } } } },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
    ],
  });
  const fixture = TestBed.createComponent(HrResources);
  fixture.detectChanges();
  await fixture.componentInstance.reload();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, request };
}
afterEach(() => TestBed.resetTestingModule());
describe('HR resources', () => {
  it('loads employee scope and submits compact amounts exactly, without an employee selector', async () => {
    const { c, request, fixture } = await setup();
    expect(request.mock.calls.some(([p]) => p.includes('view=my'))).toBe(true);
    c.request();
    c.form = {
      amount: '10k',
      mode: 'monthly',
      installments: 3,
      firstDue: '2027-01-31',
      reason: 'Family expenses',
    };
    await c.save();
    const call = request.mock.calls.find(([, b]) => b?.amountMinor);
    expect(call?.[1]).toMatchObject({
      amountMinor: '1000000',
      installments: 3,
      firstDue: '2027-01-31',
    });
    expect(call?.[1]).not.toHaveProperty('employeeId');
    expect(c.dialog()).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('EGP 10k');
  });
  it('requires HR finance permission distinct from general HR access', () => {
    const base: any = {
      pool: 'company_user',
      role: 'hr_officer',
      roles: ['hr_officer', 'employee'],
      company: { hrEnabled: true },
      permissions: ['hr.read', 'hr.manage', 'leave.manage', 'leave.approve'],
    };
    expect(hasFinanceAccess(base)).toBe(false);
    expect(hasFinanceAccess({ ...base, roles: ['hr_manager', 'employee'] })).toBe(true);
    expect(hasFinanceAccess({ ...base, roles: ['hr_manager'], workspace: {} })).toBe(false);
  });
  it('keeps the dialog and shows API validation errors on failed repayment', async () => {
    const { c, request } = await setup('advances');
    c.selected.set({ id: 'advance', version: 4 });
    c.startAction('repay');
    c.form.amount = '2.5k';
    request.mockImplementationOnce(async () => {
      throw Error('Repayment exceeds balance');
    });
    await c.save();
    expect(c.dialog()).toBe('action');
    expect(c.formError()).toBe('Repayment exceeds balance');
    expect(request.mock.calls.at(-1)?.[1]).toMatchObject({
      version: 4,
      action: 'repay',
      amountMinor: '250000',
    });
  });
  it('creates company asset from the real API and assigns only selected employees', async () => {
    const { c, request } = await setup('assets');
    expect(c.options().employees[0].id).toBe('staff');
    c.selected.set({ id: 'asset', version: 3 });
    c.startAction('assign');
    c.form.employeeId = 'staff';
    c.form.condition = 'New with charger';
    await c.save();
    const call = request.mock.calls.find(([p, b]) => p.endsWith('/assets/asset/action') && b);
    expect(call?.[1]).toMatchObject({
      action: 'assign',
      employeeId: 'staff',
      version: 3,
      condition: 'New with charger',
    });
  });
  it('clears private data if access fails on refresh', async () => {
    const { c, request } = await setup();
    c.data.set({ items: [{ id: 'private' }], total: 1, summary: {}, stats: [] });
    request.mockImplementationOnce(async () => {
      throw Error('HR module disabled');
    });
    await c.reload();
    expect(c.data().items).toEqual([]);
    expect(c.context()).toBeNull();
  });
});
