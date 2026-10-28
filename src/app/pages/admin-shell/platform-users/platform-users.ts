import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type RoleKey = 'super' | 'platform_admin' | 'support_admin' | 'billing_admin';
type UserStatus = 'active' | 'invited' | 'disabled';

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLogin: string;
}

const ME_ID = 'u-1';

const SEED: PlatformUser[] = [
  { id: 'u-1', name: 'Omar Khaled', email: 'omar@mujez.io', role: 'super', status: 'active', mfaEnabled: true, lastLogin: '12m ago' },
  { id: 'u-2', name: 'Sara Fouad', email: 'sara@mujez.io', role: 'platform_admin', status: 'active', mfaEnabled: true, lastLogin: '1h ago' },
  { id: 'u-3', name: 'Mostafa Adel', email: 'mostafa@mujez.io', role: 'support_admin', status: 'active', mfaEnabled: true, lastLogin: '3h ago' },
  { id: 'u-4', name: 'Hany Fathy', email: 'hany@mujez.io', role: 'billing_admin', status: 'active', mfaEnabled: false, lastLogin: '2d ago' },
  { id: 'u-5', name: 'Laila Hassan', email: 'laila@mujez.io', role: 'support_admin', status: 'invited', mfaEnabled: false, lastLogin: '—' },
  { id: 'u-6', name: 'Khaled Reda', email: 'khaled.r@mujez.io', role: 'platform_admin', status: 'disabled', mfaEnabled: true, lastLogin: '3w ago' },
];

const ROLE_ORDER: RoleKey[] = ['super', 'platform_admin', 'support_admin', 'billing_admin'];

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
    kpis: { total: 'Platform users', active: 'Active', invited: 'Invited (pending)', mfaOff: 'MFA not enabled' },
    inviteBtn: '+ Invite administrator',
    roleLabel: { super: 'Super Admin', platform_admin: 'Platform Admin', support_admin: 'Support Admin', billing_admin: 'Billing Admin' },
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
    inviteEmailLabel: 'Email (name@mujez.io)',
    inviteEmailError: 'Must be a @mujez.io address.',
    inviteRoleLabel: 'Role',
    cancel: 'Cancel',
    send: 'Send invitation',
    confirm: 'Confirm',
    changeRoleTitle: (name) => `Change role — ${name}`,
    revokeTitle: (name) => `Revoke sessions — ${name}`,
    revokeBody: 'Signs this administrator out of every device immediately.',
    resetMfaTitle: (name) => `Reset MFA — ${name}`,
    resetMfaBody: 'Requires a second Super Admin\'s approval and identity verification before it takes effect.',
    requestApproval: 'Request approval',
    disableTitle: (name) => `Disable ${name}`,
    disableBody: 'They immediately lose access to the Platform Admin portal.',
    enableTitle: (name) => `Enable ${name}`,
    enableBody: 'Restores their access to the Platform Admin portal.',
    reasonLabel: 'Reason',
    reasonError: 'A reason is required.',
    inviteToast: (email) => `Invitation sent to ${email}.`,
    roleToast: (name, role) => `${name}'s role changed to ${role}.`,
    revokeToast: (name) => `Sessions revoked for ${name}.`,
    mfaToast: (name) => `Approval requested from another Super Admin for ${name}.`,
    disableToast: (name) => `${name} disabled.`,
    enableToast: (name) => `${name} enabled.`,
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'مستخدمو المنصة',
    sub: 'مسؤولو مجاز الداخليون — منفصلون عن موظفي الشركات',
    kpis: { total: 'مستخدمو المنصة', active: 'نشطون', invited: 'مدعوون (قيد الانتظار)', mfaOff: 'بدون MFA' },
    inviteBtn: '+ دعوة مسؤول',
    roleLabel: { super: 'مدير عام', platform_admin: 'مسؤول منصة', support_admin: 'مسؤول دعم', billing_admin: 'مسؤول فوترة' },
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
    inviteEmailLabel: 'البريد (name@mujez.io)',
    inviteEmailError: 'يجب أن يكون البريد بنطاق @mujez.io.',
    inviteRoleLabel: 'الدور',
    cancel: 'إلغاء',
    send: 'إرسال الدعوة',
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
    inviteToast: (email) => `تم إرسال الدعوة إلى ${email}.`,
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
  styleUrl: './platform-users.scss',
})
export class PlatformUsers {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly roleOrder = ROLE_ORDER;
  readonly meId = ME_ID;

