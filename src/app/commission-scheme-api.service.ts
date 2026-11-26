import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';

export const COMMISSION_ROLE_KEYS = [
  'property_advisor',
  'property_consultant',
  'senior',
  'expert',
  'team_leader',
  'sales_manager',
  'sales_director',
  'head_of_sales',
] as const;
export type CommissionRoleKey = (typeof COMMISSION_ROLE_KEYS)[number];
export type CommissionTierKind = 'volume' | 'percent';
export interface CommissionTier {
  kind: CommissionTierKind;
  threshold: number;
  ratePerMillion: number;
}
export interface CommissionRole {
  roleKey: CommissionRoleKey;
  monthlyTarget: number;
  quarterlyTarget: number;
  version: number;
  tiers: CommissionTier[];
}
export interface CommissionScheme {
  roles: CommissionRole[];
}
@Injectable({ providedIn: 'root' })
export class CommissionSchemeApi {
  private readonly api = inject(SalesApi);
  get() {
    return this.api.get('brokerage/commission-scheme') as Promise<CommissionScheme>;
  }
  save(roles: CommissionRole[]) {
    return this.api.write('brokerage/commission-scheme', { roles }) as Promise<CommissionScheme>;
  }
}
