import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  template: `<main>
    <section>
      <p>Mujez · موچز</p>
      <h1>Choose your password<br /><small>اختر كلمة المرور الجديدة</small></h1>
      <p>
        Your account uses a temporary password. Change it before entering your company workspace.<br />يجب
        تغيير كلمة المرور المؤقتة قبل الدخول إلى مساحة عمل الشركة.
      </p>
      <form (ngSubmit)="save()">
        <label
          >Current temporary password · كلمة المرور المؤقتة<input
            type="password"
            name="current"
            [(ngModel)]="current"
            autocomplete="current-password"
            required
            maxlength="256" /></label
        ><label
          >New password · كلمة المرور الجديدة<input
            type="password"
            name="next"
            [(ngModel)]="next"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="256" /></label
        ><label
          >Confirm new password · تأكيد كلمة المرور<input
            type="password"
            name="confirm"
            [(ngModel)]="confirm"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="256"
        /></label>
        <p>At least 12 characters · ١٢ حرفًا على الأقل</p>
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        <button [disabled]="busy()">
          {{ busy() ? 'Saving… · جار الحفظ…' : 'Save and continue · حفظ ومتابعة' }}
        </button>
      </form>
      <button class="quiet" (click)="logout()" [disabled]="busy()">Sign out · تسجيل الخروج</button>
    </section>
  </main>`,
  styleUrls: ['./auth-form.scss'],
})
export class ChangePassword {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  current = '';
  next = '';
  confirm = '';
  readonly error = signal('');
  readonly busy = signal(false);
  async save() {
    if (this.busy()) return;
    this.error.set('');
    if (this.next.length < 12 || this.next !== this.confirm || this.next === this.current) {
      this.error.set(
        'Use matching passwords of at least 12 characters, different from the temporary password. استخدم كلمة مرور مختلفة ومطابقة للتأكيد، بطول ١٢ حرفًا على الأقل.',
      );
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.request('/api/v1/auth/change-password', {
        currentPassword: this.current,
        newPassword: this.next,
      });
      this.current = this.next = this.confirm = '';
      if (!(await this.auth.restore())) throw Error('Please sign in again.');
      await this.router.navigateByUrl(this.auth.homePath());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
