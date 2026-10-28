import { Component, computed, inject, signal } from '@angular/core';
import { AdminUiState, type Lang } from '../admin-ui-state';

type Severity = 'critical' | 'warning' | 'info' | 'resolved';
type Service = 'payments' | 'routing' | 'email' | 'storage' | 'db';

interface Alert {
  id: string;
  severity: Severity;
  service: Service;
  messageEn: string;
  messageAr: string;
  time: string;
}

const ALERTS: Alert[] = [
  { id: 'AL-401', severity: 'critical', service: 'payments', messageEn: 'Paymob webhook latency above 5s for 8 minutes', messageAr: 'زمن استجابة Paymob تجاوز 5 ثوانٍ لمدة 8 دقائق', time: '08:40' },
  { id: 'AL-400', severity: 'warning', service: 'email', messageEn: 'SendGrid soft-bounce rate at 2.1% (threshold 2%)', messageAr: 'معدل الارتداد المؤقت لـ SendGrid 2.1٪', time: '10:18' },
  { id: 'AL-399', severity: 'warning', service: 'routing', messageEn: 'Lead routing queue depth above 200 for 3 minutes', messageAr: 'عمق طابور توجيه العملاء تجاوز 200 لمدة 3 دقائق', time: '09:52' },
  { id: 'AL-398', severity: 'info', service: 'db', messageEn: 'Nightly vacuum completed on companies schema', messageAr: 'اكتمل التفريغ الليلي لمخطط الشركات', time: '03:00' },
  { id: 'AL-397', severity: 'resolved', service: 'storage', messageEn: 'S3 upload error rate spike, auto-recovered', messageAr: 'ارتفاع مؤقت في أخطاء رفع S3، تعافى تلقائيًا', time: 'Yesterday' },
  { id: 'AL-396', severity: 'critical', service: 'db', messageEn: 'Primary database CPU above 90% for 5 minutes', messageAr: 'استخدام CPU لقاعدة البيانات الرئيسية فوق 90٪ لمدة 5 دقائق', time: 'Yesterday' },
  { id: 'AL-395', severity: 'info', service: 'payments', messageEn: 'Scheduled maintenance window completed', messageAr: 'اكتملت نافذة الصيانة المجدولة', time: '2 d ago' },
  { id: 'AL-394', severity: 'resolved', service: 'routing', messageEn: 'SLA auto-reassignment backlog cleared', messageAr: 'تم تصريف تراكم إعادة التوجيه بموجب SLA', time: '3 d ago' },
];

const REQUESTS_24H = [1120, 980, 860, 790, 820, 940, 1240, 1680, 2040, 2210, 2150, 2080, 2230, 2190, 2010, 1950, 2070, 2140, 1980, 1760, 1520, 1380, 1260, 1150];
const ERRORS_24H = [2, 1, 1, 0, 1, 2, 3, 5, 8, 11, 9, 7, 14, 6, 5, 4, 6, 8, 5, 3, 2, 2, 1, 1];

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
    sub: 'Production · operational visibility (read-only)',
    kpis: {
      availability: 'Availability (30d)',
      p50: 'Latency p50',
      p95: 'Latency p95',
      errorRate: 'Error rate',
      jobs: 'Active jobs',
      db: 'DB connections',
      storage: 'Storage used',
    },
    chartTitle: 'Requests & errors (24h)',
    chartLegendReq: 'Requests',
    chartLegendErr: 'Errors',
    alertsTitle: 'Alerts',
    sevAll: 'All severities',
    sev: { critical: 'Critical', warning: 'Warning', info: 'Info', resolved: 'Resolved' },
    svcAll: 'All services',
    svc: { payments: 'Payments', routing: 'Routing', email: 'Email', storage: 'Storage', db: 'DB' },
    emptyTitle: 'No alerts match this filter',
  },
  ar: {
    eyebrow: 'المنصة',
    title: 'صحة النظام',
    sub: 'الإنتاج · رؤية تشغيلية (قراءة فقط)',
    kpis: {
      availability: 'التوفر (30 يومًا)',
      p50: 'زمن الاستجابة p50',
      p95: 'زمن الاستجابة p95',
      errorRate: 'معدل الأخطاء',
      jobs: 'المهام النشطة',
      db: 'اتصالات قاعدة البيانات',
      storage: 'التخزين المستخدم',
    },
    chartTitle: 'الطلبات والأخطاء (24 س)',
    chartLegendReq: 'الطلبات',
    chartLegendErr: 'الأخطاء',
    alertsTitle: 'التنبيهات',
    sevAll: 'كل المستويات',
    sev: { critical: 'حرج', warning: 'تحذير', info: 'معلومة', resolved: 'تم الحل' },
    svcAll: 'كل الخدمات',
    svc: { payments: 'المدفوعات', routing: 'التوجيه', email: 'البريد', storage: 'التخزين', db: 'قاعدة البيانات' },
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
  readonly services: Service[] = ['payments', 'routing', 'email', 'storage', 'db'];

  readonly alerts = signal<Alert[]>(ALERTS);
  readonly sevFilter = signal<Severity | 'all'>('all');
  readonly svcFilter = signal<Service | 'all'>('all');

  private readonly maxReq = Math.max(...REQUESTS_24H);

  readonly chartBars = REQUESTS_24H.map((req, i) => ({
    req,
    err: ERRORS_24H[i],
    reqPct: Math.round((req / this.maxReq) * 100),
    errPct: Math.round((ERRORS_24H[i] / req) * 100 * 4),
  }));

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
    return this.alerts().filter((a) => (sev === 'all' || a.severity === sev) && (svc === 'all' || a.service === svc));
  });

  setSev(s: Severity | 'all'): void {
    this.sevFilter.set(s);
  }

  setSvc(s: Service | 'all'): void {
    this.svcFilter.set(s);
  }
}
