import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, Router, UrlTree } from '@angular/router';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthService, companyGuard, hasHrAccess, hasLeaveSelf } from './auth.service';
import { CompanyShell } from './pages/company-shell/company-shell';
import { CreateCompany } from './pages/admin-shell/create-company/create-company';
import { CompaniesApi } from './companies-api.service';
import { SubscriptionsApi } from './subscriptions-api.service';
import { AdminUiState } from './pages/admin-shell/admin-ui-state';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
const owner = (hrEnabled: boolean) => ({
  id: 'owner',
  name: 'Owner',
  email: 'owner@example.test',
  pool: 'company_admin',
  role: 'company_owner',
  permissions: ['workspace.view', 'leads.read', 'team.manage'],
  companyId: 'co',
  company: {
    id: 'co',
    slug: 'co',
    name: { en: 'Company', ar: 'شركة' },
    status: 'active',
    hrEnabled,
  },
});
afterEach(() => TestBed.resetTestingModule());
describe('Optional company HR', () => {
  it('hides HR and leave pages and blocks direct HR routes while keeping CRM routes', async () => {
    const user = signal<any>(owner(false));
    const request = vi.fn(async (path: string) =>
      path.includes('announcements')
        ? []
        : { items: [], unread: 0, isManager: true, self: { id: 'person' } },
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user, restore: async () => true, request, watched: signal(0) },
        },
        { provide: CompanyUiState, useValue: { lang: signal('en'), dir: signal('ltr') } },
      ],
    });
    const f = TestBed.createComponent(CompanyShell);
    await f.whenStable();
    f.detectChanges();
    const paths = () =>
      f.componentInstance
        .visibleNav()
        .filter((x) => x.kind === 'item')
        .map((x: any) => x.path);
    expect(paths()).toContain('leads');
    expect(paths()).not.toContain('hr/employees');
    expect(paths()).not.toContain('my-leave');
    expect(paths()).not.toContain('leave-approvals');
    expect(request.mock.calls.some(([path]) => path === '/api/v1/leave/context')).toBe(false);
    for (const data of [
      { hrAccess: true },
      { leaveView: 'my' },
      { leaveView: 'approvals' },
      { leaveView: 'manage' },
    ]) {
      const denied = await TestBed.runInInjectionContext(() =>
        companyGuard({ data } as any, {} as any),
      );
      expect(denied).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/company/dashboard');
    }
    expect(
      await TestBed.runInInjectionContext(() =>
        companyGuard({ data: { permission: 'leads.read' } } as any, {} as any),
      ),
    ).toBe(true);
    user.set(owner(true));
    f.detectChanges();
    expect(paths()).toContain('hr/employees');
    expect(hasHrAccess(user())).toBe(true);
    expect(
      await TestBed.runInInjectionContext(() =>
        companyGuard({ data: { hrAccess: true } } as any, {} as any),
      ),
    ).toBe(true);
    expect(
      hasLeaveSelf({
        ...owner(false),
        pool: 'company_user',
        role: 'agent',
        roles: ['agent', 'employee'],
        permissions: ['leads.read', 'leave.self'],
      }),
    ).toBe(false);
  });
  it('defaults HR off, saves the toggle in drafts and creation, and resumes a disabled draft correctly', async () => {
    const api = {
      drafts: vi.fn(async () => ({ items: [] })),
      draft: vi.fn(async () => ({ id: 'draft', version: 2, payload: { hrEnabled: false } })),
      quote: vi.fn(async () => ({ planVersionId: 'plan' })),
      saveDraft: vi.fn(async (_body: unknown) => ({ id: 'draft', version: 1 })),
      create: vi.fn(async (_body: unknown) => ({ id: 'created' })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: CompaniesApi, useValue: api },
        { provide: SubscriptionsApi, useValue: { plans: async () => [] } },
        { provide: AdminUiState, useValue: { lang: signal('en') } },
      ],
    });
    const f = TestBed.createComponent(CreateCompany);
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.f().hrEnabled).toBe(false);
    c.step.set(4);
    f.detectChanges();
    const toggle = f.nativeElement.querySelector('[role="switch"][aria-label="HR module"]');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    f.detectChanges();
    expect(c.f().hrEnabled).toBe(true);
    await c.saveDraft();
    expect(api.saveDraft.mock.calls[0][0]).toMatchObject({ hrEnabled: true });
    c.step.set(5);
    await c.next();
    expect(api.create.mock.calls[0][0]).toMatchObject({ hrEnabled: true });
    await c.resumeDraft('draft');
    expect(c.f().hrEnabled).toBe(false);
    c.set('hrEnabled', true);
    api.draft.mockResolvedValueOnce({ id: 'legacy', version: 1, payload: {} } as any);
    await c.resumeDraft('legacy');
    expect(c.f().hrEnabled).toBe(false);
    c.another();
    expect(c.f().hrEnabled).toBe(false);
  });
});
