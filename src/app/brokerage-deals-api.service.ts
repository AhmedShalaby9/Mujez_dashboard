import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export type DealStatus = 'eoi' | 'reservation' | 'contracted' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface DealDocument {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}
export interface Deal {
  id: string;
  leadId: string;
  lead: string;
  agentId: string;
  agent: string;
  clientName: string;
  clientPhone: string;
  sellingType: 'primary' | 'resale';
  status: DealStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  developerId: string;
  developer: string;
  projectId: string;
  project: string;
  details: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
  documents?: DealDocument[];
  events?: { action: string; version: number; actorId: string; createdAt: string }[];
}
export interface DealOptions {
  leads: { id: string; name: string; phone: string; ownerId: string | null }[];
  agents: { id: string; name: string }[];
  developers: { id: string; name: string; version: number }[];
  projects: { id: string; code: string; name: string; developerId: string }[];
  unitTypes: string[];
  finishingTypes: string[];
  canApprove: boolean;
  canManageInventory: boolean;
}
@Injectable({ providedIn: 'root' })
export class BrokerageDealsApi {
  private readonly api = inject(SalesApi);
  options() {
    return this.api.get('brokerage/deals/options') as Promise<DealOptions>;
  }
  leads(search: string) {
    return this.api.get('brokerage/deals/leads', { search }) as Promise<DealOptions['leads']>;
  }
  list(q: Record<string, string>) {
    return this.api.get('brokerage/deals', q) as Promise<{
      items: Deal[];
      total: number;
      summary: Record<DealStatus, number>;
    }>;
  }
  detail(id: string) {
    return this.api.get(`brokerage/deals/${id}`) as Promise<Deal>;
  }
  save(body: Record<string, unknown>, id?: string) {
    return this.api.write(
      id ? `brokerage/deals/${id}/update` : 'brokerage/deals',
      body,
    ) as Promise<Deal>;
  }
  decide(id: string, version: number, decision: 'approved' | 'rejected', reason?: string) {
    return this.api.write(`brokerage/deals/${id}/decision`, {
      version,
      decision,
      reason,
    }) as Promise<Deal>;
  }
  createDeveloper(name: string) {
    return this.api.write('brokerage/developers', { name }) as Promise<{
      id: string;
      name: string;
    }>;
  }
  developers() {
    return this.api.get('brokerage/developers') as Promise<
      { id: string; name: string; version: number }[]
    >;
  }
  updateDeveloper(id: string, name: string, version: number) {
    return this.api.write(`brokerage/developers/${id}/update`, { name, version });
  }
  archiveDeveloper(id: string, version: number) {
    return this.api.write(`brokerage/developers/${id}/archive`, { version });
  }
  createProject(body: Record<string, unknown>) {
    return this.api.write('brokerage/projects', body) as Promise<{
      id: string;
      name: string;
      developerId: string;
      code: string;
    }>;
  }
}
