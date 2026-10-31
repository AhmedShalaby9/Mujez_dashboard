import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

import { AuthService } from '../../../auth.service';
type RoleKey = string;
interface Permission {
  key: string;
  labelEn: string;
  labelAr: string;
}
interface RoleDef {
  key: string;
  nameEn: string;
  nameAr: string;
  locked: boolean;
  system: boolean;
  members: number;
  permissions: Set<string>;
  version: number;
}
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
    deleteRole: 'Archive role',
    deleteBlockedTitle: (name) => `Cannot delete ${name}`,
    deleteBlockedBody: (name, n) =>
      `${name} has ${n} ${n === 1 ? 'member' : 'members'}. Reassign them before deleting this role.`,
    deleteTitle: (name) => `Delete role — ${name}`,
    deleteBody: 'This empty custom role will be archived.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    newRoleTitle: 'New custom role',
    roleNameEn: 'Role name (English)',
    roleNameAr: 'Role name (Arabic)',
    roleNameError: 'Enter a role name.',
    create: 'Create role',
    grantTitle: (perm, role) => `Grant sensitive permission`,
    grantBody: (role) =>
      `"${role}" will gain this permission for every member. Requires re-authentication.`,
    revokeLockedToast: 'Super Admin permissions cannot be reduced.',
    codeLabel: 'Current password',
    codeError: 'Enter your current password.',
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
    deleteRole: 'أرشفة الدور',
    deleteBlockedTitle: (name) => `تعذّر حذف ${name}`,
    deleteBlockedBody: (name, n) =>
      `يضم ${name} عدد ${n} ${n === 1 ? 'عضو' : 'أعضاء'}. أعد توزيعهم قبل حذف هذا الدور.`,
    deleteTitle: (name) => `حذف الدور — ${name}`,
    deleteBody: 'سيتم أرشفة الدور المخصص الخالي من الأعضاء.',
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
    codeLabel: 'كلمة المرور الحالية',
    codeError: 'أدخل كلمة المرور الحالية.',
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
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './roles-permissions.scss'],
})
export class RolesPermissions {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly auth = inject(AuthService);
  readonly canManage = computed(() => this.auth.user()?.role === 'super_admin');
  readonly permissions = signal<Permission[]>([]);
  readonly roles = signal<RoleDef[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly reason = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.auth.request('/admin/api/v1/roles');
      this.permissions.set(r.permissions);
      this.roles.set(
        r.roles.map((x: any) => ({ ...x, permissions: new Set<string>(x.permissions) })),
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  clearAuth() {
    this.grantCode.set('');
    this.reason.set('');
    this.error.set('');
  }
  async mutate(path: string, body: object) {
    if (this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.auth.request('/admin/api/v1/roles' + path, {
        ...body,
        password: this.grantCode(),
        reason: this.reason().trim(),
      });
      this.grantCode.set('');
      await this.load();
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  readonly grantConfirm = signal<{ role: RoleDef; perm: Permission; on: boolean } | null>(null);
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

  /** Section for a permission key, derived from its prefix (the API has no group field). */
  private groupIndex(p: Permission): number {
    const k = p.key;
    if (k.startsWith('co.')) return 0;
    if (['plans', 'sub.manage', 'billing'].includes(k)) return 1;
    if (['features', 'usage', 'integrations', 'health'].includes(k)) return 2;
    if (['support', 'ann'].includes(k)) return 3;
    if (k.startsWith('ws.')) return 4;
    return 5;
  }
  group(p: Permission): string {
    const names: Array<[string, string]> = [
      ['Companies', 'الشركات'],
      ['Revenue', 'الإيرادات'],
      ['Platform', 'المنصة'],
      ['Operations', 'العمليات'],
      ['Workspace access', 'الوصول لمساحات العمل'],
      ['Administration', 'الإدارة'],
    ];
    return names[this.groupIndex(p)][this.lang() === 'ar' ? 1 : 0];
  }
  readonly sortedPerms = computed(() =>
    [...this.permissions()].sort((a, b) => this.groupIndex(a) - this.groupIndex(b)),
  );
  roleSub(r: RoleDef): string {
    const ar = this.lang() === 'ar';
    if (r.locked) return ar ? 'تحكم كامل · مقفل' : 'full control · locked';
    if (r.system) return ar ? 'دور مدمج' : 'built-in role';
    return ar ? 'دور مخصص' : 'custom role';
  }
  grantedCount(r: RoleDef) {
    return r.locked ? this.permissions().length : r.permissions.size;
  }
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
    return ['ws.manage', 'admins', 'settings', 'billing', 'co.suspend'].includes(p.key);
  }

  toggle(r: RoleDef, p: Permission) {
    if (r.locked || !this.canManage()) return;
    this.clearAuth();
    this.grantConfirm.set({ role: r, perm: p, on: !r.permissions.has(p.key) });
  }

  cancelGrant(): void {
    this.grantConfirm.set(null);
  }

  async confirmGrant() {
    const t = this.grantConfirm();
    if (
      t &&
      (await this.mutate('/' + t.role.key + '/permission', {
        version: t.role.version,
        permission: t.perm.key,
        enabled: t.on,
      }))
    ) {
      this.grantConfirm.set(null);
      this.showToast(
        t.on
          ? this.L().grantToast(this.permName(t.perm), this.name(t.role))
          : this.L().revokeToast(this.permName(t.perm), this.name(t.role)),
      );
    }
  }

  askDelete(r: RoleDef): void {
    this.clearAuth();
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

  async confirmDelete() {
    const r = this.deleteConfirm();
    if (r && (await this.mutate('/' + r.key + '/archive', { version: r.version }))) {
      this.deleteConfirm.set(null);
      this.showToast(this.L().deleteToast(this.name(r)));
    }
  }

  openCreateRole(): void {
    this.clearAuth();
    this.creatingRole.set(true);
    this.newRoleNameEn.set('');
    this.newRoleNameAr.set('');
    this.newRoleError.set(false);
  }

  closeCreateRole(): void {
    this.creatingRole.set(false);
  }

  async confirmCreateRole() {
    if (
      await this.mutate('', {
        nameEn: this.newRoleNameEn().trim(),
        nameAr: this.newRoleNameAr().trim(),
      })
    ) {
      this.creatingRole.set(false);
      this.showToast(this.L().createToast(this.newRoleNameEn()));
    }
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
