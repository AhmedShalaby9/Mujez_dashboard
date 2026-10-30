import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Tasks } from './pages/company-shell/tasks/tasks';
import { TasksApi, type CompanyTask } from './tasks-api.service';
import { AuthService } from './auth.service';
const task: CompanyTask = {
  id: 'task-id',
  reference: 'T-REAL',
  title: { en: 'Actual follow-up', ar: 'متابعة فعلية' },
  description: 'Actual description',
  lead: {
    id: 'lead-id',
    reference: 'L-REAL',
    name: { en: 'Actual Buyer', ar: 'مشتري' },
    archivedAt: null,
  },
  assignee: { id: 'owner', name: 'Actual Owner' },
  dueDate: '2026-10-30',
  group: 'today',
  overdue: false,
  priority: 'med',
  status: 'open',
  version: 2,
  completedAt: null,
  completedBy: null,
  createdBy: { id: 'owner', name: 'Actual Owner' },
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
  sample: false,
};
const user = () =>
  signal({ id: 'owner', permissions: ['tasks.read', 'tasks.manage', 'leads.read'] });
const route = {
  queryParamMap: of(convertToParamMap({})),
  snapshot: { queryParamMap: convertToParamMap({}) },
};
function mockApi() {
  let row = { ...task };
  const calls: any[] = [];
  return {
    calls,
    sales: {
      get: async (path: string) =>
        path === 'tasks/options'
          ? { assignees: [{ id: 'owner', name: 'Actual Owner' }] }
          : { items: [{ id: 'lead-id', name: task.lead!.name, reference: 'L-REAL' }], total: 1 },
    },
    list: async (q: any) => {
      calls.push({ kind: 'list', q });
      return {
        items: [row],
        total: 1,
        summary: { all: 1, today: 1 },
        today: '2026-10-30',
        asOf: '2026-10-30T10:00:00Z',
      };
    },
    get: async () => row,
    activity: async () => ({
      items: [
        { id: 'audit-id', action: 'task.created', actor: 'Actual Owner', at: task.createdAt },
      ],
      total: 1,
    }),
    write: async (path: string, b: any) => {
      calls.push({ kind: 'write', path, b });
      row = {
        ...row,
        version: row.version + 1,
        status: b.action === 'complete' ? 'done' : b.action === 'reopen' ? 'open' : row.status,
        title: { en: b.title ?? row.title.en, ar: b.titleAr ?? row.title.ar },
      };
      return row;
    },
  };
}
describe('Connected company tasks', () => {
  it('renders actual tasks, actual assignees and server date groups; filters are sent to the API', async () => {
    const api = mockApi();
    await TestBed.configureTestingModule({
      imports: [Tasks],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: { user: user() } },
        { provide: TasksApi, useValue: api },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Tasks);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Actual follow-up');
    expect(f.nativeElement.textContent).toContain('Actual Buyer');
    expect(f.nativeElement.textContent).not.toContain('Mona Sami');
    const c = f.componentInstance;
    c.groupFilter.set('overdue');
    c.ownerFilter.set('owner');
    await c.reload();
    expect(api.calls.at(-1).q).toMatchObject({ group: 'overdue', assigneeId: 'owner' });
    expect(c.today()).toBe('2026-10-30');
  });
  it('persists completion and reopening with versions, rather than toggling local data', async () => {
    const api = mockApi();
    await TestBed.configureTestingModule({
      imports: [Tasks],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: { user: user() } },
        { provide: TasksApi, useValue: api },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Tasks);
    await f.whenStable();
    const c = f.componentInstance;
    await c.action(c.tasks()[0], 'complete');
    expect(api.calls.find((x) => x.kind === 'write').b).toMatchObject({
      version: 2,
      action: 'complete',
    });
    expect(c.tasks()[0].status).toBe('done');
    await c.action(c.tasks()[0], 'reopen');
    expect(c.tasks()[0].status).toBe('open');
  });
  it('creates a lead-linked task with a stable form request ID and actual server date', async () => {
    const api = mockApi();
    await TestBed.configureTestingModule({
      imports: [Tasks],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: { user: user() } },
        { provide: TasksApi, useValue: api },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Tasks);
    await f.whenStable();
    const c = f.componentInstance;
    await c.openForm();
    expect(c.draft.dueDate).toBe('2026-10-30');
    c.draft.title = 'New linked follow-up';
    c.draft.leadId = 'lead-id';
    await c.save();
    const call = api.calls.find((x) => x.kind === 'write');
    expect(call.b).toMatchObject({
      title: 'New linked follow-up',
      leadId: 'lead-id',
      assigneeId: 'owner',
      dueDate: '2026-10-30',
    });
    expect(call.b.requestId).toBeTruthy();
    await f.whenStable();
    expect(c.dialog()).toBe(false);
  });
  it('does not fabricate records on an API failure or show write controls without permission', async () => {
    const api = mockApi();
    api.list = async () => {
      throw Error('Subscription required');
    };
    const u = user();
    u.set({ ...u(), permissions: ['tasks.read'] });
    await TestBed.configureTestingModule({
      imports: [Tasks],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: { user: u } },
        { provide: TasksApi, useValue: api },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Tasks);
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.tasks()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('Subscription required');
    expect(f.nativeElement.textContent).not.toContain('+ New task');
  });
});
