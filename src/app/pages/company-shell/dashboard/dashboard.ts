import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompanyUiState } from '../company-ui-state';
import {
  CompanyInsightsApi,
  type Overview,
  volumePercent,
} from '../../../company-insights-api.service';
type Segment = 'all' | 'res' | 'com';
const ALERTS: Record<string, [string, string]> = {
  'overdue-tasks': ['Overdue open tasks', 'مهام مفتوحة متأخرة'],
  'missing-evidence': ['Contracts missing required evidence', 'عقود ينقصها مستند مطلوب'],
  'expiring-reservations': ['Reservations expiring within 24 hours', 'حجوزات تنتهي خلال ٢٤ ساعة'],
  'payable-commissions': ['Commissions ready for manual payment', 'عمولات مستحقة للدفع اليدوي'],
  'first-contact': ['Leads overdue for first contact', 'عملاء تجاوزوا مهلة التواصل الأول'],
  'routing-worker': ['Routing worker needs attention', 'عامل التوزيع يحتاج مراجعة'],
};
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly ui = inject(CompanyUiState);
  readonly api = inject(CompanyInsightsApi);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly segment = signal<Segment>('all');
  readonly segments: Segment[] = ['all', 'res', 'com'];
  readonly data = signal<Overview | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private generation = 0;
  constructor() {
    void this.load();
  }
  text(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  local(v: { en: string; ar: string } | null) {
    return v?.[this.ui.lang()] ?? '—';
  }
  segmentName(s: Segment) {
    return s === 'all'
      ? this.text('All', 'الكل')
      : s === 'res'
        ? this.text('Residential', 'سكني')
        : this.text('Commercial', 'تجاري');
  }
  alertName(k: string) {
    return ALERTS[k]?.[this.ar() ? 1 : 0] ?? k;
  }
  percent(v: string) {
    return volumePercent(v, this.data()?.chart ?? []);
  }
  async load(segment = this.segment()) {
    this.segment.set(segment);
    const n = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.data.set(null);
    try {
      const d = await this.api.get<Overview>(
        '/company-overview',
        segment === 'all' ? {} : { segment },
      );
      if (n === this.generation) this.data.set(d);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.busy.set(false);
    }
  }
}
