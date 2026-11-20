import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthService, companyGuard, hasHrAccess } from './auth.service';
import { RUNTIME_CONFIG } from './runtime-config';
import { CompanyShell } from './pages/company-shell/company-shell';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { TEAM_ROLES } from './team-api.service';
const user = (role: string, roles = [role], permissions = ['hr.read', 'hr.manage']) => ({
  id: 'hr-user',
  name: 'Actual HR User',
  email: 'hr@example.test',
  pool: 'company_user',
  role,
  roles,
  permissions,
  companyId: 'company',
  company: {
    id: 'company',
    slug: 'company',
    name: { en: 'Company', ar: 'شركة' },
    status: 'active',
  },
});
afterEach(() => TestBed.resetTestingModule());
describe('HR-role navigation and boundaries', () => {
  it.each(['hr_officer', 'hr_manager'])(
    'grants %s the company HR route without owner or sales permissions',
    async (role) => {
      const current = signal<any>(user(role));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: { user: current, restore: async () => true } },
        ],
      });
      const result = await TestBed.runInInjectionContext(() =>
        companyGuard({ data: { hrAccess: true } } as any, {} as any),
      );
      expect(result).toBe(true);
      expect(hasHrAccess(current())).toBe(true);
      const denied = await TestBed.runInInjectionContext(() =>
        companyGuard({ data: { ownerOnly: true, permission: 'reports.read' } } as any, {} as any),
      );
      expect(denied).toBeInstanceOf(UrlTree);
    },
  );
  it('requires both HR membership and permission, and excludes Payroll Officer and inspection sessions', () => {
    expect(hasHrAccess(user('payroll_officer', ['payroll_officer', 'employee'], []))).toBe(false);
    expect(hasHrAccess(user('agent', ['agent', 'employee'], ['hr.read']))).toBe(false);
    expect(hasHrAccess(user('hr_manager', ['hr_manager'], []))).toBe(false);
    expect(hasHrAccess({ ...user('hr_manager'), workspace: { mode: 'manage' } as any })).toBe(
      false,
    );
    expect(TEAM_ROLES).toEqual(
      expect.arrayContaining(['hr_officer', 'hr_manager', 'payroll_officer']),
    );
  });
  it('routes HR-only accounts to HR while mixed sales users keep their dashboard', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNTIME_CONFIG,
          useValue: {
            apiUrl: 'https://api.example.test',
            dashboardUrl: 'https://app.example.test',
          },
        },
      ],
    });
    const auth = TestBed.inject(AuthService);
    auth.user.set(user('hr_officer'));
    expect(auth.homePath()).toBe('/company/hr/employees');
    auth.user.set(
      user('agent', ['agent', 'hr_manager', 'employee'], ['hr.read', 'hr.manage', 'leads.read']),
    );
    expect(auth.homePath()).toBe('/company/dashboard');
    auth.user.set(user('payroll_officer', ['payroll_officer'], []));
    expect(auth.homePath()).toBe('/company/dashboard');
  });
  it('shows HR pages to HR staff without sales, finance or role management links', async () => {
    const current = signal<any>(user('hr_officer'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: current,
            request: vi.fn(async (path: string) =>
              path.includes('announcements') ? [] : { items: [], unread: 0 },
            ),
            watched: signal(0),
          },
        },
        { provide: CompanyUiState, useValue: { lang: signal('en'), dir: signal('ltr') } },
      ],
    });
    const f = TestBed.createComponent(CompanyShell);
    await f.whenStable();
    f.detectChanges();
    const paths = [...f.nativeElement.querySelectorAll('.sidebar__item')].map((a: any) =>
      a.getAttribute('href'),
    );
    expect(paths).toEqual([
      '/company/hr/assets',
      '/company/hr/attendance',
      '/company/hr/work-schedules',
      '/company/hr/employees',
      '/company/hr/departments',
      '/company/hr/documents',
    ]);
    expect(f.componentInstance.me.role).toBe('HR Officer');
  });
});
