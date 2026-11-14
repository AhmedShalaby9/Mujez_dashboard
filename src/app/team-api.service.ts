import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
export const TEAM_ROLES = ['agent', 'team_lead'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
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
  saveGroup(body: SalesTeamInput, id?: string) {
    return this.auth.request(
      '/api/v1/team/groups' + (id ? '/' + encodeURIComponent(id) : ''),
      body,
    );
  }
  role(id: string, role: TeamRole) {
    return this.auth.request('/api/v1/team/' + encodeURIComponent(id) + '/role', { role });
  }
  invite(body: { name: string; email: string; role: TeamRole }) {
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
