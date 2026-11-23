import { AuthService } from '../../../auth.service';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MyTeam } from './my-team';
import { TeamApi } from '../../../team-api.service';
import { CompanyUiState } from '../company-ui-state';
const coldMetrics = {
  calls: 12,
  convertedToLeads: 3,
  overdueCallbacks: 2,
  outcomes: {
    no_answer: 4,
    busy: 1,
    wrong_number: 1,
    not_interested: 1,
    interested: 3,
    callback: 2,
  },
};
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
      coldCalls: { summary: coldMetrics, items: [{ ...member, ...coldMetrics }] },
      days: 30,
      from: '2026-10-16',
      to: '2026-11-14',
      timeZone: 'Africa/Cairo',
      canAssign: manage,
      canManageTasks: manage,
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
          version: 4,
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
    createTask: vi.fn(async (_body: any) => ({
      id: 'new-task',
      reference: 'TASK-NEW',
      version: 0,
      status: 'open',
    })),
    assignTask: vi.fn(async (_id: string, _body: any) => ({
      id: 'task-1',
      reference: 'TASK-REAL',
      version: 5,
      status: 'open',
    })),
    taskStatus: vi.fn(async (_id: string, _body: any) => ({
      id: 'task-1',
      reference: 'TASK-REAL',
      version: 5,
      status: 'done',
    })),
  };
  await TestBed.configureTestingModule({
    imports: [MyTeam],
    providers: [
      { provide: TeamApi, useValue: api },
      { provide: AuthService, useValue: { user: () => ({ company: { aiEnabled: true } }) } },
    ],
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
    expect(f.nativeElement.textContent).toContain('EGP 1.23456k');
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
  it('creates an assigned task with a team lead link and shows the saved task using its reference', async () => {
    const { f, c, api } = await setup();
    c.openTask('create');
    await f.whenStable();
    c.taskTitle = '  Call saved buyer  ';
    c.taskDescription = 'Discuss the viewing';
    c.taskAssignee = 'member';
    c.taskPriority = 'high';
    c.chooseTaskLead('lead-1');
    await c.saveTask();
    expect(api.createTask).toHaveBeenCalledWith({
      requestId: expect.any(String),
      title: 'Call saved buyer',
      description: 'Discuss the viewing',
      assigneeId: 'member',
      priority: 'high',
      dueDate: '2026-11-14',
      leadId: 'lead-1',
    });
    expect(c.taskMode()).toBeNull();
    expect(c.toast()).toContain('Task created');
    expect(api.workTasks.mock.calls.at(-1)?.[0]['q']).toBe('TASK-NEW');
    expect(api.performance).toHaveBeenCalledTimes(2);
  });
  it('reassigns a task using its current version and reloads the confirmed workload', async () => {
    const { c, api } = await setup();
    const row = (await api.workTasks({})).items[0];
    c.openTask('assign', row);
    c.taskAssignee = 'leader';
    await c.saveTask();
    expect(api.assignTask).toHaveBeenCalledWith('task-1', {
      requestId: expect.any(String),
      version: 4,
      assigneeId: 'leader',
    });
    expect(c.taskMode()).toBeNull();
    expect(c.toast()).toContain('Task assigned');
  });
  it('completes team tasks and requires a meaningful cancellation reason', async () => {
    const { c, api } = await setup();
    const row = (await api.workTasks({})).items[0];
    c.openTask('status', row, 'complete');
    await c.saveTask();
    expect(api.taskStatus).toHaveBeenCalledWith('task-1', {
      requestId: expect.any(String),
      version: 4,
      action: 'complete',
    });
    c.openTask('status', row, 'cancel');
    c.taskReason = 'short';
    await c.saveTask();
    expect(api.taskStatus).toHaveBeenCalledTimes(1);
    expect(c.taskError()).toContain('10');
    c.taskReason = 'Buyer requested a later appointment';
    await c.saveTask();
    expect(api.taskStatus.mock.calls.at(-1)?.[1].reason).toBe(
      'Buyer requested a later appointment',
    );
  });
  it('preserves a rejected task draft and keeps its request ID on an unchanged retry', async () => {
    const { c, api } = await setup();
    c.openTask('create');
    c.taskTitle = 'Keep this task draft';
    c.taskAssignee = 'member';
    api.createTask.mockRejectedValueOnce(Error('Connection interrupted'));
    await c.saveTask();
    expect(c.taskMode()).toBe('create');
    expect(c.taskTitle).toBe('Keep this task draft');
    expect(c.taskError()).toContain('Connection');
    await c.saveTask();
    expect(api.createTask.mock.calls[0][0].requestId).toBe(
      api.createTask.mock.calls[1][0].requestId,
    );
  });
  it('keeps stale status changes visible for refresh without inventing a completed state', async () => {
    const { c, api } = await setup();
    const row = (await api.workTasks({})).items[0];
    c.openTask('status', row, 'complete');
    api.taskStatus.mockRejectedValueOnce(Error('Task changed. Refresh before trying again.'));
    await c.saveTask();
    expect(c.taskRow()?.version).toBe(4);
    expect(c.taskMode()).toBe('status');
    expect(c.taskError()).toContain('Refresh');
    expect(c.toast()).toBe('');
    await c.refreshTask();
    expect(c.taskMode()).toBeNull();
    expect(api.performance).toHaveBeenCalledTimes(2);
  });
  it('hides task mutation controls and blocks create calls for read-only team leads', async () => {
    const { f, c, api } = await setup(false);
    c.changeTab('tasks');
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('+ New task');
    expect(f.nativeElement.querySelector('.task-actions button')).toBeNull();
    c.openTask('create');
    c.taskTitle = 'Forbidden';
    c.taskAssignee = 'member';
    await c.saveTask();
    expect(api.createTask).not.toHaveBeenCalled();
  });
});

