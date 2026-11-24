import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficePipeline } from './office-pipeline';
import { AuthService } from '../../../auth.service';
const client = {
  id: 'client',
  name: 'Real office buyer',
  code: 'CL-1',
  phone: '+201000000000',
  owner: { name: 'Sales' },
  status: 'new',
  version: 3,
  needs: { purpose: 'rent', rentBudgetMinor: null },
};
afterEach(() => TestBed.resetTestingModule());
async function setup(manage = true) {
  const request = vi.fn(async (path: string, body?: any): Promise<any> =>
    path.endsWith('/options')
      ? { staff: [] }
      : body
        ? { status: 'contacted', version: 4 }
        : { items: [client], total: 150, stats: [{ status: 'new', count: 150 }] },
  );
  TestBed.configureTestingModule({
    imports: [OfficePipeline],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({ permissions: manage ? ['leads.read', 'leads.manage'] : ['leads.read'] }),
          request,
        },
      },
    ],
  });
  const f = TestBed.createComponent(OfficePipeline);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
describe('Office client pipeline', () => {
  it('renders real office clients, exact server counts, unknown budgets and office links', async () => {
    const { f, c, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Real office buyer');
    expect(f.nativeElement.textContent).toContain('Not set');
    expect(c.count('new')).toBe(150);
    expect(f.nativeElement.querySelector('article a').getAttribute('href')).toBe(
      '/company/office/clients?clientId=client',
    );
    await c.move(client, 'contacted');
    expect(request).toHaveBeenCalledWith(
      '/api/v1/office/clients/client/stage',
      expect.objectContaining({ version: 3, data: { status: 'contacted' } }),
    );
  });
  it('never moves closed or read-only clients and retains data on a rejected update', async () => {
    const { c, request } = await setup();
    await c.move(client, 'closed');
    expect(request.mock.calls.filter((x) => x[1])).toHaveLength(0);
    request.mockRejectedValueOnce(new Error('Record changed'));
    await c.move(client, 'lost');
    expect(c.error()).toBe('Record changed');
    expect(c.rows()[0].status).toBe('new');
    const readonly = await (async () => {
      TestBed.resetTestingModule();
      return setup(false);
    })();
    await readonly.c.move(client, 'lost');
    expect(readonly.request.mock.calls.filter((x) => x[1])).toHaveLength(0);
  });
});
