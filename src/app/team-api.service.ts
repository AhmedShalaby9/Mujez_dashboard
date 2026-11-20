import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
export const TEAM_ROLES = [
  'agent',
  'team_lead',
  'employee',
  'hr_officer',
  'hr_manager',
  'payroll_officer',
  'accountant',
  'finance_manager',
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  roles?: TeamRole[];
  rolesVersion?: number;
  teamId: string | null;
  roleName: { en: string; ar: string };
  status: 'invited' | 'active' | 'disabled';
  invitationExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
export interface SalesTeam {
  id: string;
  name: string;
  leadUserId: string;
  version: number;
  members: { id: string; name: string; email: string; role: TeamRole; status: string }[];
}
export interface SalesTeamInput {
  name: string;
  leadUserId: string;
  memberUserIds: string[];
  version?: number;
}
export interface TeamWorkLead {
  id: string;
  reference: string;
  name: { en: string; ar: string };
  phone: string;
  email: string | null;
  stage: string;
  version: number;
  owner: { id: string; name: string };
}
export interface TeamWorkTask {
  id: string;
  version: number;
  reference: string;
  title: { en: string; ar: string };
  status: string;
  priority: string;
  dueDate: string;
  overdue: boolean;
  assignee: { id: string; name: string };
}
export interface TeamMetrics {
  leads: number;
  openLeads: number;
  newLeads: number;
  won: number;
  lost: number;
  wonSalesMinor: string;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
}
export interface TeamPerformance {
  team: { id: string; name: string };
  items: (TeamMetrics & {
    id: string;
    name: string;
    email: string;
    role: TeamRole;
    status: string;
    canAssign: boolean;
  })[];
  summary: TeamMetrics;
  days: number;
  from: string;
  to: string;
  asOf: string;
  timeZone: string;
  canAssign: boolean;
  canManageTasks: boolean;
}
export interface TeamWorkPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface TeamTaskDraft {
  requestId: string;
  title: string;
  description?: string;
  assigneeId: string;
  dueDate?: string;
  priority: string;
  leadId?: string | null;
}
export interface TeamTaskResult {
  id: string;
  reference: string;
  version: number;
  status: string;
}
@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly auth = inject(AuthService);
  list() {
    return this.auth.request('/api/v1/team') as Promise<{ items: TeamMember[] }>;
  }
  groups() {
    return this.auth.request('/api/v1/team/groups') as Promise<{ items: SalesTeam[] }>;
  }
  myTeam() {
    return this.auth.request('/api/v1/team/my-team') as Promise<{ items: SalesTeam[] }>;
  }
  performance(days = 30) {
    return this.auth.request(
      '/api/v1/team/my-team/performance?days=' + days,
    ) as Promise<TeamPerformance>;
  }
  workLeads(query: Record<string, string>) {
    return this.auth.request('/api/v1/team/my-team/leads?' + new URLSearchParams(query)) as Promise<
      TeamWorkPage<TeamWorkLead>
    >;
  }
  workTasks(query: Record<string, string>) {
    return this.auth.request('/api/v1/team/my-team/tasks?' + new URLSearchParams(query)) as Promise<
      TeamWorkPage<TeamWorkTask>
    >;
  }
  assignLead(id: string, body: { requestId: string; version: number; ownerId: string }) {
    return this.auth.request(
      '/api/v1/team/my-team/leads/' + encodeURIComponent(id) + '/assign',
      body,
    );
  }
  createTask(body: TeamTaskDraft) {
    return this.auth.request('/api/v1/team/my-team/tasks', body) as Promise<TeamTaskResult>;
  }
  assignTask(id: string, body: { requestId: string; version: number; assigneeId: string }) {
    return this.auth.request(
      '/api/v1/team/my-team/tasks/' + encodeURIComponent(id) + '/assign',
      body,
    ) as Promise<TeamTaskResult>;
  }
  taskStatus(
    id: string,
    body: { requestId: string; version: number; action: string; reason?: string },
  ) {
    return this.auth.request(
      '/api/v1/team/my-team/tasks/' + encodeURIComponent(id) + '/status',
      body,
    ) as Promise<TeamTaskResult>;
  }
  saveGroup(body: SalesTeamInput, id?: string) {
    return this.auth.request(
      '/api/v1/team/groups' + (id ? '/' + encodeURIComponent(id) : ''),
      body,
    );
  }
  role(id: string, role: TeamRole) {
    return this.auth.request('/api/v1/team/' + encodeURIComponent(id) + '/role', { role });
  }
  assignRoles(id: string, roles: TeamRole[], version: number) {
    return this.auth.request('/api/v1/team/' + encodeURIComponent(id) + '/roles', {
      roles,
      version,
    });
  }
  invite(body: { name: string; email: string; role?: TeamRole; roles?: TeamRole[] }) {
    return this.auth.request('/api/v1/team/invite', body) as Promise<{
      status: string;
      accountId: string;
      token: string;
      expiresAt: string;
      email: string;
    }>;
  }
  resend(id: string) {
    return this.auth.request('/api/v1/team/' + id + '/resend', {}) as Promise<{
      token: string;
      expiresAt: string;
    }>;
  }
  revoke(id: string) {
    return this.auth.request('/api/v1/team/' + id + '/revoke', {});
  }
  status(id: string, action: 'disable' | 'enable') {
    return this.auth.request('/api/v1/team/' + id + '/status', { action });
  }
}
