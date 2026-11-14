import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MyTeam } from './my-team';
import { TeamApi } from '../../../team-api.service';
import { CompanyUiState } from '../company-ui-state';
const metrics = {
  leads: 2,
  openLeads: 1,
  newLeads: 2,
  won: 1,
  lost: 0,
  wonSalesMinor: '123456',
  openTasks: 3,
  overdueTasks: 1,
  completedTasks: 4,
};
const lead = {
  id: 'lead-1',
  reference: 'LEAD-REAL',
  name: { en: 'Saved buyer', ar: 'عميل محفوظ' },
  phone: '+12025550101',
  email: null,
  stage: 'new',
  version: 3,
  owner: { id: 'leader', name: 'Saved Leader' },
};
const member = {
  id: 'member',
  name: 'Actual member',
  email: 'member@example.test',
  role: 'agent',
  status: 'active',
  canAssign: true,
  ...metrics,
};
async function setup(manage = true, assigned = true) {
  const group = {
    id: 'team-1',
    name: 'Saved Team',
    leadUserId: 'leader',
    version: 0,
    members: [member],
  };
  const api = {
    myTeam: vi.fn(async () => ({ items: assigned ? [group] : [] })),
    performance: vi.fn(async (_days: number) => ({
      team: group,
      items: [member],
      summary: metrics,
      days: 30,
      from: '2026-10-16',
      to: '2026-11-14',
      timeZone: 'Africa/Cairo',
      canAssign: manage,
    })),
    workLeads: vi.fn(async (_q: Record<string, string>) => ({
      items: [lead],
      total: 51,
      page: 1,
      limit: 25,
    })),
    workTasks: vi.fn(async (_q: Record<string, string>) => ({
      items: [
        {
          id: 'task-1',
          reference: 'TASK-REAL',
          title: { en: 'Call buyer', ar: 'اتصل بالعميل' },
          status: 'open',
          priority: 'high',
          dueDate: '2026-11-01',
          overdue: true,
          assignee: { id: 'member', name: 'Actual member' },
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    })),
    assignLead: vi.fn(async (_id: string, _body: any) => ({ status: 'assigned' })),
  };
  await TestBed.configureTestingModule({
    imports: [MyTeam],
    providers: [{ provide: TeamApi, useValue: api }],
  }).compileComponents();
  const f = TestBed.createComponent(MyTeam);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, api };
}
describe('My team work and performance', () => {
  it('renders real per-member results and requests the selected performance period', async () => {
    const { f, c, api } = await setup();
    expect(f.nativeElement.textContent).toContain('Actual member');
    expect(f.nativeElement.textContent).toContain('EGP 1,234.56');
    c.changeDays('90');
    await f.whenStable();
    expect(api.performance).toHaveBeenLastCalledWith(90);
    TestBed.inject(CompanyUiState).lang.set('ar');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('الأداء');
    expect(f.nativeElement.querySelector('.pg').dir).toBe('rtl');
  });
  it('uses server filters and paging for team leads and tasks', async () => {
    const { f, c, api } = await setup();
    c.changeTab('leads');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Saved buyer');
    expect(c.pages()).toBe(3);
    c.memberId = 'member';
    c.state = 'new';
    c.search = 'buyer';
    c.filter();
    await f.whenStable();
    expect(api.workLeads).toHaveBeenLastCalledWith({
      page: '1',
      limit: '25',
      memberId: 'member',
      stage: 'new',
      q: 'buyer',
    });
    c.paginate(1);
    await f.whenStable();
    expect(api.workLeads.mock.calls.at(-1)?.[0]['page']).toBe('2');
    c.changeTab('tasks');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Call buyer');
    expect(f.nativeElement.textContent).toContain('Overdue');
    c.state = 'done';
    c.filter();
    await f.whenStable();
    expect(api.workTasks.mock.calls.at(-1)?.[0]['status']).toBe('done');
  });
  it('assigns using the row version and reloads confirmed data', async () => {
    const { c, api } = await setup();
    c.changeTab('leads');
    await TestBed.inject(TeamApi).workLeads({});
    c.openAssign(lead);
    c.targetChanged('member');
    await c.assign();
    expect(api.assignLead).toHaveBeenCalledWith('lead-1', {
      requestId: expect.any(String),
      ownerId: 'member',
      version: 3,
    });
    expect(c.selected()).toBeNull();
    expect(c.toast()).toContain('Lead assigned');
    expect(api.performance).toHaveBeenCalledTimes(2);
  });
  it('preserves rejected assignment input and reuses request IDs for an unchanged retry', async () => {
    const { c, api } = await setup();
    c.openAssign(lead);
    c.targetChanged('member');
    api.assignLead.mockRejectedValueOnce(Error('Lead changed. Refresh before trying again.'));
    await c.assign();
    expect(c.selected()?.version).toBe(3);
    expect(c.ownerId).toBe('member');
    expect(c.error()).toContain('Refresh');
    expect(c.toast()).toBe('');
    await c.assign();
    expect(api.assignLead.mock.calls[0][1].requestId).toBe(
      api.assignLead.mock.calls[1][1].requestId,
    );
  });
  it('does not expose assignment controls without write permission', async () => {
    const { f, c, api } = await setup(false);
    c.changeTab('leads');
    await f.whenStable();
    f.detectChanges();
    expect(
      [...f.nativeElement.querySelectorAll('button')].some(
        (x: any) => x.textContent.trim() === 'Assign',
      ),
    ).toBe(false);
    c.openAssign(lead);
    c.targetChanged('member');
    await c.assign();
    expect(api.assignLead).not.toHaveBeenCalled();
  });
  it('shows an unassigned state without requesting company-wide performance', async () => {
    const { f, api } = await setup(true, false);
    expect(f.nativeElement.textContent).toContain('No team assigned');
    expect(api.performance).not.toHaveBeenCalled();
  });
  it('clears team data when access is removed during refresh', async () => {
    const { c, api } = await setup();
    api.performance.mockRejectedValueOnce(
      Object.assign(new Error('Access unavailable'), { status: 403 }),
    );
    await c.reload();
    expect(c.performance()).toBeNull();
    expect(c.teams()).toEqual([]);
    expect(c.error()).toContain('Access unavailable');
  });
});
