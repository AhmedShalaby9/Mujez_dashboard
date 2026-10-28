import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Severity = 'critical' | 'warning' | 'info' | 'resolved';
type Service = 'db' | 'redis';
import { AuthService } from '../../../auth.service';

interface Alert {
  id: string;
  severity: Severity;
  service: Service;
  messageEn: string;
  messageAr: string;
  time: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  kpis: {
    availability: string;
    p50: string;
    p95: string;
    errorRate: string;
    jobs: string;
    db: string;
    storage: string;
  };
  chartTitle: string;
  chartLegendReq: string;
  chartLegendErr: string;
  alertsTitle: string;
  sevAll: string;
  sev: Record<Severity, string>;
  svcAll: string;
  svc: Record<Service, string>;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Platform',
    title: 'System health',
    sub: 'Live API process · read-only · refreshes every 30s',
    kpis: {
      availability: 'API uptime (seconds)',
      p50: 'Latency p50',
      p95: 'Latency p95',
      errorRate: 'HTTP 5xx rate',
      jobs: 'Redis readiness',
      db: 'API DB pool connections',
      storage: 'API memory (RSS)',
    },
    chartTitle: 'Requests & HTTP 5xx · up to 24h since restart (UTC)',
    chartLegendReq: 'Requests',
    chartLegendErr: 'Errors',
    alertsTitle: 'Alerts',
    sevAll: 'All severities',
    sev: { critical: 'Critical', warning: 'Warning', info: 'Info', resolved: 'Resolved' },
    svcAll: 'All services',
    svc: { db: 'Database', redis: 'Redis' },
    emptyTitle: 'No alerts match this filter',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'صحة النظام',
    sub: 'عملية API الحالية · قراءة فقط · تحديث كل 30 ثانية',
    kpis: {
      availability: 'مدة تشغيل API (ثوانٍ)',
      p50: 'زمن الاستجابة p50',
      p95: 'زمن الاستجابة p95',
      errorRate: 'معدل الأخطاء',
      jobs: 'جاهزية Redis',
      db: 'اتصالات قاعدة البيانات',
      storage: 'ذاكرة API',
    },
    chartTitle: 'الطلبات وأخطاء 5xx · حتى 24 ساعة منذ إعادة التشغيل (UTC)',
    chartLegendReq: 'الطلبات',
    chartLegendErr: 'الأخطاء',
    alertsTitle: 'التنبيهات',
    sevAll: 'كل المستويات',
    sev: { critical: 'حرج', warning: 'تحذير', info: 'معلومة', resolved: 'تم الحل' },
    svcAll: 'كل الخدمات',
    svc: { db: 'قاعدة البيانات', redis: 'Redis' },
    emptyTitle: 'لا توجد تنبيهات مطابقة لهذا الفلتر',
  },
};

@Component({
  selector: 'app-system-health',
  templateUrl: './system-health.html',
  styleUrl: './system-health.scss',
})
export class SystemHealth {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly severities: Severity[] = ['critical', 'warning', 'info', 'resolved'];
  readonly services: Service[] = ['db', 'redis'];

  readonly alerts = signal<Alert[]>([]);
  readonly sevFilter = signal<Severity | 'all'>('all');
  readonly svcFilter = signal<Service | 'all'>('all');

  private readonly api = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly data = signal<any>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), 30000);
    this.destroy.onDestroy(() => clearInterval(timer));
  }
  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const data = await this.api.request('/admin/api/v1/system-health');
      this.data.set(data);
      this.alerts.set(data.alerts);
      this.error.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  readonly chartBars = computed(() => {
    const bars = this.data()?.metrics.bars ?? [];
    const max = Math.max(1, ...bars.map((b: any) => b.requests));
    return bars.map((b: any) => ({
      req: b.requests,
      err: b.errors,
      hour: b.hour,
      observed: b.observed,
      reqPct: Math.round((b.requests / max) * 100),
      errPct: b.requests ? Math.round((b.errors / b.requests) * 100) : 0,
    }));
  });
  status(value: string | undefined) {
    return value === 'healthy'
      ? this.lang() === 'ar'
        ? 'سليم'
        : 'Healthy'
      : value === 'down'
        ? this.lang() === 'ar'
          ? 'متعطل'
          : 'Down'
        : '—';
  }

  sevName(s: Severity): string {
    return this.L().sev[s];
  }

  svcName(s: Service): string {
    return this.L().svc[s];
  }

  alertMessage(a: Alert): string {
    return this.lang() === 'ar' ? a.messageAr : a.messageEn;
  }

  readonly filtered = computed(() => {
    const sev = this.sevFilter();
    const svc = this.svcFilter();
    return this.alerts().filter(
      (a) => (sev === 'all' || a.severity === sev) && (svc === 'all' || a.service === svc),
    );
  });

  setSev(s: Severity | 'all'): void {
    this.sevFilter.set(s);
  }

  setSvc(s: Service | 'all'): void {
    this.svcFilter.set(s);
  }
}
