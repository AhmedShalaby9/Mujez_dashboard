import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { OfficeMyTeam } from './office-my-team';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
const metrics = {
  openClients: 2,
  overdueCallbacks: 1,
  openTasks: 3,
  overdueTasks: 1,
  closedSales: 1,
  closedRentals: 2,
  newClients: 1,
  calls: 4,
  viewings: 1,
  completedTasks: 2,
  saleMinor: '123456789',
  monthlyRentMinor: '5000000',
};
const p = {
  team: { id: 't', name: 'Office Team' },
  items: [{ id: 'a', name: 'Office Sales', status: 'active', ...metrics }],
  summary: metrics,
  from: '2026-11-01',
  to: '2026-11-24',
  timeZone: 'Africa/Cairo',
};
const client = {
  id: 'c',
  code: 'CL-1',
  name: 'Office Buyer',
  phone: '+201000000000',
  status: 'viewing',
  owner: { name: 'Office Sales' },
};
afterEach(() => TestBed.resetTestingModule());
async function setup() {
  const request = vi.fn(async (path: string): Promise<any> =>
    path.includes('/performance?') ? p : { items: [client], total: 1 },
  );
  TestBed.configureTestingModule({
    imports: [OfficeMyTeam],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { request, user: signal({ role: 'team_lead' }) } },
    ],
  });
  const f = TestBed.createComponent(OfficeMyTeam);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
describe('Office My team', () => {
  it('renders office performance, requests filtered real clients and links to the office client', async () => {
    const { f, c, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Office Team');
    expect(f.nativeElement.textContent).toContain('Agreed monthly rents');
    expect(f.nativeElement.textContent).not.toContain('Cold calls');
    c.changeTab('clients');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Office Buyer');
    expect(f.nativeElement.querySelector('tbody a').getAttribute('href')).toBe(
      '/company/office/clients?clientId=c',
    );
    c.q = 'Saved buyer';
    c.memberId = 'a';
    c.status = 'viewing';
    c.apply();
    await f.whenStable();
    expect(request).toHaveBeenLastCalledWith(
      '/api/v1/office/my-team/clients?page=1&limit=25&q=Saved+buyer&status=viewing&memberId=a',
    );
    TestBed.inject(CompanyUiState).lang.set('ar');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('العملاء');
  });
  it('renders scoped task records and clears stale data if team access is revoked', async () => {
    const { f, c, request } = await setup();
    request.mockResolvedValueOnce({
      items: [
        {
          id: 'task',
          reference: 'T-1',
          title: { en: 'Office task', ar: 'مهمة المكتب' },
          status: 'open',
          dueDate: '2026-11-01',
          overdue: true,
          assignee: { name: 'Office Sales' },
        },
      ],
      total: 1,
    });
    c.changeTab('tasks');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Office task');
    expect(f.nativeElement.textContent).toContain('Overdue');
    request.mockRejectedValueOnce(Object.assign(new Error('No team assigned'), { status: 404 }));
    await c.reload();
    f.detectChanges();
    expect(c.performance()).toBeNull();
    expect(c.rows()).toEqual([]);
    expect(f.nativeElement.textContent).not.toContain('Office task');
  });
  it('ignores late list responses after switching to performance', async () => {
    const { c, request } = await setup();
    let resolve!: (r: any) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    c.changeTab('clients');
    c.changeTab('performance');
    resolve({ items: [client], total: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(c.rows()).toEqual([]);
    expect(c.listLoading()).toBe(false);
  });
});