describe('My team cold call performance', () => {
  it('renders saved per-member calls, all outcomes, overdue callbacks and lead conversions in both languages', async () => {
    const { f, c, api } = await setup();
    const section = f.nativeElement.querySelector('.cold-performance');
    expect(section.textContent).toContain('Cold calls performance');
    expect([...section.querySelectorAll('tbody td')].map((x: any) => x.textContent.trim())).toEqual(
      [
        expect.stringContaining('Actual member'),
        '12',
        expect.stringContaining('Callback requested'),
        '2',
        '3',
      ],
    );
    for (const outcome of [
      'No answer',
      'Busy',
      'Wrong number',
      'Not interested',
      'Interested',
      'Callback requested',
    ])
      expect(section.textContent).toContain(outcome);
    c.changeDays('7');
    await f.whenStable();
    f.detectChanges();
    expect(api.performance).toHaveBeenLastCalledWith(7);
    TestBed.inject(CompanyUiState).lang.set('ar');
    f.detectChanges();
    expect(section.textContent).toContain('أداء المكالمات الباردة');
    expect(section.textContent).toContain('المتابعات المتأخرة');
  });
  it('shows zero activity truthfully and clears performance on permission failure', async () => {
    const { f, c, api } = await setup();
    const zero = {
      calls: 0,
      convertedToLeads: 0,
      overdueCallbacks: 0,
      outcomes: {
        no_answer: 0,
        busy: 0,
        wrong_number: 0,
        not_interested: 0,
        interested: 0,
        callback: 0,
      },
    };
    api.performance.mockImplementationOnce(async () => ({
      ...(await api.performance(30)),
      coldCalls: { summary: zero, items: [{ ...member, ...zero }] },
    }));
    await c.reload();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cold-performance').textContent).toContain(
      'No calls logged in this period',
    );
    api.performance.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    await c.reload();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cold-performance')).toBeNull();
  });
});
