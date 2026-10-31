import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
export const TEAM_ROLES = ['agent'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  roleName: { en: string; ar: string };
  status: 'invited' | 'active' | 'disabled';
  invitationExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly auth = inject(AuthService);
  list() {
    return this.auth.request('/api/v1/team') as Promise<{ items: TeamMember[] }>;
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
