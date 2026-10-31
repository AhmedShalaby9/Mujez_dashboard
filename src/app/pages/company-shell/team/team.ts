import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CompanyUiState } from '../company-ui-state';
import { TeamApi, TEAM_ROLES, type TeamMember, type TeamRole } from '../../../team-api.service';

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

  readonly roles = TEAM_ROLES;
  readonly roleNames: Record<TeamRole, { en: string; ar: string }> = {
    agent: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
  };
  readonly statusNames: Record<TeamMember['status'], { en: string; ar: string }> = {
    invited: { en: 'Invited', ar: 'تمت الدعوة' },
    active: { en: 'Active', ar: 'نشط' },
    disabled: { en: 'Disabled', ar: 'معطّل' },
  };

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
  readonly inviteRole = signal<TeamRole>('agent');
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
      const r = await this.api.list();
      this.items.set(r.items);
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
    this.inviteRole.set('agent');
    this.inviteError.set('');
    this.inviteLink.set('');
  }
  closeInvite() {
    if (this.inviting()) return;
    this.inviteOpen.set(false);
  }

  async submitInvite() {
    if (this.inviting()) return;
    this.inviting.set(true);
    this.inviteError.set('');
    try {
      const r = await this.api.invite({
        name: this.inviteName().trim(),
        email: this.inviteEmail().trim(),
        role: this.inviteRole(),
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
