import { Component, input, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { SalesApi, salesMoney, type SalesLead } from '../../../sales-api.service';
import { CompanyUiState } from '../company-ui-state';
interface Bi {
  en: string;
  ar: string;
}
interface Match {
  unit: {
    id: string;
    name: Bi;
    priceMinor: string;
    currency: string;
    area: string | null;
    bedrooms: number | null;
    type: string;
    location: Bi | null;
    deliveryYear: number | null;
    cover: string | null;
    reference: { asOf: string | null; aiCover: boolean };
    compound: { id: string; name: Bi };
    developer: { id: string; name: Bi };
  };
  reasons: Bi[];
  warnings: Bi[];
  overBudgetMinor: string;
}
interface Run {
  id: string;
  status: 'processing' | 'succeeded' | 'failed' | 'stale';
  preferences: Record<string, string | number>;
  error: { code: string; message: string } | null;
  result: {
    items: Match[];
    eligibleCount: number;
    shortlistedCount: number;
    needsMoreInfo: boolean;
    budgetMinor: string | null;
    ceilingMinor: string | null;
    needs: {
      types: string[];
      locations: string[];
      minBedrooms: number | null;
      maxBedrooms: number | null;
      minArea: number | null;
      maxArea: number | null;
      maxDeliveryYear: number | null;
    };
    generatedAt: string;
  } | null;
}
@Component({
  selector: 'app-lead-unit-recommendations',
  imports: [FormsModule, RouterLink],
  templateUrl: './lead-unit-recommendations.html',
  styleUrl: './lead-unit-recommendations.scss',
})
export class LeadUnitRecommendations {
  readonly lead = input.required<SalesLead>();
  private readonly api = inject(SalesApi);
  readonly auth = inject(AuthService);
  private readonly ui = inject(CompanyUiState);
  private readonly destroy = inject(DestroyRef);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly run = signal<Run | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly locations = signal<Bi[]>([]);
  readonly busy = computed(
    () => this.loading() || this.starting() || this.run()?.status === 'processing',
  );
  readonly readOnly = computed(() => this.auth.user()?.workspace?.mode === 'read');
  readonly canGenerate = computed(
    () =>
      !!this.auth.user()?.permissions.includes('units.read') &&
      !!this.auth.user()?.permissions.includes('leads.read') &&
      !this.lead().archivedAt &&
      !this.auth.user()?.workspace,
  );
  readonly money = salesMoney;
  readonly numericFields = ['minBedrooms', 'minArea', 'maxArea', 'maxDeliveryYear'] as const;
  preferences: {
    location: string;
    type: string;
    minBedrooms: string | number | null;
    minArea: string | number | null;
    maxArea: string | number | null;
    maxDeliveryYear: string | number | null;
  } = { location: '', type: '', minBedrooms: '', minArea: '', maxArea: '', maxDeliveryYear: '' };
  readonly types = computed(() =>
    this.lead().segment === 'com'
      ? ['office', 'retail', 'clinic']
      : [
          'apt',
          'villa',
          'chalet',
          'townhouse',
          'twinhouse',
          'studio',
          'duplex',
          'penthouse',
          'loft',
          'cabin',
          'family_house',
        ],
  );
  private serial = 0;
  private poll?: ReturnType<typeof setTimeout>;
  private commandId = '';
  private commandHash = '';
  constructor() {
    effect(() => {
      this.lead().id;
      this.lead().version;
      void this.load();
    });
    this.destroy.onDestroy(() => {
      this.serial++;
      clearTimeout(this.poll);
    });
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  label(v: Bi | null) {
    return v ? (this.ar() ? v.ar || v.en : v.en) : this.t('Not set', 'غير محدد');
  }
  typeLabel(s: string) {
    const n: Record<string, [string, string]> = {
      apt: ['Apartment', 'شقة'],
      villa: ['Villa', 'فيلا'],
      chalet: ['Chalet', 'شاليه'],
      townhouse: ['Townhouse', 'تاون هاوس'],
      twinhouse: ['Twin house', 'توين هاوس'],
      studio: ['Studio', 'استوديو'],
      duplex: ['Duplex', 'دوبلكس'],
      penthouse: ['Penthouse', 'بنتهاوس'],
      office: ['Office', 'مكتب'],
      retail: ['Retail', 'محل'],
      clinic: ['Clinic', 'عيادة'],
      loft: ['Loft', 'لوفت'],
      cabin: ['Cabin', 'كابينة'],
      family_house: ['Family house', 'منزل عائلي'],
    };
    return n[s] ? this.t(...n[s]) : s;
  }
  private setRun(run: Run | null, serial: number) {
    if (serial !== this.serial) return;
    this.run.set(run);
    if (run?.status === 'processing') {
      clearTimeout(this.poll);
      this.poll = setTimeout(() => void this.refresh(), 5000);
    }
  }
  async load() {
    const serial = ++this.serial;
    clearTimeout(this.poll);
    this.run.set(null);
    this.error.set('');
    this.loading.set(true);
    const id = this.lead().id;
    this.commandId = '';
    this.commandHash = '';
    this.preferences = {
      location: '',
      type: '',
      minBedrooms: '',
      minArea: '',
      maxArea: '',
      maxDeliveryYear: '',
    };
    try {
      const [latest, options] = await Promise.all([
        this.api.get(`leads/${id}/unit-recommendations`),
        this.api.get(`leads/${id}/unit-recommendations/options`),
      ]);
      if (serial !== this.serial) return;
      const run = latest.run;
      this.locations.set(options.locations);
      if (run?.preferences) Object.assign(this.preferences, run.preferences);
      this.setRun(run, serial);
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  async refresh() {
    const serial = this.serial,
      id = this.lead().id,
      run = this.run();
    if (!run) return;
    try {
      const result = await this.api.get(`leads/${id}/unit-recommendations/${run.id}`);
      this.setRun(result, serial);
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    }
  }
  async generate() {
    if (!this.canGenerate() || this.busy()) return;
    clearTimeout(this.poll);
    const serial = this.serial,
      id = this.lead().id;
    this.error.set('');
    this.starting.set(true);
    try {
      const p: Record<string, string | number> = {};
      if (this.preferences.location.trim()) p['location'] = this.preferences.location.trim();
      if (this.preferences.type) p['type'] = this.preferences.type;
      for (const k of this.numericFields) {
        const v = this.preferences[k];
        if (v !== null && v !== '') {
          const n = Number(v);
          if (!Number.isFinite(n))
            throw Error(this.t('Enter valid property requirements.', 'أدخل متطلبات صحيحة.'));
          p[k] = n;
        }
      }
      const base = {
        leadVersion: this.lead().version,
        language: this.ar() ? 'ar' : 'en',
        preferences: p,
      };
      const fingerprint = JSON.stringify({ id, ...base });
      if (
        !this.commandId ||
        this.commandHash !== fingerprint ||
        ['failed', 'stale', 'succeeded'].includes(this.run()?.status ?? '')
      ) {
        this.commandId = crypto.randomUUID();
        this.commandHash = fingerprint;
      }
      const run = await this.api.write(`leads/${id}/unit-recommendations`, {
        ...base,
        requestId: this.commandId,
      });
      this.setRun(run, serial);
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.starting.set(false);
    }
  }
  needsSummary() {
    const n = this.run()?.result?.needs;
    if (!n) return '';
    const parts = [...n.types.map((x) => this.typeLabel(x)), ...n.locations];
    if (n.minBedrooms !== null)
      parts.push(
        n.maxBedrooms === n.minBedrooms
          ? `${n.minBedrooms} ${this.t('bedrooms', 'غرف نوم')}`
          : `${n.minBedrooms}+ ${this.t('bedrooms', 'غرف نوم')}`,
      );
    if (n.minArea !== null) parts.push(`${this.t('Min. area', 'أقل مساحة')} ${n.minArea} m²`);
    if (n.maxArea !== null) parts.push(`${this.t('Max. area', 'أكبر مساحة')} ${n.maxArea} m²`);
    if (n.maxDeliveryYear !== null)
      parts.push(`${this.t('Delivery by', 'التسليم حتى')} ${n.maxDeliveryYear}`);
    return parts.join(' · ');
  }
}
