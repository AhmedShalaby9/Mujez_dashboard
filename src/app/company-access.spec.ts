import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { AuthService, adminGuard, companyGuard } from './auth.service';
import { RUNTIME_CONFIG } from './runtime-config';
import { CompanyShell } from './pages/company-shell/company-shell';
import { Companies } from './pages/admin-shell/companies/companies';
import { CompaniesApi } from './companies-api.service';
const owner = {
  id: 'owner-id',
  name: 'Actual Owner',
  email: 'actual@example.test',
  role: 'company_owner',
  pool: 'company_admin',
  permissions: ['workspace.view'],
  companyId: 'trusted-company',
  company: {
    id: 'MJ-REAL',
    slug: 'real',
    name: { en: 'Actual Company', ar: 'شركة فعلية' },
    status: 'pending',
  },
};
describe('Company and platform login routing', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses shared secure-session login and redirects according to the restored identity', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', async (url: string, options: any) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => (url.endsWith('/session') ? owner : { status: 'authenticated' }),
      };
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
      ],
    });
    const auth = TestBed.inject(AuthService);
    await auth.login('actual@example.test', 'test-password', false);
    expect(calls[0].url).toBe('https://api.example.test/api/v1/auth/login');
    expect(calls[0].options.credentials).toBe('include');
    expect(auth.homePath()).toBe('/company/dashboard');
    expect(auth.user()?.companyId).toBe('trusted-company');
    auth.user.set({ ...owner, pool: 'platform' });
    expect(auth.homePath()).toBe('/admin/dashboard');
    await auth.logout();
    expect(auth.user()).toBeNull();
    expect(calls.at(-1).url).toContain('/api/v1/auth/logout');
  });
  it('blocks anonymous access and separates company routes from platform routes in both directions', async () => {
    const user = signal<any>(null);
    let valid = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, restore: async () => valid } },
      ],
    });
    const check = async (guard: any, route: any = { data: {} }) =>
      TestBed.runInInjectionContext(() => guard(route, {}));
    const path = (r: any) => TestBed.inject(Router).serializeUrl(r as UrlTree);
    expect(path(await check(companyGuard))).toBe('/');
    expect(path(await check(adminGuard))).toBe('/');
    valid = true;
    user.set(owner);
    expect(await check(companyGuard)).toBe(true);
    expect(path(await check(adminGuard))).toBe('/company/dashboard');
    user.set({ ...owner, pool: 'platform', role: 'platform_admin' });
    expect(path(await check(companyGuard))).toBe('/admin/dashboard');
    expect(await check(adminGuard)).toBe(true);
    user.set({ ...owner, permissions: [] });
    expect(path(await check(companyGuard))).toBe('/');
    user.set({ ...owner, pool: 'company_user', role: 'agent' });
    expect(await check(companyGuard)).toBe(true);
    expect(path(await check(companyGuard, { data: { permission: 'team.manage' } }))).toBe(
      '/company/dashboard',
    );
  });
});
describe('Company owner workspace identity', () => {
  it('uses the actual company and owner, removes fake badges and notifications, connects company routes and signs out', async () => {
    const user = signal(owner);
    const logout = vi.fn(async () => {});
    await TestBed.configureTestingModule({
      imports: [CompanyShell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, logout, watched: signal(0) } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(CompanyShell);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Actual Company');
    expect(f.nativeElement.textContent).toContain('Actual Owner');
    expect(f.nativeElement.textContent).toContain('Company Owner');
    expect(f.nativeElement.textContent).not.toContain('design previews');
    expect(f.nativeElement.textContent).not.toContain('Horizon Realty');
    expect(f.nativeElement.querySelector('.sidebar__itemCount')).toBeNull();
    expect(f.componentInstance.notifications()).toEqual([]);
    await f.componentInstance.signOut();
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
describe('Company navigation redesign', () => {
  it.each(['agent', 'team_lead'])(
    'keeps %s navigation limited to sales access after the redesign',
    async (role) => {
      const pages = [
        'pipeline',
        'leads',
        'contacts',
        'calendar',
        'tasks',
        'reservations',
        'contracts',
        'commissions',
        'documents',
      ];
      const permissions = [
        'workspace.view',
        'projects.read',
        'units.read',
        ...pages.map((page) => page + '.read'),
        ...(role === 'team_lead' ? ['team.self.read'] : []),
      ];
      await TestBed.configureTestingModule({
        imports: [CompanyShell],
        providers: [
          provideRouter([]),
          {
            provide: AuthService,
            useValue: {
              user: signal({ ...owner, pool: 'company_user', role, permissions }),
              logout: vi.fn(),
              watched: signal(0),
            },
          },
        ],
      }).compileComponents();
      const f = TestBed.createComponent(CompanyShell);
      f.detectChanges();
      const paths = [...f.nativeElement.querySelectorAll('.sidebar__item')].map((a: any) =>
        a.getAttribute('href'),
      );
      expect(paths.sort()).toEqual(
        [
          'dashboard',
          ...pages,
          'developers',
          'compounds',
          'units',
          ...(role === 'team_lead' ? ['my-team'] : []),
        ]
          .map((p) => '/company/' + p)
          .sort(),
      );
      expect(f.nativeElement.textContent).not.toContain('Company Owner');
      expect(f.nativeElement.textContent).toContain(
        role === 'team_lead' ? 'Team Lead' : 'Sales Agent',
      );
      f.componentInstance.collapsed.set(true);
      f.detectChanges();
      expect(
        [...f.nativeElement.querySelectorAll('.sidebar__item')].every(
          (a: any) => !!a.getAttribute('aria-label'),
        ),
      ).toBe(true);
    },
  );

  it('preserves permission filtering when groups collapse and the sidebar switches to icons', async () => {
    const user = signal({ ...owner, permissions: ['workspace.view', 'leads.read', 'tasks.read'] });
    await TestBed.configureTestingModule({
      imports: [CompanyShell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, logout: vi.fn(), watched: signal(0) } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(CompanyShell);
    f.detectChanges();
    const hrPaths = [
      '/company/hr/employees',
      '/company/hr/departments',
      '/company/hr/documents',
      '/company/hr/onboarding',
    ];
    const paths = () =>
      [...f.nativeElement.querySelectorAll('.sidebar__item')].map((a: any) =>
        a.getAttribute('href'),
      );
    expect(paths()).toEqual(['/company/dashboard', '/company/leads', '/company/tasks', ...hrPaths]);
    f.nativeElement.querySelector('.sidebar__groupLabel').click();
    f.detectChanges();
    expect(paths()).toEqual(hrPaths);
    f.componentInstance.collapsed.set(true);
    f.detectChanges();
    expect(paths()).toEqual(['/company/dashboard', '/company/leads', '/company/tasks', ...hrPaths]);
    expect(f.nativeElement.querySelector('.sidebar__item').getAttribute('aria-label')).toBe(
      'Dashboard',
    );
    expect(f.nativeElement.querySelector('.sidebar__itemLabel')).toBeNull();
    user.set({ ...owner, permissions: ['workspace.view'] });
    f.detectChanges();
    expect(paths()).toEqual(['/company/dashboard', ...hrPaths]);
  });
  it('uses expanded navigation on mobile even after collapsing it on desktop', async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyShell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal(owner), logout: vi.fn(), watched: signal(0) },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(CompanyShell);
    f.componentInstance.collapsed.set(true);
    expect(f.componentInstance.isCollapsed()).toBe(true);
    const previousWidth = window.innerWidth;
    try {
      Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
      window.dispatchEvent(new Event('resize'));
      f.detectChanges();
      expect(f.componentInstance.isCollapsed()).toBe(false);
      expect(f.nativeElement.querySelector('.sidebar__itemLabel').textContent.trim()).toBe(
        'Dashboard',
      );
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: previousWidth, configurable: true });
    }
  });
});
describe('Admin company owner invitation', () => {
  it('queues the automatic welcome on creation and preserves explicit legacy invitations', async () => {
    const company: any = {
      id: 'MJ-REAL',
      version: 0,
      nameEn: 'Actual Company',
      nameAr: 'شركة فعلية',
      slug: 'real',
      adminEmail: 'actual@example.test',
      status: 'pending',
      plan: 'starter',
      type: 'brokerage',
      city: 'Cairo',
      users: 0,
      mrr: 0,
      createdAt: '2026-10-29T00:00:00Z',
      lastActivity: '2026-10-29T00:00:00Z',
    };
    const calls: any[] = [];
    const request = async (path: string, body?: any) => {
      calls.push({ path, body });
      if (path.endsWith('/owner/invite'))
        return { token: 'b'.repeat(64), expiresAt: '2026-10-30T00:00:00Z' };
      return { owner: null };
    };
    await TestBed.configureTestingModule({
      imports: [Companies],
      providers: [
        {
          provide: AuthService,
          useValue: { request, user: signal({ permissions: ['co.view', 'co.create'] }) },
        },
        {
          provide: CompaniesApi,
          useValue: { list: async () => [company], create: async () => company },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Companies);
    await f.whenStable();
    const c = f.componentInstance;
    await c.saveCompany();
    expect(c.ownerDialog()).toBe(null);
    expect(c.success()).toContain('active subscription created on the selected plan');
    expect(c.success()).toContain('queued');
    await c.openOwner(company);
    expect(calls.some((x) => x.path.endsWith('/invite'))).toBe(false);
    c.ownerName.set('Actual Owner');
    c.ownerPassword.set('admin verification');
    c.ownerReason.set('Initial company owner invitation');
    await c.inviteOwner();
    f.detectChanges();
    const sent = calls.find((x) => x.path.endsWith('/invite'));
    expect(sent.body).toEqual({
      name: 'Actual Owner',
      password: 'admin verification',
      reason: 'Initial company owner invitation',
      version: 0,
    });
    expect(c.ownerLink()).toContain('/activate/company#token=');
    expect(c.ownerPassword()).toBe('');
    expect(f.nativeElement.textContent).toContain(
      'New companies receive their login details automatically',
    );
    expect(f.nativeElement.querySelector('input[readonly]')?.value).toContain('#token=');
    c.closeOwner();
    expect(c.ownerLink()).toBe('');
  });
});

describe('Workspace navigation identity refresh', () => {
  it('refreshes identity before the company route guard runs after entering a workspace', async () => {
    const calls: string[] = [];
    await TestBed.configureTestingModule({
      imports: [Companies],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({ pool: 'platform', permissions: ['co.view', 'ws.read'] }),
            request: async (path: string) => {
              if (path.endsWith('/workspace-session')) calls.push('enter');
              return { items: [] };
            },
            restore: async () => {
              calls.push('refresh');
              return true;
            },
          },
        },
        { provide: CompaniesApi, useValue: { list: async () => [] } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(async (url) => {
      calls.push(String(url));
      return true;
    });
    const f = TestBed.createComponent(Companies);
    await f.whenStable();
    f.componentInstance.openWsDialog({
      id: 'MJ-QA',
      nameEn: 'QA Company',
      nameAr: 'اختبار',
    } as any);
    await f.componentInstance.submitWsDialog();
    expect(calls).toEqual(['enter', 'refresh', '/company/dashboard']);
  });
  it.each([false, true])(
    'ends the workspace and restores the platform identity before exit (switch=%s)',
    async (switchCompany) => {
      const calls: string[] = [];
      await TestBed.configureTestingModule({
        imports: [CompanyShell],
        providers: [
          provideRouter([]),
          {
            provide: AuthService,
            useValue: {
              user: signal(owner),
              watched: signal(0),
              request: async (path: string) => {
                if (path.endsWith('/exit')) calls.push('exit');
                return { items: [] };
              },
              restore: async () => {
                calls.push('refresh');
                return true;
              },
            },
          },
        ],
      }).compileComponents();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(async (url) => {
        calls.push(String(url));
        return true;
      });
      const f = TestBed.createComponent(CompanyShell);
      await f.componentInstance.exitWorkspace(switchCompany ? '/admin/companies' : undefined);
      expect(calls).toEqual([
        'exit',
        'refresh',
        switchCompany ? '/admin/companies' : '/admin/dashboard',
      ]);
    },
  );
});
