import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
@Component({
  selector: 'app-activate',
  imports: [FormsModule, RouterLink],
  template: `<main>
    <h1>Activate your {{ company ? 'company owner' : 'Mujez administrator' }} account</h1>
    <p>
      Set a password of at least 12 characters. This link expires after 24 hours and works once.
    </p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (done()) {
      <p role="status">Account activated.</p>
      <a routerLink="/">Sign in</a>
    } @else {
      <form (ngSubmit)="activate()">
        <label
          >New password<input
            type="password"
            autocomplete="new-password"
            name="password"
            [(ngModel)]="password"
            minlength="12"
            maxlength="256"
            required /></label
        ><label
          >Confirm password<input
            type="password"
            autocomplete="new-password"
            name="confirm"
            [(ngModel)]="confirm"
            required /></label
        ><button [disabled]="saving() || !token">Activate account</button>
      </form>
    }
  </main>`,
  styles: [
    `
      main {
        max-width: 480px;
        margin: 10vh auto;
        padding: 28px;
        font: 16px system-ui;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
      }
      label {
        display: block;
        margin: 16px 0;
      }
      input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 12px;
        margin-top: 6px;
      }
      button {
        padding: 12px;
        background: #4945cc;
        color: white;
        border: 0;
        border-radius: 6px;
      }
    `,
  ],
})
export class Activate {
  private readonly api = inject(AuthService);
  readonly password = signal('');
  readonly confirm = signal('');
  readonly error = signal('');
  readonly done = signal(false);
  readonly saving = signal(false);
  readonly company = location.pathname === '/activate/company';
  readonly token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  constructor() {
    history.replaceState(null, '', this.company ? '/activate/company' : '/activate');
  }
  async activate() {
    if (this.password() !== this.confirm()) {
      this.error.set('Passwords do not match');
      return;
    }
    if (this.password().length < 12 || this.password().length > 256) {
      this.error.set('Use a password of 12 to 256 characters');
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(
        this.company ? '/api/v1/auth/activate' : '/admin/api/v1/auth/activate',
        {
          token: this.token,
          password: this.password(),
        },
      );
      this.password.set('');
      this.confirm.set('');
      this.done.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
