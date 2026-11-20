import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-employee',
  imports: [RouterLink],
  templateUrl: './employee.html',
  styleUrls: ['../../admin-shell/admin-ui.scss', '../company-ui.scss', './employee.scss'],
})
export class Employee {
  readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly data = signal<any>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.auth.request('/api/v1/employee/me'));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
