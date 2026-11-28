import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
/** Real-estate offices use these two; every other company type uses the
 * brokerage ladder below instead (see BROKERAGE_SALES_ROLES). */
export const OFFICE_SALES_ROLES = ['agent', 'team_lead'] as const;
/** The brokerage sales ladder, most junior first, plus Sales Admin. */
export const BROKERAGE_LADDER_ROLES = [
  'property_advisor',
  'property_consultant',
  'senior',
  'expert',
  'team_leader',
  'sales_manager',
  'sales_director',
  'head_of_sales',
] as const;
export const BROKERAGE_SALES_ROLES = [...BROKERAGE_LADDER_ROLES, 'sales_admin'] as const;
/** Any role that can be a "my team" member/lead, across both company types. */
export const TEAM_MEMBER_ROLES = [...OFFICE_SALES_ROLES, ...BROKERAGE_LADDER_ROLES] as const;
/** Only the company admin may grant or remove these; mirrors the backend. */
export const ADMIN_ONLY_ROLES: readonly string[] = [
  'finance_manager',
  'accountant',
  'hr_manager',
  'sales_admin',
];
export const TEAM_ROLES = [
  ...OFFICE_SALES_ROLES,
  ...BROKERAGE_SALES_ROLES,
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
export type ColdCallOutcome =
  'no_answer' | 'busy' | 'wrong_number' | 'not_interested' | 'interested' | 'callback';
export interface ColdCallMetrics {
  calls: number;
  convertedToLeads: number;
  overdueCallbacks: number;
  outcomes: Record<ColdCallOutcome, number>;
}
export interface TeamPerformance {
  coldCalls?: {
    summary: ColdCallMetrics;
    items: (ColdCallMetrics & { id: string; name: string; role: string; status: string })[];
  };
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
export interface AgentPermissions {
  viewSale: boolean;
  viewRent: boolean;
  viewPhones: boolean;
  addClient: boolean;
  addProperty: boolean;
  editData: boolean;
  deleteProperties: boolean;
  allCities: boolean;
  cityIds: string[];
  version: number;
}
export interface OfficeCity {
  id: string;
  nameEn: string;
  nameAr: string;
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
  invite(body: {
    name: string;
    email: string;
    role?: TeamRole;
    roles?: TeamRole[];
    department?: 'marketing' | 'sales' | 'hr' | 'finance';
    salaryMinor?: string;
  }) {
    return this.auth.request('/api/v1/team/invite', body) as Promise<{
      status: string;
      accountId: string;
      userId: string;
      token: string;
      expiresAt: string;
      email: string;
    }>;
  }
  officeCities() {
    return this.auth.request('/api/v1/office/cities?archived=false') as Promise<{
      items: OfficeCity[];
    }>;
  }
  agentPermissions(userId: string) {
    return this.auth.request(
      '/api/v1/office/agents/' + encodeURIComponent(userId) + '/permissions',
    ) as Promise<AgentPermissions>;
  }
  saveAgentPermissions(
    userId: string,
    body: { requestId: string; version: number; data: Omit<AgentPermissions, 'version'> },
  ) {
    return this.auth.request(
      '/api/v1/office/agents/' + encodeURIComponent(userId) + '/permissions',
      body,
    ) as Promise<{ version: number }>;
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
