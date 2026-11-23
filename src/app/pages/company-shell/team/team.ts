import { visibleCompanyRoles } from '../../../company-role-labels';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService, officeWorkspace } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import {
  TeamApi,
  TEAM_ROLES,
  type TeamMember,
  type TeamRole,
  type SalesTeam,
} from '../../../team-api.service';

@Component({
  selector: 'app-team',
  imports: [FormsModule, DatePipe],
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
  get roles(): readonly TeamRole[] {
    return this.office ? TEAM_ROLES.filter((r) => r === 'agent' || r === 'team_lead') : TEAM_ROLES;
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
  };
  readonly statusNames: Record<TeamMember['status'], { en: string; ar: string }> = {
    invited: { en: 'Invited', ar: 'تمت الدعوة' },
    active: { en: 'Active', ar: 'نشط' },
    disabled: { en: 'Disabled', ar: 'معطّل' },
  };

  private readonly auth = inject(AuthService);
  readonly canManage = computed(
    () =>
      (this.auth.user()?.permissions ?? []).includes('team.manage') &&
      this.auth.user()?.workspace?.mode !== 'read',
  );
  readonly canAssignRoles = computed(
    () =>
      this.canManage() &&
      this.auth.user()?.pool === 'company_admin' &&
      this.auth.user()?.role === 'company_owner' &&
      !this.auth.user()?.workspace,
  );
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
        (m.roles ?? [m.role]).some((r) => r === 'agent' || r === 'team_lead') &&
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
  readonly inviteError = signal('');
  readonly inviting = signal(false);
  readonly inviteLink = signal('');

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
    this.inviteRoles.set(['agent']);
    this.inviteError.set('');
    this.inviteLink.set('');
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
      const r = await this.api.invite({
        name: this.inviteName().trim(),
        email: this.inviteEmail().trim(),
        roles: this.inviteRoles(),
      });
      this.inviteLink.set(location.origin + '/activate/team#token=' + r.token);
      await this.reload();
    } catch (e) {
      this.inviteError.set((e as Error).message);
    } finally {
      this.inviting.set(false);
    }
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
