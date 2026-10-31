import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type RoleKey = string;
type UserStatus = 'active' | 'invited' | 'disabled';

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  status: UserStatus;
  mfaEnabled: boolean | null;
  version: number;
  activeSessions: number;
  lastLogin: string | null;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  kpis: { total: string; active: string; invited: string; mfaOff: string };
  inviteBtn: string;
  roleLabel: Record<RoleKey, string>;
  statusLabel: Record<UserStatus, string>;
  colUser: string;
  colRole: string;
  colStatus: string;
  colMfa: string;
  colLastLogin: string;
  you: string;
  changeRole: string;
  revokeSessions: string;
  resetMfa: string;
  disable: string;
  enable: string;
  inviteTitle: string;
  inviteEmailLabel: string;
  inviteEmailError: string;
  inviteRoleLabel: string;
  cancel: string;
  send: string;
  confirm: string;
  changeRoleTitle: (name: string) => string;
  revokeTitle: (name: string) => string;
  revokeBody: string;
  resetMfaTitle: (name: string) => string;
  resetMfaBody: string;
  requestApproval: string;
  disableTitle: (name: string) => string;
  disableBody: string;
  enableTitle: (name: string) => string;
  enableBody: string;
  reasonLabel: string;
  reasonError: string;
  inviteToast: (email: string) => string;
  roleToast: (name: string, role: string) => string;
  revokeToast: (name: string) => string;
  mfaToast: (name: string) => string;
  disableToast: (name: string) => string;
  enableToast: (name: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Platform users',
    sub: 'Mujez internal administrators — separate from tenant employees',
    kpis: {
      total: 'Platform users',
      active: 'Active',
      invited: 'Invited (pending)',
      mfaOff: 'Active sessions',
    },
    inviteBtn: '+ Invite administrator',
    roleLabel: {
      super: 'Super Admin',
      platform_admin: 'Platform Admin',
      support_admin: 'Support Admin',
      billing_admin: 'Billing Admin',
    },
    statusLabel: { active: 'Active', invited: 'Invited', disabled: 'Disabled' },
    colUser: 'Administrator',
    colRole: 'Role',
    colStatus: 'Status',
    colMfa: 'MFA',
    colLastLogin: 'Last login',
    you: 'You',
    changeRole: 'Change role',
    revokeSessions: 'Revoke sessions',
    resetMfa: 'Reset MFA',
    disable: 'Disable',
    enable: 'Enable',
    inviteTitle: 'Invite administrator',
    inviteEmailLabel: 'Email',
    inviteEmailError: 'Enter a valid email address.',
    inviteRoleLabel: 'Role',
    cancel: 'Cancel',
    send: 'Create activation link',
    confirm: 'Confirm',
    changeRoleTitle: (name) => `Change role — ${name}`,
    revokeTitle: (name) => `Revoke sessions — ${name}`,
    revokeBody: 'Signs this administrator out of every device immediately.',
    resetMfaTitle: (name) => `Reset MFA — ${name}`,
    resetMfaBody:
      "Requires a second Super Admin's approval and identity verification before it takes effect.",
    requestApproval: 'Request approval',
    disableTitle: (name) => `Disable ${name}`,
    disableBody: 'They immediately lose access to the Platform Admin portal.',
    enableTitle: (name) => `Enable ${name}`,
    enableBody: 'Restores their access to the Platform Admin portal.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    inviteToast: (email) =>
      `Activation link created for ${email}. Share it securely; no email was sent.`,
    roleToast: (name, role) => `${name}'s role changed to ${role}.`,
    revokeToast: (name) => `Sessions revoked for ${name}.`,
    mfaToast: (name) => `Approval requested from another Super Admin for ${name}.`,
    disableToast: (name) => `${name} disabled.`,
    enableToast: (name) => `${name} enabled.`,
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'مستخدمو المنصة',
    sub: 'مسؤولو موچز الداخليون — منفصلون عن موظفي الشركات',
    kpis: {
      total: 'مستخدمو المنصة',
      active: 'نشطون',
      invited: 'مدعوون (قيد الانتظار)',
      mfaOff: 'الجلسات النشطة',
    },
    inviteBtn: '+ دعوة مسؤول',
    roleLabel: {
      super: 'مدير عام',
      platform_admin: 'مسؤول منصة',
      support_admin: 'مسؤول دعم',
      billing_admin: 'مسؤول فوترة',
    },
    statusLabel: { active: 'نشط', invited: 'مدعو', disabled: 'معطّل' },
    colUser: 'المسؤول',
    colRole: 'الدور',
    colStatus: 'الحالة',
    colMfa: 'MFA',
    colLastLogin: 'آخر دخول',
    you: 'أنت',
    changeRole: 'تغيير الدور',
    revokeSessions: 'إلغاء الجلسات',
    resetMfa: 'إعادة ضبط MFA',
    disable: 'تعطيل',
    enable: 'تفعيل',
    inviteTitle: 'دعوة مسؤول',
    inviteEmailLabel: 'البريد الإلكتروني',
    inviteEmailError: 'أدخل بريدًا إلكترونيًا صحيحًا.',
    inviteRoleLabel: 'الدور',
    cancel: 'إلغاء',
    send: 'إنشاء رابط تفعيل',
    confirm: 'تأكيد',
    changeRoleTitle: (name) => `تغيير الدور — ${name}`,
    revokeTitle: (name) => `إلغاء الجلسات — ${name}`,
    revokeBody: 'يسجل خروج هذا المسؤول من كل الأجهزة فورًا.',
    resetMfaTitle: (name) => `إعادة ضبط MFA — ${name}`,
    resetMfaBody: 'يتطلب موافقة مدير عام آخر والتحقق من الهوية قبل التنفيذ.',
    requestApproval: 'طلب الموافقة',
    disableTitle: (name) => `تعطيل ${name}`,
    disableBody: 'سيفقد الوصول إلى لوحة إدارة المنصة فورًا.',
    enableTitle: (name) => `تفعيل ${name}`,
    enableBody: 'يستعيد الوصول إلى لوحة إدارة المنصة.',
    reasonLabel: 'السبب',
    reasonError: 'السبب مطلوب.',
    inviteToast: (email) => `تم إنشاء رابط تفعيل لـ ${email}. لم يتم إرسال بريد.`,
    roleToast: (name, role) => `تم تغيير دور ${name} إلى ${role}.`,
    revokeToast: (name) => `تم إلغاء جلسات ${name}.`,
    mfaToast: (name) => `تم طلب الموافقة من مدير عام آخر لـ ${name}.`,
    disableToast: (name) => `تم تعطيل ${name}.`,
    enableToast: (name) => `تم تفعيل ${name}.`,
  },
};

