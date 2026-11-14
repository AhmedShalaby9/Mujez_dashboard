import { Component, computed, inject, signal } from '@angular/core';
import { TeamApi, type SalesTeam } from '../../../team-api.service';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-my-team',
  templateUrl: './my-team.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../team/team.scss',
  ],
})
export class MyTeam {
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  private readonly api = inject(TeamApi);
  readonly teams = signal<SalesTeam[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  constructor() {
    void this.reload();
  }
  status(value: string) {
    return (
      (
        {
          active: this.t('Active', 'نشط'),
          invited: this.t('Invited', 'مدعو'),
          disabled: this.t('Disabled', 'معطّل'),
          locked: this.t('Locked', 'مقفل'),
        } as Record<string, string>
      )[value] ?? value
    );
  }
  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.teams.set((await this.api.myTeam()).items);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
