import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Team } from './pages/company-shell/team/team';
import { TeamApi, type TeamMember } from './team-api.service';
import { AuthService } from './auth.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { Dashboard } from './pages/company-shell/dashboard/dashboard';
import { CompanyInsightsApi } from './company-insights-api.service';
import { SalesApi } from './sales-api.service';
const member = {
  id: 'account',
  userId: 'user',
  name: 'Combined Sales',
  email: 'sales@example.test',
  role: 'agent',
  roleName: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
  roles: ['agent', 'employee'],
  rolesVersion: 3,
  status: 'active',
  teamId: null,
  invitationExpiresAt: null,
  lastLoginAt: null,
  createdAt: '2026-11-18T00:00:00Z',
} as TeamMember;
async function setup() {
  const api = {
    list: vi.fn(async () => ({
      items: [
        member,
        {
          ...member,
          id: 'employee-account',
          userId: 'employee-user',
          name: 'HR Only',
          role: 'employee',
          roles: ['employee'],
        },
      ],
    })),
    groups: vi.fn(async () => ({ items: [] })),
    assignRoles: vi.fn(async () => ({ status: 'updated' })),
    invite: vi.fn(async () => ({ token: 'private-test-token', accountId: 'new-account' })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({
            pool: 'company_admin',
            role: 'company_owner',
            permissions: ['team.read', 'team.manage'],
          }),
        },
      },
      { provide: TeamApi, useValue: api },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
    ],
  });
  const f = TestBed.createComponent(Team);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, api };
}
afterEach(() => TestBed.resetTestingModule());
describe('Multiple company roles', () => {
  it('shows all assigned role badges and excludes employee-only accounts from sales teams', async () => {
    const { f, c } = await setup();
    expect(f.nativeElement.textContent).toContain('Employee');
    expect(c.assignedRoles(member)).toEqual(['agent', 'employee']);
    expect(c.eligible().map((m) => m.userId)).toEqual(['user']);
  });
  it('explicitly saves role selections with the observed version', async () => {
    const { f, c, api } = await setup();
    c.editRoles(member);
    f.detectChanges();
    const checks = Array.from(
      f.nativeElement.querySelectorAll('.role-options input'),
    ) as HTMLInputElement[];
    expect(checks.map((x) => x.checked)).toEqual([true, false, true]);
    checks[1].click();
    f.detectChanges();
    await c.saveRoles();
    expect(api.assignRoles).toHaveBeenCalledWith('account', ['agent', 'employee', 'team_lead'], 3);
    expect(c.roleMember()).toBeNull();
  });
  it('preserves role choices and shows conflicts when a save fails', async () => {
    const { c, api } = await setup();
    c.editRoles(member);
    c.toggleRole('team_lead', true);
    api.assignRoles.mockRejectedValueOnce(new Error('Roles changed. Refresh before saving.'));
    await c.saveRoles();
    expect(c.roleMember()?.id).toBe('account');
    expect(c.selectedRoles()).toContain('team_lead');
    expect(c.rolesError()).toContain('Refresh');
  });
  it('prevents saving an empty role selection and sends arrays for invitations', async () => {
    const { f, c, api } = await setup();
    c.editRoles(member);
    c.selectedRoles.set([]);
    f.detectChanges();
    expect(
      (f.nativeElement.querySelector('.dialog button[type=submit]') as HTMLButtonElement).disabled,
    ).toBe(true);
    await c.saveRoles();
    expect(api.assignRoles).not.toHaveBeenCalled();
    c.roleMember.set(null);
    c.openInvite();
    c.inviteName.set('New Sales');
    c.inviteEmail.set('new@example.test');
    c.toggleRole('employee', true, true);
    await c.submitInvite();
    expect(api.invite).toHaveBeenCalledWith({
      name: 'New Sales',
      email: 'new@example.test',
      roles: ['agent', 'employee'],
    });
  });
  it('renders employee-only landing without loading CRM statistics', async () => {
    const api = { get: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              pool: 'company_user',
              role: 'employee',
              roles: ['employee'],
              permissions: [],
            }),
          },
        },
        { provide: CompanyInsightsApi, useValue: api },
        { provide: SalesApi, useValue: { get: vi.fn() } },
        { provide: CompanyUiState, useValue: { lang: signal('en') } },
      ],
    });
    const f = TestBed.createComponent(Dashboard);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Welcome to your employee account');
    expect(f.nativeElement.textContent).not.toContain('Open pipeline');
    expect(api.get).not.toHaveBeenCalled();
  });
});
