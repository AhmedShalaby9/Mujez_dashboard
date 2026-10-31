import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
@Component({
  selector: 'app-activate',
  imports: [FormsModule, RouterLink],
  template: `<main>
    <h1>
      Activate your {{ team ? 'team' : company ? 'company owner' : 'Mujez administrator' }}
      account
    </h1>
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
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg, #f4f4f1);
      }
      main {
        max-width: 480px;
        margin: 0 auto;
        padding: 28px;
        font: 16px var(--font-ui, 'Geist', system-ui, sans-serif);
        color: var(--ink, #111113);
        background: var(--surface, #fff);
        border: 1px solid var(--border-card, #e2e2dc);
        border-radius: var(--r-card, 12px);
        position: relative;
        top: 10vh;
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
        border: 1px solid var(--border-input, #c4c4be);
        border-radius: var(--r-control, 9px);
        font: inherit;
      }
      button {
        padding: 12px;
        background: var(--primary, #111113);
        color: white;
        border: 0;
        border-radius: var(--r-control, 9px);
        cursor: pointer;
      }
      button:hover:not(:disabled) {
        background: var(--primary-hover, #2a2b30);
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      p[role='alert'] {
        color: var(--danger-text, #a23624);
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
  readonly team = location.pathname === '/activate/team';
  readonly token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  constructor() {
    history.replaceState(
      null,
      '',
      this.team ? '/activate/team' : this.company ? '/activate/company' : '/activate',
    );
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
        this.team
          ? '/api/v1/team/activate'
          : this.company
            ? '/api/v1/auth/activate'
            : '/admin/api/v1/auth/activate',
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