  readonly users = signal<PlatformUser[]>(SEED);
  readonly kebabFor = signal<string | null>(null);

  readonly inviting = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<RoleKey>('support_admin');
  readonly inviteError = signal(false);

  readonly roleChanging = signal<PlatformUser | null>(null);
  readonly roleDraft = signal<RoleKey>('support_admin');

  readonly revoking = signal<PlatformUser | null>(null);
  readonly resettingMfa = signal<PlatformUser | null>(null);

  readonly togglingStatus = signal<PlatformUser | null>(null);
  readonly statusReason = signal('');
  readonly statusError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  roleName(r: RoleKey): string {
    return this.L().roleLabel[r];
  }

  statusName(s: UserStatus): string {
    return this.L().statusLabel[s];
  }

  isMe(u: PlatformUser): boolean {
    return u.id === this.meId;
  }

  readonly kpis = computed(() => {
    const list = this.users();
    return {
      total: list.length,
      active: list.filter((u) => u.status === 'active').length,
      invited: list.filter((u) => u.status === 'invited').length,
      mfaOff: list.filter((u) => !u.mfaEnabled && u.status !== 'disabled').length,
    };
  });

  toggleKebab(u: PlatformUser): void {
    this.kebabFor.set(this.kebabFor() === u.id ? null : u.id);
  }

  closeKebab(): void {
    this.kebabFor.set(null);
  }

  openInvite(): void {
    this.inviting.set(true);
    this.inviteEmail.set('');
    this.inviteRole.set('support_admin');
    this.inviteError.set(false);
  }

  closeInvite(): void {
    this.inviting.set(false);
  }

  confirmInvite(): void {
    const email = this.inviteEmail().trim().toLowerCase();
    if (!/^[^\s@]+@mujez\.io$/.test(email)) {
      this.inviteError.set(true);
      return;
    }
    const name = email
      .split('@')[0]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
    const user: PlatformUser = {
      id: 'u-' + (this.users().length + 1 + Math.floor(Math.random() * 90)),
      name,
      email,
      role: this.inviteRole(),
      status: 'invited',
      mfaEnabled: false,
      lastLogin: '—',
    };
    this.users.update((list) => [user, ...list]);
    this.closeInvite();
    this.showToast(this.L().inviteToast(email));
  }

  askChangeRole(u: PlatformUser): void {
    this.closeKebab();
    this.roleChanging.set(u);
    this.roleDraft.set(u.role);
  }

  cancelChangeRole(): void {
    this.roleChanging.set(null);
  }

  confirmChangeRole(): void {
    const u = this.roleChanging();
    if (!u) return;
    const role = this.roleDraft();
    this.users.update((list) => list.map((x) => (x.id === u.id ? { ...x, role } : x)));
    this.roleChanging.set(null);
    this.showToast(this.L().roleToast(u.name, this.roleName(role)));
  }

  askRevoke(u: PlatformUser): void {
    this.closeKebab();
    this.revoking.set(u);
  }

  cancelRevoke(): void {
    this.revoking.set(null);
  }

  confirmRevoke(): void {
    const u = this.revoking();
    if (!u) return;
    this.revoking.set(null);
    this.showToast(this.L().revokeToast(u.name));
  }

  askResetMfa(u: PlatformUser): void {
    this.closeKebab();
    this.resettingMfa.set(u);
  }

  cancelResetMfa(): void {
    this.resettingMfa.set(null);
  }

  confirmResetMfa(): void {
    const u = this.resettingMfa();
    if (!u) return;
    this.resettingMfa.set(null);
    this.showToast(this.L().mfaToast(u.name));
  }

  askToggleStatus(u: PlatformUser): void {
    this.closeKebab();
    this.togglingStatus.set(u);
    this.statusReason.set('');
    this.statusError.set(false);
  }

  cancelToggleStatus(): void {
    this.togglingStatus.set(null);
  }

  confirmToggleStatus(): void {
    const u = this.togglingStatus();
    if (!u) return;
    const willDisable = u.status !== 'disabled';
    if (willDisable && this.statusReason().trim().length < 5) {
      this.statusError.set(true);
      return;
    }
    const nextStatus: UserStatus = willDisable ? 'disabled' : 'active';
    this.users.update((list) => list.map((x) => (x.id === u.id ? { ...x, status: nextStatus } : x)));
    this.togglingStatus.set(null);
    this.showToast(willDisable ? this.L().disableToast(u.name) : this.L().enableToast(u.name));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
