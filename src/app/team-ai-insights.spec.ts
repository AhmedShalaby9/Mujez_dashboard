import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TeamAiInsights } from './pages/company-shell/my-team/ai-insights/team-ai-insights';
import { SalesApi } from './sales-api.service';
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
async function render(s: any = snapshot) {
  let current: any = null;
  const api = {
    get: vi.fn(async (path: string) =>
      path.endsWith('/snapshot')
        ? s
        : path === 'team/my-team/ai-insights'
          ? { run: current }
          : current,
    ),
    write: vi.fn(async (_path: string, _body: Record<string, unknown>) => ({ id: 'run-id', status: 'processing', result: null, error: null })),
  };
  await TestBed.configureTestingModule({
    imports: [TeamAiInsights],
    providers: [{ provide: SalesApi, useValue: api }],
  }).compileComponents();
  const f = TestBed.createComponent(TeamAiInsights);
  f.detectChanges();
  await f.whenStable();
  await vi.waitFor(() => {
    f.detectChanges();
    expect(f.componentInstance.loading()).toBe(false);
  });
  return { f, c: f.componentInstance, api, setCurrent: (r: any) => (current = r) };
}
describe('Team AI analytics', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('loads scoped metrics without paid requests and shows compact values and recorded breakdowns', async () => {
    const { f, api } = await render();
    expect(api.write).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('EGP 10m');
    expect(f.nativeElement.textContent).toContain('Qualified');
    expect(f.nativeElement.textContent).toContain('Actual team member');
  });
  it('starts only on demand, polls results and renders member focus with real evidence without mutating tasks', async () => {
    const { f, c, api, setCurrent } = await render();
    await c.generate();
    expect(api.write).toHaveBeenCalledWith('team/my-team/ai-insights', {
      requestId: expect.any(String),
      days: 30,
      language: 'en',
    });
    expect(JSON.stringify(api.write.mock.calls)).not.toContain('member-id');
    expect(JSON.stringify(api.write.mock.calls)).not.toContain('private-team');
    setCurrent(complete);
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Prioritize overdue work.');
    expect(f.nativeElement.textContent).toContain('Review overdue follow-ups');
    expect(f.nativeElement.querySelector('.member').textContent).toContain('Actual team member');
    expect(f.nativeElement.querySelector('.evidence').textContent).toContain('1');
    expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('shows stale and provider failure states without displaying an outdated report', async () => {
    const { c, f, setCurrent } = await render();
    await c.generate();
    setCurrent({
      id: 'run-id',
      status: 'failed',
      result: null,
      error: { code: 'provider_unavailable', message: 'Provider unavailable' },
    });
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Provider unavailable');
    expect(f.nativeElement.querySelector('.summary')).toBeNull();
    setCurrent({ id: 'run-id', status: 'stale', result: null, error: { code: 'data_changed' } });
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Team data changed.');
  });
  it('changes reporting periods without generating and discards responses from the old context', async () => {
    const { c, f, api } = await render();
    let resolve: any;
    api.get.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const old = c.load(7);
    await c.load(90);
    resolve({ ...snapshot, days: 7 });
    await old;
    expect(c.snapshot()?.days).toBe(30); // The newer mock snapshot wins; the delayed old period cannot replace it.
    expect(api.get).toHaveBeenCalledWith('team/my-team/ai-insights/snapshot', { days: '90' });
    expect(api.write).not.toHaveBeenCalled();
  });
  it('disables paid generation when no team work is recorded', async () => {
    const { c, f, api } = await render({ ...snapshot, hasData: false, stages: [], sources: [] });
    await c.generate();
    f.detectChanges();
    expect(api.write).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('.generate').disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('No recorded team work');
  });
  it('keeps the request ID after a network failure and escapes report text', async () => {
    const { c, f, api, setCurrent } = await render();
    api.write.mockRejectedValueOnce(new Error('Network interrupted'));
    await c.generate();
    await c.generate();
    expect(api.write.mock.calls[0][1]['requestId']).toBe(api.write.mock.calls[1][1]['requestId']);
    setCurrent({
      ...complete,
      result: {
        ...complete.result,
        report: { ...complete.result.report, summary: '<img src=x onerror=alert()>' },
      },
    });
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.summary img')).toBeNull();
    expect(f.nativeElement.querySelector('.summary').textContent).toContain('<img');
  });
});
