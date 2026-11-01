import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from './auth.service';
import { NotificationsApi } from './notifications-api.service';
describe('Persistent notification feed', () => {
  it('uses the current account pool, writes server read state and clears a previous account feed', async () => {
    const user = signal<any>({ id: 'a', pool: 'platform' }),
      calls: any[] = [];
    const auth = {
      user,
      request: async (path: string, body?: any) => {
        calls.push({ path, body });
        return path.includes('?')
          ? {
              items: [
                {
                  id: user().id,
                  kind: 'company.created',
                  title: 'Company created',
                  route: '/admin/companies',
                  createdAt: '2026-11-01T00:00:00Z',
                  readAt: null,
                },
              ],
              unread: 12,
              total: 12,
            }
          : { status: 'read' };
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    const service = TestBed.inject(NotificationsApi);
    await service.refresh();
    expect(service.unread()).toBe(12);
    await service.mark('a');
    expect(calls.some((c) => c.path === '/admin/api/v1/notifications/a/read')).toBe(true);
    user.set({ id: 'b', pool: 'company_admin' });
    await service.refresh();
    expect(service.items().map((x) => x.id)).toEqual(['b']);
    expect(calls.at(-1).path).toBe('/api/v1/notifications?page=1');
    await service.markAll();
    expect(calls.some((c) => c.path === '/api/v1/notifications/read-all')).toBe(true);
  });
  it('keeps unread state when the server rejects a read mutation', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'a', pool: 'platform' }),
            request: async (path: string) => {
              if (!path.includes('?')) throw Error('Permission changed');
              return { items: [], unread: 3, total: 3 };
            },
          },
        },
      ],
    });
    const service = TestBed.inject(NotificationsApi);
    await service.refresh();
    await expect(service.markAll()).rejects.toThrow('Permission changed');
    expect(service.unread()).toBe(3);
  });
});
