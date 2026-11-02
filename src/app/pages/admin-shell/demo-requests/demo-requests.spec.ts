import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { DemoRequestsApi, type DemoRequest } from '../../../demo-requests-api.service';
import { AdminUiState } from '../admin-ui-state';
import { DemoRequests } from './demo-requests';
import { routes } from '../../../app.routes';
const row: DemoRequest = {
  id: 'uuid-a',
  reference: 'request-reference-a',
  fullName: 'Actual website requester',
  companyName: 'Saved brokerage',
  email: 'requester@example.test',
  phone: '+12025550187',
  plan: 'starter',
  cycle: 'annual',
  status: 'new',
  version: 3,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
};
async function setup(manage = true, fail = false) {
  const calls: any[] = [];
  let current = { ...row };
  const api = {
    list: async (page: number, status: string, q: string) => {
      calls.push({ page, status, q });
      return {
        items: [current],
        total: 79,
        page,
        limit: 25,
        summary: { all: 79, new: 54, contacted: 20, closed: 5 },
      };
    },
    status: async (r: DemoRequest, status: string) => {
      calls.push({ body: { version: r.version, status }, id: r.id });
      if (fail) throw Error('Enquiry changed. Refresh first.');
      current = { ...current, status: status as any, version: current.version + 1 };
      return { status, version: current.version };
    },
  };
  await TestBed.configureTestingModule({
    imports: [DemoRequests],
    providers: [
      {
        provide: AuthService,
        useValue: {
          user: signal({ permissions: manage ? ['co.view', 'co.create'] : ['co.view'] }),
        },
      },
      { provide: DemoRequestsApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(DemoRequests);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, calls };
}
describe('Admin demo request inbox', () => {
  it('renders saved contact details, server totals and real pagination, and searches on the server', async () => {
    const { f, c, calls } = await setup();
    expect(f.nativeElement.textContent).toContain('Saved brokerage');
    expect(f.nativeElement.textContent).toContain('79');
    expect(c.pages()).toBe(4);
    c.paginate(1);
    await f.whenStable();
    expect(calls.at(-1).page).toBe(2);
    c.search = 'company@example.test';
    c.applySearch();
    await f.whenStable();
    expect(calls.at(-1)).toEqual({ page: 1, status: 'all', q: 'company@example.test' });
    c.filter('closed');
    await f.whenStable();
    expect(calls.at(-1).status).toBe('closed');
  });
  it('persists contacted status using the current version and reloads confirmed data', async () => {
    const { f, c, calls } = await setup();
    c.open(c.items()[0]);
    await c.change(c.items()[0], 'contacted');
    f.detectChanges();
    expect(calls.some((x) => x.body?.version === 3 && x.body.status === 'contacted')).toBe(true);
    expect(c.items()[0].status).toBe('contacted');
    expect(c.selected()).toBe(null);
  });
  it('keeps rejected changes visible for review without inventing a new status', async () => {
    const { f, c } = await setup(true, true);
    c.open(c.items()[0]);
    await c.change(c.items()[0], 'closed');
    f.detectChanges();
    expect(c.items()[0].status).toBe('new');
    expect(c.selected()?.version).toBe(3);
    expect(c.error()).toContain('changed');
    expect(c.toast()).toBe('');
  });
  it('supports Arabic and keeps status actions unavailable to read-only administrators', async () => {
    const { f, c, calls } = await setup(false);
    TestBed.inject(AdminUiState).lang.set('ar');
    c.open(c.items()[0]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('طلبات الديمو');
    expect(f.nativeElement.textContent).toContain('لديك صلاحية عرض');
    expect(f.nativeElement.querySelector('.drawer__foot .btn--dark')).toBe(null);
    await c.change(c.items()[0], 'closed');
    expect(calls.some((x) => x.body)).toBe(false);
    expect(
      routes.find((r) => r.path === 'admin')?.children?.find((r) => r.path === 'demo-requests')
        ?.data?.['permission'],
    ).toBe('co.view');
  });
});
