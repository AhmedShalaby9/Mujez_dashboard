import { NotificationsApi } from '../../../notifications-api.service';
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
  ['newco', 'Company updates', 'تحديثات الشركات'],
  ['ticket', 'Support ticket updates', 'تحديثات تذاكر الدعم'],
  ['pay', 'Invoice and payment updates', 'تحديثات الفواتير والمدفوعات'],
  ['expiry', 'Subscription updates', 'تحديثات الاشتراكات'],
  ['announcement', 'Announcements', 'الإعلانات'],
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

  readonly feed = inject(NotificationsApi);
  readonly read = signal<Record<string, true>>({});
  constructor() {
    void this.feed.refresh();
    void this.loadPreferences();
  }
  private async loadPreferences() {
    try {
      const r = await this.auth.request('/admin/api/v1/me/notification-preferences');
      this.rules.set(r.value);
    } catch (e) {
      this.toast.set((e as Error).message);
    }
  }
  readonly items = computed(() =>
    this.feed
      .items()
      .map((n) => ({
        id: n.id,
        path: n.route,
        severity: /failed|suspend|overdue/.test(n.kind) ? 'high' : 'low',
        kind: n.kind,
        title: n.title,
        createdAt: n.createdAt,
        read: !!n.readAt,
      })),
  );
  readonly unread = this.feed.unread;
  readonly shown = computed(() => this.items().filter((n) => this.tab() === 'all' || !n.read));

  open(n: { id: string; path: string }) {
    this.setRead(n.id, true);
    void this.router.navigateByUrl(n.path);
  }
  async setRead(id: string, on: boolean) {
    try {
      await this.feed.mark(id, on);
    } catch (e) {
      this.toast.set((e as Error).message);
    }
  }
  async markAll() {
    try {
      await this.feed.markAll();
    } catch (e) {
      this.toast.set((e as Error).message);
    }
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
    return c !== 'app';
  }
  ruleOn(e: string, c: Channel) {
    if (this.locked(e, c)) return false;
    return (
      this.rules()[e + ':' + c] ??
      (c === 'app' || (c === 'email' && e !== 'newco') || (c === 'sms' && CRITICAL.includes(e)))
    );
  }
  async toggleRule(e: string, c: Channel) {
    if (this.locked(e, c)) return;
    const value = { ...this.rules(), [e + ':' + c]: !this.ruleOn(e, c) };
    try {
      const r = await this.auth.request('/admin/api/v1/me/notification-preferences', { value });
      this.rules.set(r.value);
      this.toast.set(
        this.lang() === 'ar' ? 'تم حفظ تفضيلات الإشعارات' : 'Notification preferences saved',
      );
    } catch (e) {
      this.toast.set((e as Error).message);
    }
  }
}
