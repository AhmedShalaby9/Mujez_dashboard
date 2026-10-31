import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Severity = 'critical' | 'warning' | 'info' | 'resolved';
type Service = 'db' | 'redis' | 'lead-routing';
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
    svc: { db: 'Database', redis: 'Redis', 'lead-routing': 'Lead routing worker' },
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
    svc: { db: 'قاعدة البيانات', redis: 'Redis', 'lead-routing': 'عامل توزيع العملاء' },
    emptyTitle: 'لا توجد تنبيهات مطابقة لهذا الفلتر',
  },
};

@Component({
  selector: 'app-system-health',
  templateUrl: './system-health.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './system-health.scss'],
})
export class SystemHealth {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly severities: Severity[] = ['critical', 'warning', 'info', 'resolved'];
  readonly services: Service[] = ['db', 'redis', 'lead-routing'];

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

  readonly toast = signal('');
  /** Hourly bars for the two real charts (requests, 5xx rate). */
  readonly reqChart = computed(() => {
    const bars = (this.data()?.metrics.bars ?? []) as any[];
    const max = Math.max(1, ...bars.map((b) => b.requests));
    return bars.map((b) => ({
      h: Math.max(3, (b.requests / max) * 100).toFixed(0) + '%',
      dim: !b.observed,
      tip: this.hourLabel(b.hour) + ' · ' + b.requests,
    }));
  });
  readonly errChart = computed(() => {
    const bars = (this.data()?.metrics.bars ?? []) as any[];
    const rates = bars.map((b) => (b.requests ? (b.errors / b.requests) * 100 : 0));
    const max = Math.max(0.01, ...rates);
    return bars.map((b, i) => ({
      h: Math.max(3, (rates[i] / max) * 100).toFixed(0) + '%',
      hot: rates[i] > 0 && rates[i] >= max * 0.8,
      dim: !b.observed,
      tip: this.hourLabel(b.hour) + ' · ' + rates[i].toFixed(2) + '% (' + b.errors + ')',
    }));
  });
  readonly reqPerHour = computed(() => {
    const bars = ((this.data()?.metrics.bars ?? []) as any[]).filter((b) => b.observed);
    if (!bars.length) return '—';
    const avg = bars.reduce((n, b) => n + b.requests, 0) / bars.length;
    return (avg >= 1000 ? (avg / 1000).toFixed(1) + 'K' : Math.round(avg)) + '/h';
  });
  hourLabel(iso: string) {
    return new Date(iso).toISOString().slice(11, 16) + ' UTC';
  }
  uptime(sec: number | undefined) {
    if (sec === undefined) return '—';
    const d = Math.floor(sec / 86400),
      h = Math.floor((sec % 86400) / 3600),
      m = Math.floor((sec % 3600) / 60);
    const ar = this.lang() === 'ar';
    return d
      ? `${d}${ar ? 'ي' : 'd'} ${h}${ar ? 'س' : 'h'}`
      : h
        ? `${h}${ar ? 'س' : 'h'} ${m}${ar ? 'د' : 'm'}`
        : `${m}${ar ? 'د' : 'm'}`;
  }
  ago(iso: string | null | undefined) {
    if (!iso) return '—';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    const ar = this.lang() === 'ar';
    if (s < 60) return ar ? `منذ ${s} ث` : `${s}s ago`;
    if (s < 3600) return ar ? `منذ ${Math.round(s / 60)} د` : `${Math.round(s / 60)} min ago`;
    return ar ? `منذ ${Math.round(s / 3600)} س` : `${Math.round(s / 3600)} h ago`;
  }
  /** Dependencies table rows from the live probes. */
  readonly deps = computed(() => {
    const d = this.data();
    if (!d) return [];
    const ar = this.lang() === 'ar';
    return [
      {
        name: this.svcName('db'),
        st: d.database?.status,
        latency: d.database?.latencyMs,
        extra:
          (ar ? 'الاتصالات ' : 'pool ') +
          d.connections?.total +
          '/' +
          d.connections?.max +
          (d.connections?.waiting
            ? ' · ' + d.connections.waiting + (ar ? ' بالانتظار' : ' waiting')
            : ''),
      },
      { name: this.svcName('redis'), st: d.redis?.status, latency: d.redis?.latencyMs, extra: '' },
      {
        name: this.svcName('lead-routing'),
        st: d.routingWorker?.status,
        latency: null,
        extra: (ar ? 'آخر إشارة ' : 'last heartbeat ') + this.ago(d.routingWorker?.lastSeenAt),
      },
    ];
  });
  sevPill(s: Severity) {
    return (
      {
        critical: { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' },
        warning: { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' },
        info: { bg: '#EAEFFD', fg: '#2E47A8', dot: '#5B78E5' },
        resolved: { bg: '#E7F5EC', fg: '#1E6B3E', dot: '#2FA35F' },
      } as Record<Severity, { bg: string; fg: string; dot: string }>
    )[s];
  }
  soon() {
    this.toast.set(
      this.lang() === 'ar'
        ? 'هذا الخيار غير متصل بالخادم بعد.'
        : "This option isn't connected to the backend yet.",
    );
    setTimeout(() => this.toast.set(''), 3500);
  }

  setSev(s: Severity | 'all'): void {
    this.sevFilter.set(s);
  }

  setSvc(s: Service | 'all'): void {
    this.svcFilter.set(s);
  }
}
