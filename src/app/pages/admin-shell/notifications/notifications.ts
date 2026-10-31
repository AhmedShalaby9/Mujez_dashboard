import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminUiState, type Lang } from '../admin-ui-state';
import { AuthService } from '../../../auth.service';
import { OverviewApi, overviewAlertText } from '../../../overview-api.service';

type Channel = 'app' | 'email' | 'sms';

const COPY = {
  en: {
    title: 'Notifications',
    sub: 'Your notification center and delivery rules',
    empty: 'No current notifications in your permitted modules.',
    severity: { high: 'High', med: 'Medium', low: 'Low' } as Record<string, string>,
  },
  ar: {
    title: 'الإشعارات',
    sub: 'مركز الإشعارات وقواعد التسليم',
    empty: 'لا توجد إشعارات حالية في الوحدات المتاحة لك.',
    severity: { high: 'عالية', med: 'متوسطة', low: 'منخفضة' } as Record<string, string>,
  },
};
const KIND: Record<string, [string, string]> = {
  invoice_overdue: ['Overdue invoice', 'فاتورة متأخرة'],
  trial_ending: ['Trial ending', 'انتهاء التجربة'],
  support_overdue: ['Support SLA', 'موعد الدعم'],
  user_limit: ['Limit reached', 'بلوغ الحد'],
  company_created: ['New company', 'شركة جديدة'],
};
/** Design delivery-rule events. Static until the backend stores per-user preferences (BACKEND_MISSING.md N2). */
const EVENTS: Array<[string, string, string]> = [
  ['pay', 'Subscription payment failed', 'فشل سداد اشتراك'],
  ['newco', 'New company registered', 'تسجيل شركة جديدة'],
  ['trial', 'Trial expiring (3 days)', 'انتهاء التجربة (3 أيام)'],
  ['ticket', 'Support ticket assigned to me', 'إسناد تذكرة لي'],
  ['limit', 'Company exceeded a limit', 'تجاوز شركة للحد'],
  ['incident', 'System incident detected', 'اكتشاف حادث نظام'],
  ['expiry', 'Subscription expiry reminder (7 days)', 'تذكير انتهاء الاشتراك'],
];
const CRITICAL = ['pay', 'incident'];

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.html',
  styleUrls: ['../admin-ui.scss', '../admin-table.scss', './notifications.scss'],
})
export class Notifications {
  private readonly ui = inject(AdminUiState);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly overview = inject(OverviewApi);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly tab = signal<'all' | 'unread'>('all');
  readonly channels: Channel[] = ['app', 'email', 'sms'];
  readonly events = EVENTS;
  readonly rules = signal<Record<string, boolean>>({});
  readonly toast = signal('');

  /** Read state is kept per user in this browser only — the API has no notification read state. */
  private get storeKey() {
    return 'mujez.admin.notifRead.' + (this.auth.user()?.id ?? 'anon');
  }
  readonly read = signal<Record<string, true>>({});

  constructor() {
    void this.overview.refreshAlerts();
    try {
      this.read.set(JSON.parse(localStorage.getItem(this.storeKey) || '{}'));
    } catch {}
  }
  private persist() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(this.read()));
    } catch {}
  }

  readonly items = computed(() =>
    this.overview.alerts().map((a) => ({
      id: a.id,
      path: a.path,
      severity: a.severity,
      kind: KIND[a.kind]?.[this.lang() === 'ar' ? 1 : 0] ?? a.kind,
      title: overviewAlertText(a, this.lang()),
      read: !!this.read()[a.id],
    })),
  );
  readonly unread = computed(() => this.items().filter((n) => !n.read).length);
  readonly shown = computed(() => this.items().filter((n) => this.tab() === 'all' || !n.read));

  open(n: { id: string; path: string }) {
    this.setRead(n.id, true);
    void this.router.navigateByUrl(n.path);
  }
  setRead(id: string, on: boolean) {
    this.read.update((r) => {
      const next = { ...r };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });
    this.persist();
  }
  markAll() {
    this.read.set(Object.fromEntries(this.items().map((n) => [n.id, true as const])));
    this.persist();
  }
  sevPill(s: string) {
    return s === 'high'
      ? { bg: '#FBE7E3', fg: '#A23624', dot: '#E2553B' }
      : s === 'med'
        ? { bg: '#FCF2DE', fg: '#83570C', dot: '#D99A28' }
        : { bg: '#F1F1ED', fg: '#45454A', dot: '#8A8A90' };
  }
  channelName(c: Channel) {
    const ar = this.lang() === 'ar';
    return c === 'app'
      ? ar
        ? 'داخل التطبيق'
        : 'In-app'
      : c === 'email'
        ? ar
          ? 'البريد'
          : 'Email'
        : 'SMS';
  }
  locked(e: string, c: Channel) {
    return c === 'sms' && !CRITICAL.includes(e);
  }
  ruleOn(e: string, c: Channel) {
    if (this.locked(e, c)) return false;
    return (
      this.rules()[e + ':' + c] ??
      (c === 'app' || (c === 'email' && e !== 'newco') || (c === 'sms' && CRITICAL.includes(e)))
    );
  }
  toggleRule(e: string, c: Channel) {
    if (this.locked(e, c)) return;
    this.rules.update((r) => ({ ...r, [e + ':' + c]: !this.ruleOn(e, c) }));
    this.toast.set(
      this.lang() === 'ar'
        ? 'معاينة فقط — قواعد التسليم لا تُحفظ بعد.'
        : 'Preview only — delivery rules are not saved yet.',
    );
    setTimeout(() => this.toast.set(''), 3000);
  }
}
