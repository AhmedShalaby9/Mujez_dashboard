import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { TeamApi, type TeamMember, type SalesTeam } from '../../../team-api.service';
import { Team } from './team';
import { MyTeam } from '../my-team/my-team';
import { CompanyShell } from '../company-shell';
import { CompanyUiState } from '../company-ui-state';
import { routes } from '../../../app.routes';
const members: TeamMember[] = [
  {
    id: 'account-1',
    userId: 'user-1',
    name: 'Saved Lead',
    email: 'lead@example.test',
    role: 'team_lead',
    roleName: { en: 'Team Lead', ar: 'قائد الفريق' },
    teamId: 'team-1',
    status: 'active',
    invitationExpiresAt: null,
    lastLoginAt: null,
    createdAt: '2026-11-14',
  },
  {
    id: 'account-2',
    userId: 'user-2',
    name: 'Saved Agent',
    email: 'agent@example.test',
    role: 'agent',
    roleName: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
    teamId: null,
    status: 'invited',
    invitationExpiresAt: null,
    lastLoginAt: null,
    createdAt: '2026-11-14',
  },
];
const group: SalesTeam = {
  id: 'team-1',
  name: 'Cairo Sales',
  leadUserId: 'user-1',
  version: 7,
  members: [
    {
      id: 'user-1',
      name: 'Saved Lead',
      email: 'lead@example.test',
      status: 'active',
      role: 'team_lead',
    },
  ],
};
async function setup(component: any = Team, manage = true) {
  const api = {
    list: vi.fn(async () => ({ items: members })),
    groups: vi.fn(async () => ({ items: [group] })),
    myTeam: vi.fn(async () => ({ items: [group] })),
    performance: vi.fn(async () => ({
      team: group,
      items: group.members.map((m) => ({
        ...m,
        canAssign: true,
        leads: 0,
        openLeads: 0,
        newLeads: 0,
        won: 0,
        lost: 0,
        wonSalesMinor: '0',
        openTasks: 0,
        overdueTasks: 0,
        completedTasks: 0,
      })),
      summary: {
        leads: 0,
        openLeads: 0,
        newLeads: 0,
        won: 0,
        lost: 0,
        wonSalesMinor: '0',
        openTasks: 0,
        overdueTasks: 0,
        completedTasks: 0,
      },
      days: 30,
      from: '2026-10-16',
      to: '2026-11-14',
      timeZone: 'Africa/Cairo',
      canAssign: true,
    })),
    saveGroup: vi.fn(async (_b: any, _id?: string) => ({ id: 'team-1' })),
    role: vi.fn(async (_id: string, _role: string) => ({ status: 'updated' })),
  };
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({ permissions: manage ? ['team.read', 'team.manage'] : ['team.read'] }),
        },
      },
      { provide: TeamApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(component);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance as Team, api };
}
describe('Company team management', () => {
  it('loads real teams and edits the selected lead, membership and version', async () => {
    const { f, c, api } = await setup();
    c.tab.set('teams');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Cairo Sales');
    expect(f.nativeElement.textContent).toContain('Saved Lead');
    c.openTeam(group);
    c.teamName = 'Cairo East';
    c.toggleMember('user-2', true);
    await c.saveTeam();
    expect(api.saveGroup).toHaveBeenCalledWith(
      { name: 'Cairo East', leadUserId: 'user-1', memberUserIds: ['user-1', 'user-2'], version: 7 },
      'team-1',
    );
    expect(c.teamOpen()).toBe(false);
  });
  it('keeps unsaved team input and conflict visible when saving fails', async () => {
    const { c, api } = await setup();
    c.openTeam(group);
    c.teamName = 'Keep my draft';
    api.saveGroup.mockRejectedValueOnce(Error('Team changed. Refresh before saving.'));
    await c.saveTeam();
    expect(c.teamOpen()).toBe(true);
    expect(c.teamName).toBe('Keep my draft');
    expect(c.teamError()).toContain('Refresh');
    expect(c.groups()[0].version).toBe(7);
  });
  it('supports team lead invitations and server-backed role changes', async () => {
    const { c, api } = await setup();
    expect(c.roles).toContain('team_lead');
    await c.changeRole(members[1], 'team_lead');
    expect(api.role).toHaveBeenCalledWith('account-2', 'team_lead');
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('hides management actions from read-only company access', async () => {
    const { f, c, api } = await setup(Team, false);
    c.tab.set('teams');
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('+ Create team');
    expect(f.nativeElement.textContent).not.toContain('Edit team');
    await c.changeRole(members[1], 'team_lead');
    expect(api.role).not.toHaveBeenCalled();
    c.openTeam(group);
    await c.saveTeam();
    expect(api.saveGroup).not.toHaveBeenCalled();
  });
});
describe('Team lead workspace', () => {
  it('renders only the assigned roster using the dedicated endpoint, including Arabic', async () => {
    const { f, api } = await setup(MyTeam);
    expect(api.myTeam).toHaveBeenCalledOnce();
    expect(api.list).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Cairo Sales');
    expect(f.nativeElement.textContent).toContain('Saved Lead');
    expect(f.nativeElement.textContent).not.toContain('Saved Agent');
    TestBed.inject(CompanyUiState).lang.set('ar');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('فريقي');
    expect(f.nativeElement.querySelector('.pg').dir).toBe('rtl');
    expect(
      routes.find((r) => r.path === 'company')?.children?.find((r) => r.path === 'my-team')?.data?.[
        'permission'
      ],
    ).toBe('team.self.read');
  });
  it('adds My team to the sales navigation only for the team lead permission', async () => {
    const user = signal<any>({
      name: 'Sales employee',
      pool: 'company_user',
      role: 'agent',
      permissions: ['leads.read', 'tasks.read'],
    });
    await TestBed.configureTestingModule({
      imports: [CompanyShell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, watched: signal(0) } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(CompanyShell);
    f.detectChanges();
    const paths = () =>
      f.componentInstance
        .visibleNav()
        .filter((x) => x.kind === 'item')
        .map((x) => (x as any).path);
    expect(paths()).toEqual(['dashboard', 'leads', 'cold-calls', 'tasks']);
    user.set({
      ...user(),
      role: 'team_lead',
      permissions: [...user().permissions, 'team.self.read'],
    });
    expect(paths()).toEqual(['dashboard', 'leads', 'cold-calls', 'tasks', 'my-team']);
    expect(paths()).not.toContain('team');
  });
});

it('shows only sales and team lead roles for real estate office invitations', async () => {
  const { c, f } = await setup();
  const auth = TestBed.inject(AuthService);
  (auth.user as any).set({
    pool: 'company_admin',
    role: 'company_owner',
    company: { type: 'real_estate_office' },
    permissions: ['team.read', 'team.manage'],
  });
  expect(c.roles).toEqual(['agent', 'team_lead']);
  c.openInvite();
  f.detectChanges();
  expect(f.nativeElement.textContent).not.toContain('HR Officer');
  c.editRoles({ ...members[1], roles: ['agent', 'employee'] });
  expect(c.selectedRoles()).toEqual(['agent']);
});

it('keeps tasks, calendar and contacts in office navigation for sales, team leads and owners', async () => {
  const user = signal<any>({
    pool: 'company_user',
    role: 'agent',
    company: { type: 'real_estate_office' },
    permissions: ['leads.read', 'tasks.read', 'calendar.read', 'contacts.read'],
  });
  await TestBed.configureTestingModule({
    imports: [CompanyShell],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user, watched: signal(0) } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(CompanyShell);
  for (const role of ['agent', 'team_lead', 'company_owner']) {
    user.set({
      ...user(),
      role,
      pool: role === 'company_owner' ? 'company_admin' : 'company_user',
    });
    const paths = f.componentInstance
      .visibleNav()
      .filter((x) => x.kind === 'item')
      .map((x) => (x as any).path);
    expect(paths).toContain('tasks');
    expect(paths).toContain('calendar');
    expect(paths).toContain('contacts');
    expect(paths).toContain('office/clients');
  }
});
