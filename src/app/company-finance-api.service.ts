import { Injectable, inject } from '@angular/core';
import { InventoryApi } from './inventory-api.service';
import { AuthService } from './auth.service';
import { RUNTIME_CONFIG } from './runtime-config';
export interface CompanyDocument {
  id: string;
  kind: string;
  title: string;
  file: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  leadId: string | null;
  lead: { en: string; ar: string } | null;
  contractId: string | null;
  contractReference: string | null;
  uploadedBy: { id: string; name: string } | null;
  at: string;
  expires: string | null;
  expired: boolean;
  expiringSoon: boolean;
  archivedAt: string | null;
  version: number;
  sample: boolean;
}
export interface CompanyContract {
  id: string;
  reference: string;
  title: { en: string; ar: string };
  type: 'sale' | 'reservation' | 'lease' | 'listing' | 'broker_agreement';
  status: 'draft' | 'sent' | 'signed' | 'expiring' | 'void';
  storedStatus: 'draft' | 'sent' | 'signed' | 'void';
  leadId: string;
  contact: { en: string; ar: string };
  leadArchived: boolean;
  unitId: string | null;
  unit: string | null;
  reservationId: string | null;
  valueMinor: string;
  keyDate: string;
  owner: { id: string; name: string } | null;
  signers: Array<{ name: { en: string; ar: string }; role: { en: string; ar: string } }>;
  sharedReference: string | null;
  sharedAt: string | null;
  signedDate: string | null;
  signedAt: string | null;
  signedDocumentId: string | null;
  voidReason: string | null;
  version: number;
  sample: boolean;
  requirements?: Array<{
    id: string;
    kind: string;
    label: string;
    required: boolean;
    documentId: string | null;
    satisfied: boolean;
    file: string | null;
    version: number;
  }>;
}
@Injectable({ providedIn: 'root' })
export class CompanyFinanceApi {
  readonly api = inject(InventoryApi);
  readonly auth = inject(AuthService);
  private readonly config = inject(RUNTIME_CONFIG);
  get<T>(path: string, q: Record<string, string> = {}) {
    return this.api.get<T>(path, q);
  }
  write<T>(path: string, b: Record<string, unknown>) {
    return this.api.write<T>(path, b);
  }
  upload(form: FormData) {
    return this.auth.request('/api/v1/documents', form) as Promise<CompanyDocument>;
  }
  downloadUrl(id: string) {
    return this.config.apiUrl + '/api/v1/documents/' + encodeURIComponent(id) + '/download';
  }
  money(v: string | null) {
    return this.api.money(v);
  }
}
