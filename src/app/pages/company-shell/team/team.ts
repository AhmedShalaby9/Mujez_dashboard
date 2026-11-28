import { visibleCompanyRoles } from '../../../company-role-labels';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  AuthService,
  officeWorkspace,
  hrModuleEnabled,
  financeModuleEnabled,
  hasHrAccess,
} from '../../../auth.service';
import { minorAmount } from '../../../sales-api.service';
import { CompactAmountDirective } from '../../../compact-amount.directive';
import { CompanyUiState } from '../company-ui-state';
import {
  TeamApi,
  TEAM_ROLES,
  OFFICE_SALES_ROLES,
  TEAM_MEMBER_ROLES,
  ADMIN_ONLY_ROLES,
  type TeamMember,
  type TeamRole,
  type SalesTeam,
  type AgentPermissions,
  type OfficeCity,
} from '../../../team-api.service';

@Component({
  selector: 'app-team',
  imports: [FormsModule, DatePipe, CompactAmountDirective],
  templateUrl: './team.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './team.scss',
  ],
})
export class Team {
  private readonly ui = inject(CompanyUiState);
  readonly api = inject(TeamApi);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }

  get office() {
    return officeWorkspace(this.auth.user());
  }
  /** 'brokerage' is this platform's default company_type, so check it
   * explicitly rather than assuming "not office" means brokerage. */
  get isBrokerage() {
    const u = this.auth.user();
    return (u?.company?.type ?? u?.workspace?.company?.type) === 'brokerage';
  }
  get roles(): readonly TeamRole[] {
    if (this.office) return TEAM_ROLES.filter((r) => r === 'agent' || r === 'team_lead');
    if (this.isBrokerage)
      return TEAM_ROLES.filter((r) => !(OFFICE_SALES_ROLES as readonly string[]).includes(r));
    return TEAM_ROLES;
  }
  readonly roleNames: Record<TeamRole, { en: string; ar: string }> = {
    agent: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
    employee: { en: 'Employee', ar: 'موظف' },
    hr_officer: { en: 'HR Officer', ar: 'مسؤول الموارد البشرية' },
    hr_manager: { en: 'HR Manager', ar: 'مدير الموارد البشرية' },
    accountant: { en: 'Accountant', ar: 'محاسب' },
    finance_manager: { en: 'Finance Manager', ar: 'مدير مالي' },
    payroll_officer: { en: 'Payroll Officer', ar: 'مسؤول الرواتب' },
    team_lead: { en: 'Team Lead', ar: 'قائد الفريق' },
    property_advisor: { en: 'Property Advisor', ar: 'مستشار عقاري' },
    property_consultant: { en: 'Property Consultant', ar: 'استشاري عقاري' },
    senior: { en: 'Senior', ar: 'سينيور' },
    expert: { en: 'Expert', ar: 'إكسبرت' },
    team_leader: { en: 'Team Leader', ar: 'قائد الفريق' },
    sales_manager: { en: 'Sales Manager', ar: 'مدير مبيعات' },
    sales_director: { en: 'Sales Director', ar: 'مدير إدارة المبيعات' },
    head_of_sales: { en: 'Head of Sales', ar: 'رئيس قطاع المبيعات' },
    sales_admin: { en: 'Sales Admin', ar: 'مسؤول إداري للمبيعات' },
  };
  readonly departmentNames: Record<
    'marketing' | 'sales' | 'hr' | 'finance',
    { en: string; ar: string }
  > = {
    marketing: { en: 'Marketing', ar: 'التسويق' },
    sales: { en: 'Sales', ar: 'المبيعات' },
    hr: { en: 'HR', ar: 'الموارد البشرية' },
    finance: { en: 'Finance', ar: 'الفاينانس' },
  };
  /** Every company at least markets and sells; HR/Finance departments only
   * make sense once those modules are actually on. */
  get departmentOptions(): readonly ('marketing' | 'sales' | 'hr' | 'finance')[] {
    const u = this.auth.user();
    return [
      'marketing',
      'sales',
      ...(hrModuleEnabled(u) ? (['hr'] as const) : []),
      ...(financeModuleEnabled(u) ? (['finance'] as const) : []),
    ];
  }
  get canSetSalary() {
    const u = this.auth.user();
    return !this.isHr() && hrModuleEnabled(u) && financeModuleEnabled(u);
  }
  readonly statusNames: Record<TeamMember['status'], { en: string; ar: string }> = {
    invited: { en: 'Invited', ar: 'تمت الدعوة' },
    active: { en: 'Active', ar: 'نشط' },
    disabled: { en: 'Disabled', ar: 'معطّل' },
  };

  private readonly auth = inject(AuthService);
  /** HR staff manage the team when the HR module is on, within limits. */
  readonly isHr = computed(() => {
    const u = this.auth.user();
    return u?.pool === 'company_user' && hasHrAccess(u);
  });
  readonly canManage = computed(
    () =>
      this.isHr() ||
      ((this.auth.user()?.permissions ?? []).includes('team.manage') &&
        this.auth.user()?.workspace?.mode !== 'read'),
  );
  readonly isAdmin = computed(
    () =>
      this.canManage() &&
      this.auth.user()?.pool === 'company_admin' &&
      this.auth.user()?.role === 'company_owner' &&
      !this.auth.user()?.workspace,
  );
  readonly canAssignRoles = computed(() => this.isAdmin() || this.isHr());
  roleLocked(r: TeamRole) {
    return this.isHr() && ADMIN_ONLY_ROLES.includes(r);
  }
  /** HR cannot change their own account. */
  canEditRoles(m: TeamMember) {
    return this.canAssignRoles() && !(this.isHr() && m.userId === this.auth.user()?.id);
  }
  /** HR cannot suspend or re-invite themselves or an admin-only role holder. */
  canManageAccount(m: TeamMember) {
    if (!this.canManage()) return false;
    if (!this.isHr()) return true;
    return (
      m.userId !== this.auth.user()?.id &&
      !(m.roles ?? [m.role]).some((r) => ADMIN_ONLY_ROLES.includes(r))
    );
  }
  readonly tab = signal<'members' | 'teams'>('members');
  readonly groups = signal<SalesTeam[]>([]);
  readonly editing = signal<SalesTeam | null>(null);
  readonly teamOpen = signal(false);
  readonly teamSaving = signal(false);
  readonly teamError = signal('');
  teamName = '';
  teamLead = '';
  memberIds: string[] = [];
  readonly eligible = computed(() =>
    this.items().filter(
      (m) =>
        (m.roles ?? [m.role]).some((r) => (TEAM_MEMBER_ROLES as readonly string[]).includes(r)) &&
        ((['active', 'invited'].includes(m.status) && !m.teamId) ||
          (!!this.editing() && m.teamId === this.editing()?.id)),
    ),
  );
  leadName(team: SalesTeam) {
    return team.members.find((m) => m.id === team.leadUserId)?.name ?? '—';
  }
  openTeam(team?: SalesTeam) {
    this.editing.set(team ?? null);
    this.teamName = team?.name ?? '';
    this.teamLead = team?.leadUserId ?? '';
    this.memberIds = team?.members.map((m) => m.id) ?? [];
    this.teamError.set('');
    this.teamOpen.set(true);
  }
  toggleMember(id: string, checked: boolean) {
    this.memberIds = checked
      ? [...this.memberIds.filter((x) => x !== id), id]
      : this.memberIds.filter((x) => x !== id);
  }
  async saveTeam() {
    if (this.teamSaving() || !this.canManage()) return;
    this.teamSaving.set(true);
    this.teamError.set('');
    try {
      await this.api.saveGroup(
        {
          name: this.teamName.trim(),
          leadUserId: this.teamLead,
          memberUserIds: this.memberIds,
          ...(this.editing() ? { version: this.editing()!.version } : {}),
        },
        this.editing()?.id,
      );
      this.teamOpen.set(false);
      await this.reload();
      this.toast.set(this.t('Team saved', 'تم حفظ الفريق'));
    } catch (e) {
      this.teamError.set((e as Error).message);
    } finally {
      this.teamSaving.set(false);
    }
  }
  async changeRole(m: TeamMember, role: TeamRole) {
    if (this.busy() || !this.canManage()) return;
    this.busy.set(m.id);
    this.error.set('');
    try {
      await this.api.role(m.id, role);
      await this.reload();
    } catch (e) {
      const message = (e as Error).message;
      await this.reload();
      this.error.set(message);
    } finally {
      this.busy.set(null);
    }
  }
  readonly roleMember = signal<TeamMember | null>(null);
  readonly selectedRoles = signal<TeamRole[]>([]);
  readonly rolesError = signal('');
  assignedRoles(m: TeamMember) {
    return m.roles ?? [m.role];
  }
  visibleRoles(m: TeamMember) {
    return visibleCompanyRoles(this.assignedRoles(m));
  }
  roleSummary(m: TeamMember) {
    return this.visibleRoles(m)
      .map((r) => this.roleNames[r]?.[this.lang()] ?? r)
      .join(' · ');
  }
  editRoles(m: TeamMember) {
    this.roleMember.set(m);
    this.selectedRoles.set(this.assignedRoles(m).filter((r) => this.roles.includes(r)));
    this.rolesError.set('');
  }
  toggleRole(r: TeamRole, checked: boolean, invite = false) {
    // Every invited company user is an employee first; that checkbox can't be
    // unchecked (real estate offices don't use this role at all).
    if (invite && r === 'employee' && !this.office) return;
    const target = invite ? this.inviteRoles : this.selectedRoles;
    target.set(checked ? [...new Set([...target(), r])] : target().filter((x) => x !== r));
  }
  async saveRoles() {
    const m = this.roleMember();
    if (!m || this.busy() || !this.canAssignRoles() || !this.selectedRoles().length) return;
    this.busy.set(m.id);
    this.rolesError.set('');
    try {
      await this.api.assignRoles(m.id, this.selectedRoles(), m.rolesVersion ?? 0);
      this.roleMember.set(null);
      await this.reload();
      this.toast.set(this.t('Roles updated', 'تم تحديث الأدوار'));
    } catch (e) {
      this.rolesError.set((e as Error).message);
    } finally {
      this.busy.set(null);
    }
  }
  readonly permMember = signal<TeamMember | null>(null);
  readonly permOpen = signal(false);
  readonly permSaving = signal(false);
  readonly permError = signal('');
  readonly officeCities = signal<OfficeCity[]>([]);
  perm: Omit<AgentPermissions, 'version'> = {
    viewSale: true,
    viewRent: true,
    viewPhones: true,
    addClient: true,
    addProperty: true,
    editData: true,
    deleteProperties: false,
    allCities: true,
    cityIds: [],
  };
  private permVersion = 0;
  cityName(c: OfficeCity) {
    return this.ar() ? c.nameAr : c.nameEn;
  }
  toggleCity(id: string, checked: boolean) {
    this.perm.cityIds = checked
      ? [...this.perm.cityIds.filter((x) => x !== id), id]
      : this.perm.cityIds.filter((x) => x !== id);
  }
  private async loadOfficeCities() {
    if (!this.office || this.officeCities().length) return;
    try {
      const r = await this.api.officeCities();
      this.officeCities.set(r.items);
    } catch {
      /* the cities list is optional context in the permissions modal; a save still works without it */
    }
  }
  async editPermissions(m: TeamMember) {
    if (!this.office || !this.isAdmin()) return;
    this.permMember.set(m);
    this.permError.set('');
    this.permOpen.set(true);
    void this.loadOfficeCities();
    try {
      const r = await this.api.agentPermissions(m.userId);
      this.permVersion = r.version;
      this.perm = {
        viewSale: r.viewSale,
        viewRent: r.viewRent,
        viewPhones: r.viewPhones,
        addClient: r.addClient,
        addProperty: r.addProperty,
        editData: r.editData,
        deleteProperties: r.deleteProperties,
        allCities: r.allCities,
        cityIds: [...r.cityIds],
      };
    } catch (e) {
      this.permError.set((e as Error).message);
    }
  }
  closePermissions() {
    if (!this.permSaving()) this.permOpen.set(false);
  }
  async savePermissions() {
    const m = this.permMember();
    if (!m || this.permSaving()) return;
    this.permSaving.set(true);
    this.permError.set('');
    try {
      const r = await this.api.saveAgentPermissions(m.userId, {
        requestId: crypto.randomUUID(),
        version: this.permVersion,
        data: { ...this.perm, allCities: this.perm.cityIds.length === 0 },
      });
      this.permVersion = r.version;
      this.permOpen.set(false);
      this.toast.set(this.t('Permissions saved', 'تم حفظ الصلاحيات'));
    } catch (e) {
      this.permError.set((e as Error).message);
    } finally {
      this.permSaving.set(false);
    }
  }
  readonly items = signal<TeamMember[]>([]);
  /** The API returns the whole team (no paging), so search / status filter on the client. */
  readonly search = signal('');
  readonly statusFilter = signal<TeamMember['status'] | 'all'>('all');
  readonly statuses: TeamMember['status'][] = ['active', 'invited', 'disabled'];
  readonly count = computed(() => {
    const c = { all: 0, active: 0, invited: 0, disabled: 0 };
    for (const m of this.items()) {
      c.all++;
      c[m.status]++;
    }
    return c;
  });
  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase(),
      st = this.statusFilter();
    return this.items().filter(
      (m) =>
        (st === 'all' || m.status === st) &&
        (!q || (m.name + ' ' + m.email).toLowerCase().includes(q)),
    );
  });
  readonly statusTone: Record<TeamMember['status'], [string, string]> = {
    active: ['#EEF6DA', '#111113'],
    invited: ['#FDF3DC', '#8A5A14'],
    disabled: ['#F4F4F1', '#8A8A90'],
  };
  readonly toast = signal('');
  initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  expired(m: TeamMember) {
    return !!m.invitationExpiresAt && Date.parse(m.invitationExpiresAt) < Date.now();
  }
  readonly loading = signal(false);
  readonly error = signal('');
  readonly busy = signal<string | null>(null);

  readonly inviteOpen = signal(false);
  readonly inviteName = signal('');
  readonly inviteEmail = signal('');
  readonly inviteRoles = signal<TeamRole[]>(['agent']);
  readonly inviteDepartment = signal<'marketing' | 'sales' | 'hr' | 'finance' | ''>('');
  readonly inviteSalary = signal('');
  readonly inviteError = signal('');
  readonly inviting = signal(false);
  readonly inviteLink = signal('');
  readonly createdMember = signal<TeamMember | null>(null);

  constructor() {
    void this.reload();
  }

  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [r, groups] = await Promise.all([this.api.list(), this.api.groups()]);
      this.items.set(r.items);
      this.groups.set(groups.items);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openInvite() {
    this.inviteOpen.set(true);
    this.inviteName.set('');
    this.inviteEmail.set('');
    const primary = this.isBrokerage ? 'property_advisor' : 'agent';
    this.inviteRoles.set(this.office ? [primary] : [primary, 'employee']);
    this.inviteDepartment.set('');
    this.inviteSalary.set('');
    this.inviteError.set('');
    this.inviteLink.set('');
    this.createdMember.set(null);
  }
  closeInvite() {
    if (this.inviting()) return;
    this.inviteOpen.set(false);
  }

  async submitInvite() {
    if (this.inviting() || !this.canAssignRoles() || !this.inviteRoles().length) return;
    this.inviting.set(true);
    this.inviteError.set('');
    try {
      const salary = this.inviteSalary().trim();
      let salaryMinor: string | undefined;
      if (this.canSetSalary && salary) {
        try {
          salaryMinor = minorAmount(salary) ?? undefined;
        } catch {
          throw new Error(this.t('Enter a valid salary amount.', 'أدخل راتبًا صحيحًا.'));
        }
      }
      const r = await this.api.invite({
        name: this.inviteName().trim(),
        email: this.inviteEmail().trim(),
        roles: this.inviteRoles(),
        department: this.inviteDepartment() || undefined,
        salaryMinor,
      });
      this.inviteLink.set(location.origin + '/activate/team#token=' + r.token);
      await this.reload();
      this.createdMember.set(this.items().find((m) => m.userId === r.userId) ?? null);
    } catch (e) {
      this.inviteError.set((e as Error).message);
    } finally {
      this.inviting.set(false);
    }
  }
  setPermissionsForCreated() {
    const m = this.createdMember();
    if (m) void this.editPermissions(m);
  }

  async resend(m: TeamMember) {
    if (this.busy()) return;
    this.busy.set(m.id);
    this.error.set('');
    try {
      const r = await this.api.resend(m.id);
      this.inviteLink.set(location.origin + '/activate/team#token=' + r.token);
      this.inviteOpen.set(true);
      this.inviteName.set(m.name);
      this.inviteEmail.set(m.email);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  async revoke(m: TeamMember) {
    if (this.busy()) return;
    this.busy.set(m.id);
    this.error.set('');
    try {
      await this.api.revoke(m.id);
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  async toggle(m: TeamMember) {
    if (this.busy()) return;
    this.busy.set(m.id);
    this.error.set('');
    try {
      await this.api.status(m.id, m.status === 'active' ? 'disable' : 'enable');
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.inviteLink());
      this.toast.set(this.t('Link copied', 'تم نسخ الرابط'));
      setTimeout(() => this.toast.set(''), 2500);
    } catch {
      /* clipboard access can fail silently; the link stays visible to copy manually */
    }
  }
}
