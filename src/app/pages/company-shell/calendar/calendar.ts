import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import {
  CalendarApi,
  EVENT_TYPES,
  type CalendarEvent,
  type EventType,
} from '../../../calendar-api.service';

// All of the helpers below work in the browser's own local time zone (Africa/Cairo for
// this product's users) rather than UTC, so local midnight and local day-of-week line up
// with what the person actually sees on their clock — mixing in UTC here would shift
// events near midnight onto the wrong day for a UTC+2/+3 zone.
function startOfWeek(d: Date): Date {
  // Week starts Saturday (per Mujez convention: Sat–Fri, Friday is the weekend).
  const day = d.getDay(); // 0=Sun..6=Sat, local
  const diff = (day + 1) % 7; // days since Saturday
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - diff);
  return s;
}
function dateKey(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

@Component({
  selector: 'app-calendar',
  imports: [FormsModule],
  templateUrl: './calendar.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './calendar.scss',
  ],
})
export class Calendar {
  private readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(CalendarApi);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }

  readonly types = EVENT_TYPES;
  readonly typeNames = computed(() => {
    const en: Record<EventType, string> = {
      viewing: 'Viewing',
      call: 'Call',
      meeting: 'Meeting',
      inspection: 'Inspection',
      signing: 'Signing',
    };
    const ar: Record<EventType, string> = {
      viewing: 'معاينة',
      call: 'مكالمة',
      meeting: 'اجتماع',
      inspection: 'فحص',
      signing: 'توقيع',
    };
    return this.ar() ? ar : en;
  });

  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('calendar.manage') ?? false,
  );
  readonly owners = signal<Array<{ id: string; name: string }>>([]);
  readonly contactOptions = signal<
    Array<{ id: string; reference: string; name: { en: string; ar: string } }>
  >([]);
  readonly leadOptions = signal<
    Array<{ id: string; reference: string; name: { en: string; ar: string } }>
  >([]);

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly days = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });
  readonly dayNames = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return this.days().map((d) => fmt.format(d));
  });
  readonly weekLabel = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
    });
    const days = this.days();
    return fmt.format(days[0]) + ' – ' + fmt.format(days[6]);
  });

  readonly events = signal<CalendarEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly typeFilter = signal<EventType | 'all'>('all');

  readonly eventsByDay = computed(() => {
    const byDay = new Map<string, CalendarEvent[]>();
    for (const d of this.days()) byDay.set(dateKey(d), []);
    for (const e of this.events()) {
      if (this.typeFilter() !== 'all' && e.type !== this.typeFilter()) continue;
      const key = dateKey(new Date(e.startsAt));
      byDay.get(key)?.push(e);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return byDay;
  });

  readonly selected = signal<CalendarEvent | null>(null);
  readonly newOpen = signal(false);
  readonly editing = signal<CalendarEvent | null>(null);
  readonly formError = signal('');
  readonly saving = signal(false);
  readonly toast = signal('');

  draft = {
    type: 'viewing' as EventType,
    title: '',
    titleAr: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    place: '',
    contactId: '',
    leadId: '',
    ownerId: '',
    notes: '',
  };

  private serial = 0;
  private formRequest = crypto.randomUUID();

  constructor() {
    void this.reload();
    void this.loadOptions();
    this.destroy.onDestroy(() => this.serial++);
  }

  async loadOptions() {
    try {
      const r = await this.api.options();
      this.owners.set(r.owners);
      this.contactOptions.set(r.contacts);
      this.leadOptions.set(r.leads);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async reload() {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const start = this.weekStart();
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const r = await this.api.list({ from: start.toISOString(), to: end.toISOString() });
      if (serial === this.serial) this.events.set(r.items);
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }

  prevWeek() {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() - 7);
    this.weekStart.set(d);
    void this.reload();
  }
  nextWeek() {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + 7);
    this.weekStart.set(d);
    void this.reload();
  }
  thisWeek() {
    this.weekStart.set(startOfWeek(new Date()));
    void this.reload();
  }

  dayKey(d: Date) {
    return dateKey(d);
  }

  title(e: CalendarEvent) {
    return e.title[this.lang()];
  }

  time(s: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(s));
  }

  // ---- week grid (design) ----
  readonly HOUR_PX = 48;
  readonly typeColor: Record<string, string> = {
    viewing: '#8BB33A',
    call: '#5B78E5',
    meeting: '#111113',
    inspection: '#D99A28',
    signing: '#C2412D',
  };
  /** Visible hours: 8:00–20:00, widened to fit any event outside that range this week. */
  readonly hourRange = computed(() => {
    let lo = 8,
      hi = 20;
    for (const e of this.events()) {
      const s = new Date(e.startsAt),
        en = new Date(e.endsAt);
      lo = Math.min(lo, s.getHours());
      hi = Math.max(hi, en.getHours() + (en.getMinutes() ? 1 : 0));
    }
    return { lo, hi: Math.min(24, Math.max(hi, lo + 1)) };
  });
  readonly hours = computed(() => {
    const { lo, hi } = this.hourRange();
    return Array.from({ length: hi - lo }, (_, i) => lo + i);
  });
  hourLabel(h: number) {
    return String(h).padStart(2, '0') + ':00';
  }
  /** Position of an event inside its day column (local time). */
  box(e: CalendarEvent) {
    const s = new Date(e.startsAt),
      en = new Date(e.endsAt);
    const lo = this.hourRange().lo;
    const top = (s.getHours() + s.getMinutes() / 60 - lo) * this.HOUR_PX;
    const mins = Math.max(20, (en.getTime() - s.getTime()) / 60000);
    return {
      top: Math.max(0, top) + 'px',
      height: Math.max(22, (mins / 60) * this.HOUR_PX - 2) + 'px',
      short: mins < 50,
    };
  }
  isToday(d: Date) {
    return dateKey(d) === dateKey(new Date());
  }
  nowTop() {
    const n = new Date();
    const v = (n.getHours() + n.getMinutes() / 60 - this.hourRange().lo) * this.HOUR_PX;
    return v >= 0 && v <= this.hours().length * this.HOUR_PX ? v + 'px' : null;
  }
  dayCount(d: Date) {
    return this.eventsByDay().get(dateKey(d))?.length ?? 0;
  }
  dayName(d: Date) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', { weekday: 'short' }).format(d);
  }
  /** Click an empty slot: new event on that day at that hour. */
  slot(ev: MouseEvent, d: Date) {
    if (!this.canManage()) return;
    const y = (ev.target as HTMLElement).getBoundingClientRect();
    const h = Math.floor((ev.clientY - y.top) / this.HOUR_PX) + this.hourRange().lo;
    this.openNew(d);
    const hh = String(Math.min(23, h)).padStart(2, '0');
    this.draft.startTime = hh + ':00';
    this.draft.endTime = String(Math.min(23, h + 1)).padStart(2, '0') + ':00';
  }
  readonly upNext = computed(() => {
    const now = Date.now();
    return this.events()
      .filter((e) => e.status === 'scheduled' && new Date(e.endsAt).getTime() >= now)
      .filter((e) => this.typeFilter() === 'all' || e.type === this.typeFilter())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5);
  });
  dayShort(s: string) {
    const d = new Date(s);
    if (dateKey(d) === dateKey(new Date())) return this.t('Today', 'اليوم');
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
    }).format(d);
  }
  when(e: CalendarEvent) {
    return (
      new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(new Date(e.startsAt)) +
      ' · ' +
      this.time(e.startsAt) +
      '–' +
      this.time(e.endsAt)
    );
  }
  statusName(s: CalendarEvent['status']) {
    return s === 'done'
      ? this.t('Done', 'تم')
      : s === 'canceled'
        ? this.t('Canceled', 'ملغى')
        : this.t('Scheduled', 'مجدول');
  }
  openContact(e: CalendarEvent) {
    if (e.contact)
      void this.router.navigate(['/company/contacts'], {
        queryParams: { contactId: e.contact.id },
      });
  }
  openLead(e: CalendarEvent) {
    if (e.lead)
      void this.router.navigate(['/company/leads'], { queryParams: { leadId: e.lead.id } });
  }
  readonly weekCount = computed(() => this.events().length);

  open(e: CalendarEvent) {
    this.outcome.set('');
    this.selected.set(e);
  }
  closeDrawer() {
    this.selected.set(null);
  }

  openNew(day?: Date, e?: CalendarEvent) {
    this.editing.set(e ?? null);
    const base = day ?? (e ? new Date(e.startsAt) : new Date());
    const dateStr = dateKey(base);
    this.draft = e
      ? {
          type: e.type,
          title: e.title.en,
          titleAr: e.title.ar,
          date: dateKey(new Date(e.startsAt)),
          startTime: this.time(e.startsAt),
          endTime: this.time(e.endsAt),
          place: e.place,
          contactId: e.contact?.id ?? '',
          leadId: e.lead?.id ?? '',
          ownerId: e.owner?.id ?? '',
          notes: e.notes,
        }
      : {
          type: 'viewing',
          title: '',
          titleAr: '',
          date: dateStr,
          startTime: '10:00',
          endTime: '11:00',
          place: '',
          contactId: '',
          leadId: '',
          ownerId: '',
          notes: '',
        };
    this.formRequest = crypto.randomUUID();
    this.formError.set('');
    this.selected.set(null);
    this.newOpen.set(true);
  }

  closeNew() {
    if (this.saving()) return;
    this.newOpen.set(false);
  }

  private iso(date: string, time: string): string {
    // Interpreted in the browser's own local time zone (Africa/Cairo for this product's
    // users), avoiding a hardcoded UTC offset that would be wrong during Egypt's DST months.
    return new Date(date + 'T' + time + ':00').toISOString();
  }

  async submit() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const current = this.editing();
      await this.api.write(current ? '/' + current.id + '/update' : '', {
        requestId: this.formRequest,
        type: this.draft.type,
        title: this.draft.title.trim(),
        ...(this.draft.titleAr.trim() ? { titleAr: this.draft.titleAr.trim() } : {}),
        startsAt: this.iso(this.draft.date, this.draft.startTime),
        endsAt: this.iso(this.draft.date, this.draft.endTime),
        place: this.draft.place.trim(),
        contactId: this.draft.contactId || null,
        leadId: this.draft.leadId || null,
        ownerId: this.draft.ownerId || null,
        notes: this.draft.notes.trim(),
        ...(current ? { version: current.version } : {}),
      });
      this.newOpen.set(false);
      await this.reload();
      this.toast.set(this.t('Event saved', 'تم حفظ الحدث'));
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  readonly outcome = signal('');
  async setStatus(e: CalendarEvent, action: 'done' | 'canceled' | 'reopen') {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.write('/' + e.id + '/status', {
        requestId: crypto.randomUUID(),
        version: e.version,
        action,
        ...(action === 'done' && this.outcome().trim() ? { outcome: this.outcome().trim() } : {}),
      });
      this.outcome.set('');
      this.selected.set(null);
      await this.reload();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
