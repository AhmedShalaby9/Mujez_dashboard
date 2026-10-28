import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type DefaultRoleKey = 'super' | 'platform_admin' | 'support_admin' | 'billing_admin';
type RoleKey = DefaultRoleKey | string;

interface Permission {
  key: string;
  labelEn: string;
  labelAr: string;
}

const PERMISSIONS: Permission[] = [
  { key: 'co.view', labelEn: 'View companies', labelAr: 'عرض الشركات' },
  { key: 'co.create', labelEn: 'Create companies', labelAr: 'إنشاء شركات' },
  { key: 'co.suspend', labelEn: 'Suspend / archive companies', labelAr: 'إيقاف وأرشفة الشركات' },
  { key: 'plans', labelEn: 'Manage plans', labelAr: 'إدارة الباقات' },
  { key: 'sub.manage', labelEn: 'Modify subscriptions', labelAr: 'تعديل الاشتراكات' },
  { key: 'billing', labelEn: 'Invoices & payments', labelAr: 'الفواتير والمدفوعات' },
  { key: 'features', labelEn: 'Feature management', labelAr: 'إدارة الخصائص' },
  { key: 'usage', labelEn: 'Usage & limits', labelAr: 'الاستخدام والحدود' },
  { key: 'integrations', labelEn: 'Integrations', labelAr: 'التكاملات' },
  { key: 'health', labelEn: 'System health', labelAr: 'صحة النظام' },
  { key: 'support', labelEn: 'Support tickets', labelAr: 'تذاكر الدعم' },
  { key: 'ann', labelEn: 'Announcements', labelAr: 'الإعلانات' },
  { key: 'ws.read', labelEn: 'Enter workspace (read-only)', labelAr: 'دخول مساحة العمل (قراءة)' },
  { key: 'ws.manage', labelEn: 'Workspace management mode', labelAr: 'وضع الإدارة في مساحة العمل' },
  { key: 'admins', labelEn: 'Platform users & roles', labelAr: 'مستخدمو المنصة والأدوار' },
  { key: 'audit', labelEn: 'Audit logs', labelAr: 'سجل التدقيق' },
  { key: 'settings', labelEn: 'System settings', labelAr: 'إعدادات النظام' },
];

const SENSITIVE = new Set(['ws.manage', 'admins', 'settings', 'billing', 'co.suspend']);
const ALL_KEYS = PERMISSIONS.map((p) => p.key);

interface RoleDef {
  key: RoleKey;
  nameEn: string;
  nameAr: string;
  locked: boolean;
  members: number;
  permissions: Set<string>;
}

function makeRole(key: RoleKey, nameEn: string, nameAr: string, locked: boolean, members: number, perms: string[]): RoleDef {
  return { key, nameEn, nameAr, locked, members, permissions: new Set(perms) };
}

