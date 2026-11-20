import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthService, companyGuard, companyHomePath } from './auth.service';
import { CompanyShell } from './pages/company-shell/company-shell';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { Employee } from './pages/company-shell/employee/employee';
const employee = (hrEnabled = true) => ({
  id: 'person',
  name: 'Personal Employee',
  email: 'employee@example.test',
  pool: 'company_user',
  role: 'employee',
  roles: ['employee'],
  permissions: ['leave.self'],
  companyId: 'company',
  company: {
    id: 'co',
    slug: 'co',
    name: { en: 'Company', ar: 'شركة' },
    status: 'active',
    hrEnabled,
  },
});
afterEach(() => TestBed.resetTestingModule());
describe('Employee login workspace', () => {
  it('employee-only accounts see only employee links and no CRM controls; additional sales roles restore CRM', async () => {
    const user = signal<any>(employee());
    const request = vi.fn(async (path: string) =>
      path.includes('announcements')
        ? []
        : { items: [], unread: 0, self: { id: 'employee' }, isManager: false },
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user, request, restore: async () => true, watched: signal(0) },
        },
        { provide: CompanyUiState, useValue: { lang: signal('en'), dir: signal('ltr') } },
      ],
    });
    const f = TestBed.createComponent(CompanyShell);
    await f.whenStable();
    f.detectChanges();
    const paths = () =>
      [...f.nativeElement.querySelectorAll('.sidebar__item')].map((a: any) =>
        a.getAttribute('href'),
      );
    expect(paths()).toEqual(['/company/employee', '/company/my-leave']);
    expect(f.nativeElement.querySelector('#company-search')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('+ New lead');
    for (const data of [
      { crmView: true },
      { hrAccess: true },
      { permission: 'leads.read' },
      { permission: 'team.read' },
    ]) {
      const denied = await TestBed.runInInjectionContext(() =>
        companyGuard({ data } as any, {} as any),
      );
      expect(denied).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/company/employee');
    }
    expect(
      await TestBed.runInInjectionContext(() =>
        companyGuard({ data: { employeeView: true } } as any, {} as any),
      ),
    ).toBe(true);
    user.set({
      ...employee(),
      role: 'agent',
      roles: ['agent', 'employee'],
      permissions: ['leave.self', 'leads.read', 'leads.manage'],
    });
    f.detectChanges();
    expect(paths()).toContain('/company/leads');
    expect(paths()).toContain('/company/employee');
    expect(companyHomePath(user())).toBe('/company/dashboard');
    user.set(employee(false));
    f.detectChanges();
    expect(paths()).toEqual(['/company/employee']);
    expect(companyHomePath(user())).toBe('/company/employee');
  });
  it('loads only the personal employee endpoint and shows leave services only when enabled', async () => {
    const user = signal<any>(employee());
    const request = vi.fn(async () => ({
      hrEnabled: true,
      employee: {
        employeeCode: 'EMP-0012',
        jobTitle: 'Coordinator',
        department: 'Operations',
        manager: 'Actual Manager',
      },
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, request } },
        { provide: CompanyUiState, useValue: { lang: signal('en') } },
      ],
    });
    const f = TestBed.createComponent(Employee);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('EMP-0012');
    expect(f.nativeElement.querySelector('a[href="/company/my-leave"]')).not.toBeNull();
    expect(request).toHaveBeenCalledWith('/api/v1/employee/me');
    request.mockResolvedValueOnce({ hrEnabled: false, employee: null } as any);
    await f.componentInstance.load();
    f.detectChanges();
    expect(f.nativeElement.querySelector('a[href="/company/my-leave"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Your login remains available');
  });
});
