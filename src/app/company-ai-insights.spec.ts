import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TeamAiInsights } from './pages/company-shell/my-team/ai-insights/team-ai-insights';
import { SalesApi } from './sales-api.service';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService, companyGuard } from './auth.service';
const metric = (id: string, value: string, unit = 'count', memberKey?: string) => ({
  id,
  value,
  unit,
  label: { en: id, ar: id },
  ...(memberKey ? { memberKey } : {}),
});
const snapshot = {
  team: { id: 'private-team', name: 'Current team' },
  days: 30,
  from: '2026-10-17',
  to: '2026-11-15',
  previousFrom: '2026-09-17',
  previousTo: '2026-10-16',
  timeZone: 'Africa/Cairo',
  asOf: '2026-11-15T10:00:00Z',
  members: [
    {
      key: 'M01',
      id: 'member-id',
      name: 'Actual team member',
      status: 'active',
      role: 'agent',
      openLeads: 5,
      openTasks: 3,
      overdueTasks: 1,
      completedTasks: 2,
      won: 1,
      lost: 0,
      wonSalesMinor: '1000000000',
    },
  ],
  focusMembers: ['M01'],
  metrics: [
    metric('team.open_leads', '5'),
    metric('pipeline.sale_value', '1000000000', 'money'),
    metric('team.overdue_tasks', '1'),
    metric('period.win_rate', '50', 'percent'),
    metric('period.newLeads', '3'),
    metric('period.activities', '2'),
    metric('member.M01.overdueTasks', '1', 'count', 'M01'),
  ],
  stages: [{ stage: 'qualified', count: 5, saleMinor: '1000000000' }],
  sources: [{ source: 'manual', count: 3, won: 1 }],
  series: [{ date: '2026-11-15', newLeads: 3, won: 1, lost: 0, completedTasks: 2 }],
  hasData: true,
};
const complete = {
  id: 'run-id',
  status: 'succeeded',
  error: null,
  result: {
    snapshot,
    generatedAt: '2026-11-15T10:01:00Z',
    thinkingEnabled: true,
    report: {
      summary: 'Prioritize overdue work.',
      insights: [
        {
          category: 'tasks',
          tone: 'attention',
          title: 'Review overdue follow-ups',
          explanation: 'Confirm the next step with the responsible member.',
          metricIds: ['member.M01.overdueTasks'],
          memberKeys: ['M01'],
        },
      ],
      actions: [
        {
          priority: 'high',
          title: 'Review the queue',
          explanation: 'Review recorded tasks before adding assignments.',
          metricIds: ['team.overdue_tasks'],
          memberKeys: [],
        },
      ],
      limitations: ['Current team ownership applies.'],
    },
  },
};