const SEED_ROLES: RoleDef[] = [
  makeRole('super', 'Super Admin', 'مدير عام', true, 1, ALL_KEYS),
  makeRole('platform_admin', 'Platform Admin', 'مسؤول منصة', false, 2, [
    'co.view', 'co.create', 'sub.manage', 'features', 'usage', 'support', 'ann', 'ws.read', 'ws.manage', 'audit',
  ]),
  makeRole('support_admin', 'Support Admin', 'مسؤول دعم', false, 2, ['co.view', 'usage', 'support', 'ws.read', 'health']),
  makeRole('billing_admin', 'Billing Admin', 'مسؤول فوترة', false, 1, ['co.view', 'billing']),
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  newRoleBtn: string;
  colPermission: string;
  locked: string;
  membersLabel: (n: number) => string;
  deleteRole: string;
  deleteBlockedTitle: (name: string) => string;
  deleteBlockedBody: (name: string, n: number) => string;
  deleteTitle: (name: string) => string;
  deleteBody: string;
  cancel: string;
  confirm: string;
  ok: string;
  newRoleTitle: string;
  roleNameEn: string;
  roleNameAr: string;
  roleNameError: string;
  create: string;
  grantTitle: (perm: string, role: string) => string;
  grantBody: (role: string) => string;
  revokeLockedToast: string;
  codeLabel: string;
  codeError: string;
  grantToast: (perm: string, role: string) => string;
  revokeToast: (perm: string, role: string) => string;
  createToast: (name: string) => string;
  deleteToast: (name: string) => string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Administration',
    title: 'Roles & permissions',
    sub: 'Super Admin always has every permission',
    newRoleBtn: '+ New role',
    colPermission: 'Permission',
    locked: 'Locked',
    membersLabel: (n) => `${n} ${n === 1 ? 'member' : 'members'}`,
    deleteRole: 'Delete role',
    deleteBlockedTitle: (name) => `Cannot delete ${name}`,
    deleteBlockedBody: (name, n) => `${name} has ${n} ${n === 1 ? 'member' : 'members'}. Reassign them before deleting this role.`,
    deleteTitle: (name) => `Delete role — ${name}`,
    deleteBody: 'This cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    newRoleTitle: 'New custom role',
    roleNameEn: 'Role name (English)',
    roleNameAr: 'Role name (Arabic)',
    roleNameError: 'Enter a role name.',
    create: 'Create role',
    grantTitle: (perm, role) => `Grant sensitive permission`,
    grantBody: (role) => `"${role}" will gain this permission for every member. Requires re-authentication.`,
    revokeLockedToast: 'Super Admin permissions cannot be reduced.',
    codeLabel: 'TOTP code',
    codeError: 'Enter the 6-digit code.',
    grantToast: (perm, role) => `${perm} granted to ${role}.`,
    revokeToast: (perm, role) => `${perm} removed from ${role}.`,
    createToast: (name) => `${name} role created.`,
    deleteToast: (name) => `${name} role deleted.`,
  },
  ar: {
    eyebrow: 'الإدارة',
    title: 'الأدوار والصلاحيات',
    sub: 'المدير العام يملك دائمًا كل الصلاحيات',
    newRoleBtn: '+ دور جديد',
    colPermission: 'الصلاحية',
    locked: 'محمي',
    membersLabel: (n) => `${n} ${n === 1 ? 'عضو' : 'أعضاء'}`,
    deleteRole: 'حذف الدور',
    deleteBlockedTitle: (name) => `تعذّر حذف ${name}`,
    deleteBlockedBody: (name, n) => `يضم ${name} عدد ${n} ${n === 1 ? 'عضو' : 'أعضاء'}. أعد توزيعهم قبل حذف هذا الدور.`,
    deleteTitle: (name) => `حذف الدور — ${name}`,
    deleteBody: 'لا يمكن التراجع عن هذا الإجراء.',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    ok: 'حسنًا',
    newRoleTitle: 'دور مخصص جديد',
    roleNameEn: 'اسم الدور (إنجليزي)',
    roleNameAr: 'اسم الدور (عربي)',
    roleNameError: 'أدخل اسم الدور.',
    create: 'إنشاء الدور',
    grantTitle: (perm, role) => `منح صلاحية حساسة`,
    grantBody: (role) => `سيحصل دور "${role}" على هذه الصلاحية لكل أعضائه. يتطلب إعادة المصادقة.`,
    revokeLockedToast: 'لا يمكن تقليل صلاحيات المدير العام.',
    codeLabel: 'رمز TOTP',
    codeError: 'أدخل الرمز المكوّن من 6 أرقام.',
    grantToast: (perm, role) => `تم منح ${perm} لدور ${role}.`,
    revokeToast: (perm, role) => `تمت إزالة ${perm} من دور ${role}.`,
    createToast: (name) => `تم إنشاء دور ${name}.`,
    deleteToast: (name) => `تم حذف دور ${name}.`,
  },
};

