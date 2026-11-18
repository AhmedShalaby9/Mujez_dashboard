import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Leave } from './pages/company-shell/leave/leave';
import { AuthService, hasLeaveSelf, managesLeave, companyGuard } from './auth.service';
import { RUNTIME_CONFIG } from './runtime-config';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
const today = new Date().toISOString().slice(0, 10),
  year = Number(today.slice(0, 4));
const ctx = {
  self: { id: 'employee', name: 'Actual Employee', status: 'active' },
  hasSelfRole: true,
  canRequest: true,
  isManager: false,
  isHr: false,
  canFinalize: false,
  today,
};
const policy = {
  configured: true,
  annualDays: 20,
  weekends: [5, 6],
  holidays: [],
  carryLimitDays: 5,
  carryExpiry: '03-31',
  version: 2,
};
const balance = {
  year,
  annualDays: 20,
  carryDays: 0,
  carryExpiry: year + '-03-31',
  availableDays: 18,
  usedDays: 0,
  upcomingDays: 2,
  pendingDays: 0,
  expiredCarryDays: 0,
};
async function setup(mode = 'my', more: any = {}) {
  const request = vi.fn(async (path: string, b?: any): Promise<any> => {
    if (b) return { id: 'saved-request', year, version: 1, status: 'pending_manager' };
    if (path.includes('/context')) return { ...ctx, ...more };
    if (path.includes('/policy')) return policy;
    if (path.includes('/options')) return { employees: [ctx.self] };
    if (path.includes('/balance?')) return balance;
    return { items: [], total: 0 };
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          request,
          user: signal({
            pool: 'company_user',
            role: 'employee',
            roles: ['employee'],
            permissions: ['leave.self'],
          }),
        },
      },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { leaveView: mode } } } },
      { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
    ],
  });
  const f = TestBed.createComponent(Leave);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
afterEach(() => TestBed.resetTestingModule());
describe('Annual leave workspace', () => {
  it('renders the real balance and uses the self-service scope', async () => {
    const { f, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Available days');
    expect(f.nativeElement.textContent).toContain('18');
    expect(request.mock.calls.some(([path]) => path.includes('view=my'))).toBe(true);
    expect(request.mock.calls.every(([, b]) => b === undefined)).toBe(true);
  });
  it('explains the required employee-account link instead of exposing another employee', async () => {
    const { f, c, request } = await setup('my', { self: null, canRequest: false });
    expect(f.nativeElement.textContent).toContain('Ask HR to link your login');
    expect(request.mock.calls.some(([path]) => path.includes('/balance?'))).toBe(false);
    expect(c.context().self).toBeNull();
  });
  it('submits dates for the linked employee without trusting a client day count', async () => {
    const { c, request } = await setup();
    c.openRequest();
    c.form.startDate = '2027-01-10';
    c.form.endDate = '2027-01-11';
    c.form.reason = 'Annual break';
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/leave/requests',
      expect.objectContaining({
        employeeId: 'employee',
        startDate: '2027-01-10',
        endDate: '2027-01-11',
        half: null,
        reason: 'Annual break',
      }),
    );
    const b = request.mock.calls.find(([path]) => path === '/api/v1/leave/requests')?.[1];
    expect(b.days).toBeUndefined();
    expect(c.modal()).toBeNull();
  });
  it('does not create a duplicate request when retrying a failed attachment', async () => {
    const { c, request } = await setup();
    c.openRequest();
    c.form.startDate = '2027-01-10';
    c.form.endDate = '2027-01-10';
    c.file = new File(['private file'], 'leave.txt', { type: 'text/plain' });
    const original = request.getMockImplementation()!;
    let attachments = 0;
    request.mockImplementation(async (path, b) => {
      if (path.endsWith('/attachment') && ++attachments === 1) throw new Error('Upload failed');
      return original(path, b);
    });
    await c.save();
    expect(c.created.id).toBe('saved-request');
    expect(c.modal()).toBe('request');
    expect(c.formError()).toContain('Request saved');
    await c.save();
    expect(
      request.mock.calls.filter(([path, b]) => path === '/api/v1/leave/requests' && !!b),
    ).toHaveLength(1);
    expect(c.modal()).toBeNull();
  });
  it('posts the observed request version and keeps an approval conflict visible', async () => {
    const { c, request } = await setup('approvals', { isManager: true });
    c.openAction({ id: 'request', version: 4, days: 1 }, 'manager_approve');
    request.mockRejectedValueOnce(new Error('Request changed. Refresh first'));
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/leave/requests/request/action',
      expect.objectContaining({ version: 4, action: 'manager_approve' }),
    );
    expect(c.modal()).toBe('action');
    expect(c.formError()).toContain('Refresh');
  });
  it('allows HR Officer to read policy but only final approvers can change it', async () => {
    const { f, c, request } = await setup('manage', { isHr: true, canFinalize: false });
    await c.switchTab('policy');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Only the company owner or HR Manager');
    await c.savePolicy();
    expect(request.mock.calls.some(([path, b]) => path === '/api/v1/leave/policy' && !!b)).toBe(
      false,
    );
  });
  it('keeps Employee leave separate from HR administration and routes self-only accounts to My leave', () => {
    const employee = {
      id: 'user',
      name: 'Employee',
      email: 'e@example.test',
      pool: 'company_user',
      role: 'employee',
      roles: ['employee'],
      permissions: ['leave.self'],
    };
    expect(hasLeaveSelf(employee)).toBe(true);
    expect(managesLeave(employee)).toBe(false);
    TestBed.configureTestingModule({
      providers: [{ provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } }],
    });
    const auth = TestBed.inject(AuthService);
    auth.user.set(employee);
    expect(auth.homePath()).toBe('/company/my-leave');
  });
});