const companySnapshot = {
  ...snapshot,
  team: undefined,
  focusTeams: ['T01', 'T02', 'T00'],
  metrics: snapshot.metrics
    .map((m) => ({ ...m, id: m.id.replace(/^team\./, 'company.') }))
    .concat([
      {
        id: 'team.T01.newLeads',
        value: '3',
        unit: 'count',
        label: { en: 'New leads', ar: 'عملاء جدد' },
        teamKey: 'T01',
      },
    ] as any),
  members: [
    {
      ...snapshot.members[0],
      teamId: 'team-a',
      winRate: '50',
      signedSalesMinor: '1200000000',
      openSaleMinor: '1000000000',
      newLeads: 3,
    },
    {
      ...snapshot.members[0],
      id: 'other-agent',
      key: 'M02',
      name: 'Second salesperson',
      overdueTasks: 3,
      wonSalesMinor: '800000000',
      signedSalesMinor: '900000000',
      openSaleMinor: '100000000',
      teamId: 'team-b',
      winRate: '25',
      newLeads: 2,
    },
    {
      ...snapshot.members[0],
      id: 'owner',
      key: 'M03',
      name: 'Company owner',
      role: 'company_owner',
      teamId: null,
    },
  ],
  teams: [
    {
      ...snapshot.members[0],
      id: 'team-a',
      key: 'T01',
      name: 'Eastern team',
      memberCount: 1,
      newLeads: 3,
      winRate: '50',
      signedSalesMinor: '1200000000',
      openSaleMinor: '1000000000',
    },
    {
      ...snapshot.members[0],
      id: 'team-b',
      key: 'T02',
      name: 'Western team',
      memberCount: 1,
      overdueTasks: 3,
      wonSalesMinor: '800000000',
      newLeads: 2,
      winRate: '25',
      signedSalesMinor: '900000000',
      openSaleMinor: '100000000',
    },
    {
      ...snapshot.members[0],
      id: null,
      key: 'T00',
      name: 'No team',
      memberCount: 1,
      newLeads: 0,
      winRate: '0',
      signedSalesMinor: '0',
      openSaleMinor: '0',
    },
  ],
};
const companyComplete = {
  ...complete,
  result: {
    ...complete.result,
    snapshot: companySnapshot,
    report: {
      ...complete.result.report,
      summary: 'Compare recorded workloads before changing priorities.',
      insights: [
        {
          category: 'teams',
          tone: 'attention',
          title: 'Review this team alongside the salesperson queue',
          explanation: 'Recorded workload supports a focused follow-up review.',
          metricIds: ['team.T01.newLeads', 'member.M01.overdueTasks'],
          memberKeys: ['M01'],
          teamKeys: ['T01'],
        },
      ],
      actions: [],
    },
  },
};
async function render() {
  let current: any = null;
  const api = {
    get: vi.fn(async (path: string) =>
      path.endsWith('/snapshot')
        ? companySnapshot
        : path === 'company-ai-insights'
          ? { run: current }
          : current,
    ),
    write: vi.fn(async (_path: string, _body: Record<string, unknown>) => ({
      id: 'run-id',
      status: 'processing',
      result: null,
      error: null,
    })),
  };
  await TestBed.configureTestingModule({
    imports: [TeamAiInsights],
    providers: [{ provide: SalesApi, useValue: api }],
  }).compileComponents();
  const f = TestBed.createComponent(TeamAiInsights);
  f.componentRef.setInput('scope', 'company');
  f.detectChanges();
  await f.whenStable();
  await vi.waitFor(() => {
    f.detectChanges();
    expect(f.componentInstance.loading()).toBe(false);
  });
  return { f, c: f.componentInstance, api, setCurrent: (r: any) => (current = r) };
}
describe('Company owner AI analytics', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('loads the company endpoint without paid calls and displays all team and salesperson comparisons', async () => {
    const { f, c, api } = await render();
    expect(api.get).toHaveBeenCalledWith('company-ai-insights/snapshot', { days: '30' });
    expect(api.write).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Company AI analytics');
    expect(f.nativeElement.textContent).toContain('Eastern team');
    expect(f.nativeElement.textContent).toContain('Western team');
    expect(f.nativeElement.textContent).toContain('No team / unassigned');
    expect(c.salespeople()).toHaveLength(2);
    expect(f.nativeElement.textContent).toContain('EGP 12m');
  });
  it('requests only a company-scoped report and resolves anonymous team and salesperson evidence locally', async () => {
    const { f, c, api, setCurrent } = await render();
    await c.generate();
    expect(api.write).toHaveBeenCalledWith('company-ai-insights', {
      requestId: expect.any(String),
      days: 30,
      language: 'en',
    });
    expect(JSON.stringify(api.write.mock.calls)).not.toContain('team-a');
    expect(JSON.stringify(api.write.mock.calls)).not.toContain('member-id');
    setCurrent(companyComplete);
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.summary').textContent).toContain(
      'Compare recorded workloads',
    );
    expect(f.nativeElement.querySelector('.insight').textContent).toContain('Eastern team');
    expect(f.nativeElement.querySelector('.insight').textContent).toContain('Actual team member');
    expect(f.nativeElement.querySelector('.evidence').textContent).toContain('3');
    expect(f.nativeElement.querySelector('.evidence').textContent).toContain('Eastern team');
    expect(f.nativeElement.querySelector('.evidence').textContent).toContain('Actual team member');
  });
  it('sorts comparison rows by the selected work metric without generating or changing records', async () => {
    const { c, api } = await render();
    expect(c.salespeople()[0].name).toBe('Actual team member');
    c.comparisonSort.set('overdueTasks');
    expect(c.salespeople()[0].name).toBe('Second salesperson');
    expect(c.companyTeams()[0].name).toBe('Western team');
    expect(api.write).not.toHaveBeenCalled();
  });
  it('guards the company-only route against employees and platform workspace sessions even with report permission', async () => {
    const user = signal<any>({
      pool: 'company_admin',
      role: 'company_owner',
      permissions: ['workspace.view', 'reports.read'],
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, restore: async () => true } },
      ],
    });
    const check = () =>
      TestBed.runInInjectionContext(() =>
        companyGuard({ data: { permission: 'reports.read', ownerOnly: true } } as any, {} as any),
      );
    expect(await check()).toBe(true);
    for (const p of [
      { pool: 'company_user', role: 'agent' },
      { pool: 'company_user', role: 'team_lead' },
      { pool: 'company_admin', role: 'company_owner', workspace: { mode: 'manage' } },
    ]) {
      user.set({ ...p, permissions: ['workspace.view', 'reports.read'] });
      expect(TestBed.inject(Router).serializeUrl((await check()) as any)).toBe(
        '/company/dashboard',
      );
    }
  });
});
