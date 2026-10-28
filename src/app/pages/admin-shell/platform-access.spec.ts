import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../auth.service';
import { PlatformUsers } from './platform-users/platform-users';
import { RolesPermissions } from './roles-permissions/roles-permissions';

describe('Platform access screens', () => {
  it('loads real accounts, identifies the signed-in user and retains the dialog when reauthentication fails', async () => {
    const calls: Array<[string, any]> = [];
    const api = {
      user: signal({ id: 'root', role: 'super_admin' }),
      request: async (path: string, body?: any) => {
        calls.push([path, body]);
        if (body) throw Error('Password verification failed');
        if (path.endsWith('/roles'))
          return {
            roles: [
              { key: 'super_admin', nameEn: 'Super Admin', nameAr: 'Super Admin' },
              { key: 'support_admin', nameEn: 'Support Admin', nameAr: 'Support Admin' },
            ],
          };
        return {
          items: [
            {
              id: 'root',
              name: 'Actual Root',
              email: 'root@example.test',
              role: 'super_admin',
              status: 'active',
              mfaEnabled: null,
              lastLogin: null,
              version: 0,
              activeSessions: 2,
            },
            {
              id: 'staff',
              name: 'Real Staff',
              email: 'staff@example.test',
              role: 'support_admin',
              status: 'active',
              version: 3,
              activeSessions: 1,
            },
          ],
          total: 2,
        };
      },
    };
    await TestBed.configureTestingModule({
      imports: [PlatformUsers],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(PlatformUsers);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(c.isMe(c.users()[0])).toBe(true);
    expect(c.kpis().mfaOff).toBe(3);
    expect(f.nativeElement.textContent).toContain('Actual Root');
    c.askRevoke(c.users()[1]);
    c.password.set('incorrect');
    c.reason.set('Verify revoked sessions');
    await c.confirmRevoke();
    expect(c.revoking()).not.toBeNull();
    expect(c.error()).toContain('verification failed');
    expect(calls.at(-1)).toEqual([
      '/admin/api/v1/platform-users/staff/revoke',
      { version: 3, password: 'incorrect', reason: 'Verify revoked sessions' },
    ]);
  });
  it('loads backend roles and submits versioned permission changes only after explicit reauthentication', async () => {
    const calls: Array<[string, any]> = [];
    const api = {
      user: signal({ id: 'root', role: 'super_admin' }),
      request: async (path: string, body?: any) => {
        calls.push([path, body]);
        if (body) return { status: 'updated' };
        return {
          permissions: [{ key: 'health', labelEn: 'System health', labelAr: 'System health' }],
          roles: [
            {
              key: 'custom-real',
              nameEn: 'Real Observer',
              nameAr: 'Real Observer',
              locked: false,
              system: false,
              members: 2,
              permissions: [],
              version: 4,
            },
          ],
        };
      },
    };
    await TestBed.configureTestingModule({
      imports: [RolesPermissions],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(RolesPermissions);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(f.nativeElement.textContent).toContain('2 members');
    c.toggle(c.roles()[0], c.permissions()[0]);
    expect(calls.length).toBe(1);
    c.grantCode.set('current-password');
    c.reason.set('Enable health monitoring');
    await c.confirmGrant();
    expect(calls[1]).toEqual([
      '/admin/api/v1/roles/custom-real/permission',
      {
        version: 4,
        permission: 'health',
        enabled: true,
        password: 'current-password',
        reason: 'Enable health monitoring',
      },
    ]);
    expect(c.grantCode()).toBe('');
  });
});
