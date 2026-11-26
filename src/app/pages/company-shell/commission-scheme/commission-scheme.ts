import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import {
  CommissionSchemeApi,
  type CommissionRole,
  type CommissionRoleKey,
  type CommissionTier,
  type CommissionTierKind,
} from '../../../commission-scheme-api.service';

const ROLE_NAMES: Record<CommissionRoleKey, { en: string; ar: string }> = {
  property_advisor: { en: 'Property Advisor', ar: 'مستشار عقاري' },
  property_consultant: { en: 'Property Consultant', ar: 'استشاري عقاري' },
  senior: { en: 'Senior', ar: 'سينيور' },
  expert: { en: 'Expert', ar: 'إكسبرت' },
  team_leader: { en: 'Team Leader', ar: 'قائد الفريق' },
  sales_manager: { en: 'Sales Manager', ar: 'مدير مبيعات' },
  sales_director: { en: 'Sales Director', ar: 'مدير إدارة المبيعات' },
  head_of_sales: { en: 'Head of Sales', ar: 'رئيس قطاع المبيعات' },
};

@Component({
  selector: 'app-commission-scheme',
  imports: [FormsModule],
  templateUrl: './commission-scheme.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    './commission-scheme.scss',
  ],
})
export class CommissionScheme {
  private readonly api = inject(CommissionSchemeApi);
  private readonly auth = inject(AuthService);
  readonly ui = inject(CompanyUiState);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  roleName(key: CommissionRoleKey) {
    return ROLE_NAMES[key][this.lang()];
  }
  readonly isBrokerage = computed(() => {
    const u = this.auth.user();
    return (u?.company?.type ?? u?.workspace?.company?.type) === 'brokerage';
  });
  readonly canEdit = computed(
    () =>
      this.auth.user()?.pool === 'company_admin' &&
      this.auth.user()?.role === 'company_owner' &&
      !this.auth.user()?.workspace,
  );
  readonly roles = signal<CommissionRole[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    if (this.isBrokerage()) void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get();
      this.roles.set(r.roles.map((role) => ({ ...role, tiers: role.tiers.map((t) => ({ ...t })) })));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  tierKindLabel(kind: CommissionTierKind) {
    return kind === 'percent'
      ? this.t('% of target', '% من التارجت')
      : this.t('Quarterly volume (EGP)', 'الحجم الربعي (جنيه)');
  }

  addTier(role: CommissionRole) {
    const kind: CommissionTierKind = role.tiers[role.tiers.length - 1]?.kind ?? 'volume';
    role.tiers = [...role.tiers, { kind, threshold: 0, ratePerMillion: 0 }];
    this.roles.set([...this.roles()]);
  }
  removeTier(role: CommissionRole, tier: CommissionTier) {
    role.tiers = role.tiers.filter((t) => t !== tier);
    this.roles.set([...this.roles()]);
  }
  touch() {
    this.roles.set([...this.roles()]);
  }

  async save() {
    if (!this.canEdit() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const r = await this.api.save(this.roles());
      this.roles.set(r.roles.map((role) => ({ ...role, tiers: role.tiers.map((t) => ({ ...t })) })));
      this.notice.set(this.t('Scheme saved.', 'تم حفظ المخطط.'));
      setTimeout(() => this.notice.set(''), 3500);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