@Component({
  selector: 'app-platform-users',
  imports: [FormsModule],
  templateUrl: './platform-users.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './platform-users.scss'],
})
export class PlatformUsers {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly auth = inject(AuthService);
  readonly canManage = computed(() => this.auth.user()?.role === 'super_admin');
  readonly roles = signal<Array<{ key: string; nameEn: string; nameAr: string }>>([]);
  readonly roleOrder = computed(() =>
    this.roles()
      .filter((r) => r.key !== 'super_admin')
      .map((r) => r.key),
  );
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly password = signal('');
  readonly reason = signal('');
  readonly inviteName = signal('');
  readonly activationLink = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const roles = await this.auth.request('/admin/api/v1/roles');
      this.roles.set(roles.roles);
      const items: PlatformUser[] = [];
      let page = 1;
      while (true) {
        const r = await this.auth.request(
          '/admin/api/v1/platform-users?page=' + page + '&limit=100',
        );
        items.push(...r.items);
        if (items.length >= r.total || !r.items.length) break;
        page++;
      }
      this.users.set(items);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  credentials() {
    return { password: this.password(), reason: this.reason().trim() };
  }
  clearAuth() {
    this.password.set('');
    this.reason.set('');
    this.error.set('');
  }
  async mutate(u: PlatformUser, action: string, extra: object = {}) {
    if (this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      const r = await this.auth.request('/admin/api/v1/platform-users/' + u.id + '/' + action, {
        version: u.version,
        ...extra,
        ...this.credentials(),
      });
      this.password.set('');
      if (r.token) this.activationLink.set(location.origin + '/activate#token=' + r.token);
      await this.load();
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }
  async reissue(u: PlatformUser) {
    this.revoking.set(u);
    this.reissuing.set(true);
    this.clearAuth();
  }
  readonly reissuing = signal(false);

  readonly users = signal<PlatformUser[]>([]);
  readonly kebabFor = signal<string | null>(null);

  readonly inviting = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<RoleKey>('support_admin');
  readonly inviteError = signal(false);

  readonly roleChanging = signal<PlatformUser | null>(null);
  readonly roleDraft = signal<RoleKey>('support_admin');

  readonly revoking = signal<PlatformUser | null>(null);

  readonly togglingStatus = signal<PlatformUser | null>(null);
  readonly statusReason = signal('');
  readonly statusError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  roleName(r: RoleKey): string {
    const role = this.roles().find((x) => x.key === r);
    return role ? (this.lang() === 'ar' ? role.nameAr : role.nameEn) : r;
  }

  statusName(s: UserStatus): string {
    return this.L().statusLabel[s];
  }

  isMe(u: PlatformUser): boolean {
    return u.id === this.auth.user()?.id;
  }

  readonly kpis = computed(() => {
    const list = this.users();
    return {
      total: list.length,
      active: list.filter((u) => u.status === 'active').length,
      invited: list.filter((u) => u.status === 'invited').length,
      mfaOff: list.reduce((n, u) => n + u.activeSessions, 0),
    };
  });

  readonly statusFilter = signal<UserStatus | 'all'>('all');
  readonly search = signal('');
  readonly filtered = computed(() => {
    const st = this.statusFilter(),
      q = this.search().trim().toLowerCase();
    return this.users().filter(
      (u) =>
        (st === 'all' || u.status === st) &&
        (!q || (u.name + ' ' + u.email).toLowerCase().includes(q)),
    );
  });
  readonly tabs = computed(() =>
    (['all', 'active', 'invited', 'disabled'] as Array<UserStatus | 'all'>).map((k) => ({
      k,
      label: k === 'all' ? (this.lang() === 'ar' ? 'الكل' : 'All') : this.statusName(k),
      n: k === 'all' ? this.users().length : this.users().filter((u) => u.status === k).length,
    })),
  );
  readonly superCount = computed(() => this.users().filter((u) => u.role === 'super_admin').length);
  /** Own account and Super Admins are protected from UI role/status changes (backend rule). */
  protectedUser(u: PlatformUser) {
    return this.isMe(u) || u.role === 'super_admin';
  }
  statusPill(s: UserStatus) {
    return (
      {
        active: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
        invited: { bg: '#EAEFFD', fg: '#2E47A8', dot: '#5B78E5' },
        disabled: { bg: '#F1F1ED', fg: '#6E6E73', dot: '#B4B4AE' },
      } as Record<UserStatus, { bg: string; fg: string; dot: string }>
    )[s];
  }
  initials(u: PlatformUser) {
    return u.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
  lastLogin(u: PlatformUser) {
    const ar = this.lang() === 'ar';
    if (!u.lastLogin) return u.status === 'invited' ? '—' : ar ? 'غير معروف' : 'Unknown';
    const m = Math.max(0, Math.round((Date.now() - new Date(u.lastLogin).getTime()) / 60000));
    if (m < 2) return ar ? 'الآن' : 'Now';
    if (m < 60) return ar ? `منذ ${m} دقيقة` : `${m} min ago`;
    if (m < 1440) return ar ? `منذ ${Math.round(m / 60)} ساعة` : `${Math.round(m / 60)} h ago`;
    return ar ? `منذ ${Math.round(m / 1440)} يوم` : `${Math.round(m / 1440)} d ago`;
  }
  mfaSoon() {
    this.closeKebab();
    this.showToast(
      this.lang() === 'ar'
        ? 'التحقق الثنائي غير مدعوم بعد في الخادم.'
        : "Two-factor authentication isn't supported by the backend yet.",
    );
  }
  toggleKebab(u: PlatformUser): void {
    this.kebabFor.set(this.kebabFor() === u.id ? null : u.id);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  openInvite(): void {
    this.clearAuth();
    this.inviteName.set('');
    this.inviting.set(true);
    this.inviteEmail.set('');
    this.inviteRole.set('support_admin');
    this.inviteError.set(false);
  }

  closeInvite(): void {
    this.inviting.set(false);
  }

  async confirmInvite() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const r = await this.auth.request('/admin/api/v1/platform-users', {
        name: this.inviteName().trim(),
        email: this.inviteEmail().trim().toLowerCase(),
        role: this.inviteRole(),
        ...this.credentials(),
      });
      this.activationLink.set(location.origin + '/activate#token=' + r.token);
      this.password.set('');
      this.closeInvite();
      await this.load();
      this.showToast(this.L().inviteToast(this.inviteEmail()));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  askChangeRole(u: PlatformUser): void {
    this.closeKebab();
    this.clearAuth();
    this.roleChanging.set(u);
    this.roleDraft.set(u.role);
  }

  cancelChangeRole(): void {
    this.roleChanging.set(null);
  }

  async confirmChangeRole() {
    const u = this.roleChanging();
    if (u && (await this.mutate(u, 'role', { role: this.roleDraft() }))) {
      this.roleChanging.set(null);
      this.showToast(this.L().roleToast(u.name, this.roleName(this.roleDraft())));
    }
  }

  askRevoke(u: PlatformUser): void {
    this.closeKebab();
    this.clearAuth();
    this.reissuing.set(false);
    this.revoking.set(u);
  }

  cancelRevoke(): void {
    this.revoking.set(null);
  }

  async confirmRevoke() {
    const u = this.revoking();
    if (u && (await this.mutate(u, this.reissuing() ? 'reissue' : 'revoke'))) {
      this.revoking.set(null);
      this.showToast(
        this.reissuing() ? 'New activation link created' : this.L().revokeToast(u.name),
      );
    }
  }

  askToggleStatus(u: PlatformUser): void {
    this.closeKebab();
    this.clearAuth();
    this.togglingStatus.set(u);
    this.statusReason.set('');
    this.statusError.set(false);
  }

  cancelToggleStatus(): void {
    this.togglingStatus.set(null);
  }

  async confirmToggleStatus() {
    const u = this.togglingStatus();
    if (
      u &&
      (await this.mutate(u, 'status', { status: u.status === 'disabled' ? 'active' : 'disabled' }))
    ) {
      this.togglingStatus.set(null);
      this.showToast(
        u.status === 'disabled' ? this.L().enableToast(u.name) : this.L().disableToast(u.name),
      );
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