@Component({
  selector: 'app-roles-permissions',
  imports: [FormsModule],
  templateUrl: './roles-permissions.html',
  styleUrl: './roles-permissions.scss',
})
export class RolesPermissions {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly permissions = PERMISSIONS;

  readonly roles = signal<RoleDef[]>(SEED_ROLES);

  readonly grantConfirm = signal<{ role: RoleDef; perm: Permission } | null>(null);
  readonly grantCode = signal('');
  readonly grantError = signal(false);

  readonly deleteBlocked = signal<RoleDef | null>(null);
  readonly deleteConfirm = signal<RoleDef | null>(null);

  readonly creatingRole = signal(false);
  readonly newRoleNameEn = signal('');
  readonly newRoleNameAr = signal('');
  readonly newRoleError = signal(false);

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  name(r: RoleDef): string {
    return this.lang() === 'ar' ? r.nameAr : r.nameEn;
  }

  permName(p: Permission): string {
    return this.lang() === 'ar' ? p.labelAr : p.labelEn;
  }

  has(r: RoleDef, p: Permission): boolean {
    return r.locked || r.permissions.has(p.key);
  }

  isSensitive(p: Permission): boolean {
    return SENSITIVE.has(p.key);
  }

  toggle(r: RoleDef, p: Permission): void {
    if (r.locked) {
      this.showToast(this.L().revokeLockedToast);
      return;
    }
    const on = r.permissions.has(p.key);
    if (!on && this.isSensitive(p)) {
      this.grantConfirm.set({ role: r, perm: p });
      this.grantCode.set('');
      this.grantError.set(false);
      return;
    }
    this.applyToggle(r, p, !on);
  }

  private applyToggle(r: RoleDef, p: Permission, on: boolean): void {
    this.roles.update((list) =>
      list.map((x) => {
        if (x.key !== r.key) return x;
        const next = new Set(x.permissions);
        if (on) next.add(p.key);
        else next.delete(p.key);
        return { ...x, permissions: next };
      }),
    );
    this.showToast(on ? this.L().grantToast(this.permName(p), this.name(r)) : this.L().revokeToast(this.permName(p), this.name(r)));
  }

  cancelGrant(): void {
    this.grantConfirm.set(null);
  }

  confirmGrant(): void {
    const target = this.grantConfirm();
    if (!target) return;
    if (!/^\d{6}$/.test(this.grantCode().trim())) {
      this.grantError.set(true);
      return;
    }
    this.applyToggle(target.role, target.perm, true);
    this.grantConfirm.set(null);
  }

  askDelete(r: RoleDef): void {
    if (r.members > 0) {
      this.deleteBlocked.set(r);
    } else {
      this.deleteConfirm.set(r);
    }
  }

  closeDeleteBlocked(): void {
    this.deleteBlocked.set(null);
  }

  cancelDelete(): void {
    this.deleteConfirm.set(null);
  }

  confirmDelete(): void {
    const r = this.deleteConfirm();
    if (!r) return;
    this.roles.update((list) => list.filter((x) => x.key !== r.key));
    this.deleteConfirm.set(null);
    this.showToast(this.L().deleteToast(this.name(r)));
  }

  openCreateRole(): void {
    this.creatingRole.set(true);
    this.newRoleNameEn.set('');
    this.newRoleNameAr.set('');
    this.newRoleError.set(false);
  }

  closeCreateRole(): void {
    this.creatingRole.set(false);
  }

  confirmCreateRole(): void {
    const en = this.newRoleNameEn().trim();
    const ar = this.newRoleNameAr().trim();
    if (!en || !ar) {
      this.newRoleError.set(true);
      return;
    }
    const key = 'custom-' + en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const role = makeRole(key || 'custom-' + Date.now(), en, ar, false, 0, ['co.view']);
    this.roles.update((list) => [...list, role]);
    this.creatingRole.set(false);
    this.showToast(this.L().createToast(en));
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
