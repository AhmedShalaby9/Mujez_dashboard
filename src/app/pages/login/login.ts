import { PlatformConfig } from '../../platform-config.service';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { Component, computed, inject, signal, effect } from '@angular/core';

type Lang = 'en' | 'ar';
type View = 'signin' | 'forgot';

interface Copy {
  brand: string;
  platformPortal: string;
  kicker: string;
  headline: string;
  sub: string;
  points: string[];
  title: string;
  titleSub: string;
  email: string;
  password: string;
  forgot: string;
  remember: string;
  signIn: string;
  signingIn: string;
  show: string;
  hide: string;
  notice: string;
  fTitle: string;
  forgotSub: string;
  fBtn: string;
  fSent: string;
  back: string;
  foot: string;
  otherLang: string;
  emailErr: string;
  passErr: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    brand: 'Mujez',
    platformPortal: 'Platform Portal',
    kicker: 'Admin Access',
    headline: 'Manage every side of the Mujez platform from one console.',
    sub: 'Operations, companies, subscriptions, and support — all in one secure workspace built for the Mujez team.',
    points: [
      'Real-time visibility across every company workspace',
      'Role-based access with full audit history',
      'One console for billing, support, and platform health',
    ],
    title: 'Sign in',
    titleSub: 'Welcome back. Enter your admin credentials to continue.',
    email: 'Email',
    password: 'Password',
    forgot: 'Forgot password?',
    remember: 'Remember me on this device',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    show: 'Show',
    hide: 'Hide',
    notice: 'This console is restricted to authorized Mujez staff. Access attempts are logged.',
    fTitle: 'Reset your password',
    forgotSub: "Enter the email linked to your admin account and we'll send a reset link.",
    fBtn: 'Send reset link',
    fSent: 'If that email exists, a reset link is on its way. Check your inbox.',
    back: 'Back to sign in',
    foot: 'Need access? Contact your platform administrator.',
    otherLang: 'العربية',
    emailErr: 'Enter a valid email address.',
    passErr: 'Password is required.',
  },
  ar: {
    brand: 'مجاز',
    platformPortal: 'بوابة المنصة',
    kicker: 'دخول المشرفين',
    headline: 'إدارة جميع جوانب منصة مجاز من مكان واحد.',
    sub: 'العمليات، الشركات، الاشتراكات والدعم — كل ذلك في مساحة عمل آمنة مخصصة لفريق مجاز.',
    points: [
      'رؤية فورية لكل مساحات عمل الشركات',
      'صلاحيات وصول حسب الدور مع سجل تدقيق كامل',
      'لوحة واحدة للفواتير والدعم وصحة المنصة',
    ],
    title: 'تسجيل الدخول',
    titleSub: 'مرحبًا بعودتك. أدخل بيانات حساب المشرف للمتابعة.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    forgot: 'نسيت كلمة المرور؟',
    remember: 'تذكرني على هذا الجهاز',
    signIn: 'تسجيل الدخول',
    signingIn: 'جارٍ تسجيل الدخول…',
    show: 'عرض',
    hide: 'إخفاء',
    notice: 'هذه اللوحة مخصصة لموظفي مجاز المعتمدين فقط. يتم تسجيل كل محاولات الدخول.',
    fTitle: 'إعادة تعيين كلمة المرور',
    forgotSub: 'أدخل البريد الإلكتروني المرتبط بحساب المشرف وسنرسل لك رابط إعادة التعيين.',
    fBtn: 'إرسال رابط إعادة التعيين',
    fSent: 'إذا كان هذا البريد مسجلاً، فسيصلك رابط إعادة التعيين. تحقق من بريدك الوارد.',
    back: 'الرجوع لتسجيل الدخول',
    foot: 'تحتاج صلاحية وصول؟ تواصل مع مسؤول المنصة.',
    otherLang: 'English',
    emailErr: 'أدخل بريدًا إلكترونيًا صالحًا.',
    passErr: 'كلمة المرور مطلوبة.',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  readonly config = inject(PlatformConfig);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private chosenLang = false;
  readonly lang = signal<Lang>('en');
  constructor() {
    effect(() => {
      const l = this.config.branding().defaultLang;
      if (!this.chosenLang) this.lang.set(l === 'ar' ? 'ar' : 'en');
    });
  }
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  readonly L = computed(() => COPY[this.lang()]);

  readonly view = signal<View>('signin');

  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly remember = signal(false);
  readonly loading = signal(false);

  readonly emailTouched = signal(false);
  readonly passwordTouched = signal(false);
  readonly formError = signal('');

  readonly forgotEmail = signal('');
  readonly forgotTouched = signal(false);
  readonly forgotSent = signal(false);
  readonly forgotLoading = signal(false);

  readonly emailInvalid = computed(
    () => this.emailTouched() && !EMAIL_RE.test(this.email().trim()),
  );
  readonly passwordInvalid = computed(() => this.passwordTouched() && this.password().length === 0);
  readonly forgotEmailInvalid = computed(
    () => this.forgotTouched() && !EMAIL_RE.test(this.forgotEmail().trim()),
  );

  toggleLang(): void {
    this.chosenLang = true;
    this.lang.set(this.lang() === 'en' ? 'ar' : 'en');
  }

  toggleShowPassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleRemember(): void {
    this.remember.set(!this.remember());
  }

  setEmail(value: string): void {
    this.email.set(value);
    this.formError.set('');
  }

  setPassword(value: string): void {
    this.password.set(value);
    this.formError.set('');
  }

  openForgot(): void {
    this.forgotEmail.set(this.email());
    this.forgotSent.set(false);
    this.forgotTouched.set(false);
    this.view.set('forgot');
  }

  closeForgot(): void {
    this.view.set('signin');
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    if (this.emailInvalid() || this.passwordInvalid()) {
      this.formError.set(this.L().emailErr);
      return;
    }

    this.loading.set(true);
    this.formError.set('');
    try {
      await this.auth.login(this.email().trim(), this.password(), this.remember());
      this.password.set('');
      await this.router.navigateByUrl('/admin/dashboard');
    } catch (error) {
      this.formError.set(
        this.lang() === 'ar'
          ? 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مجددًا.'
          : 'Unable to sign in. Check your credentials and try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  sendReset(): void {
    this.forgotTouched.set(true);
    if (this.forgotEmailInvalid()) {
      return;
    }

    this.formError.set(
      this.lang() === 'ar'
        ? 'تواصل مع مسؤول المنصة لإعادة تعيين كلمة المرور.'
        : 'Contact your platform administrator to reset your password.',
    );
  }
}
