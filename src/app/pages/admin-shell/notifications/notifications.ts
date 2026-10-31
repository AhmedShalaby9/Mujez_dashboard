import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';
import { OverviewApi, overviewAlertText } from '../../../overview-api.service';

const COPY = {
  en: {
    eyebrow: 'Operations',
    title: 'Notifications',
    sub: 'Payment failures, expiring trials, exceeded limits and incidents. Each opens its record.',
    empty: 'No current notifications in your permitted modules.',
    severity: { high: 'High', med: 'Medium', low: 'Low' },
  },
  ar: {
    eyebrow: 'العمليات',
    title: 'الإشعارات',
    sub: 'فشل المدفوعات والتجارب المنتهية والحدود المتجاوزة والحوادث. كل إشعار يفتح سجله.',
    empty: 'لا توجد إشعارات حالية في الوحدات المتاحة لك.',
    severity: { high: 'عالية', med: 'متوسطة', low: 'منخفضة' },
  },
};

@Component({
  selector: 'app-notifications',
  imports: [RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  private readonly ui = inject(AdminUiState);
  readonly overview = inject(OverviewApi);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);

  constructor() {
    void this.overview.refreshAlerts();
  }

  readonly items = computed(() =>
    this.overview.alerts().map((a) => ({
      id: a.id,
      path: a.path,
      severity: a.severity,
      title: overviewAlertText(a, this.lang()),
    })),
  );
}
