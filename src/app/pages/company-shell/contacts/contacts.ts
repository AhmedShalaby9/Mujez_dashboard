import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import { ContactsApi, CONTACT_TYPES, type Contact, type ContactType } from '../../../contacts-api.service';

interface Activity {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
  actor: string | null;
}

@Component({
  selector: 'app-contacts',
  imports: [FormsModule],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  private readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(ContactsApi);
  private readonly destroy = inject(DestroyRef);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }

  readonly types = CONTACT_TYPES;
  readonly typeNames = computed(() => {
    const en: Record<ContactType, string> = {
      buyer: 'Buyer',
      seller: 'Seller',
      landlord: 'Landlord',
      tenant: 'Tenant',
      investor: 'Investor',
      developer: 'Developer',
    };
    const ar: Record<ContactType, string> = {
      buyer: 'مشترٍ',
      seller: 'بائع',
      landlord: 'مالك',
      tenant: 'مستأجر',
      investor: 'مستثمر',
      developer: 'مطوّر',
    };
    return this.ar() ? ar : en;
  });

  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('contacts.manage') ?? false,
  );
  readonly owners = signal<Array<{ id: string; name: string }>>([]);

  readonly contacts = signal<Contact[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly search = signal('');
  readonly typeFilter = signal<ContactType | 'all'>('all');
  readonly archived = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly toast = signal('');

  readonly selected = signal<Contact | null>(null);
  readonly timeline = signal<Activity[]>([]);
  readonly activityTotal = signal(0);
  readonly activityPage = signal(1);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly tab = signal<'overview' | 'activity'>('overview');

  readonly newOpen = signal(false);
  readonly editing = signal<Contact | null>(null);
  readonly formError = signal('');
  readonly note = signal('');
  readonly reason = signal('');

  draft = {
    type: 'buyer' as ContactType,
    name: '',
    nameAr: '',
    companyName: '',
    phone: '',
    email: '',
    area: '',
    tags: '',
    ownerId: '',
    notes: '',
  };

  private serial = 0;
  private detailSerial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private formRequest = crypto.randomUUID();
  private noteRequest = crypto.randomUUID();

  constructor() {
    void this.reload();
    void this.loadOptions();
    this.destroy.onDestroy(() => {
      this.serial++;
      this.detailSerial++;
      clearTimeout(this.timer);
    });
  }

  async loadOptions() {
    try {
      const r = await this.api.options();
      this.owners.set(r.owners);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async reload(page = 1) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const q: Record<string, string> = {
        page: String(page),
        limit: '50',
        archived: this.archived() ? 'all' : 'active',
      };
      if (this.search().trim()) q['q'] = this.search().trim();
      if (this.typeFilter() !== 'all') q['type'] = this.typeFilter();
      const r = await this.api.list(q);
      if (serial === this.serial) {
        this.contacts.set(r.items);
        this.total.set(r.total);
        this.page.set(page);
      }
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }

  searchChanged(value: string) {
    this.search.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), 250);
  }

  setType(t: ContactType | 'all') {
    this.typeFilter.set(t);
    void this.reload();
  }

  toggleArchived() {
    this.archived.set(!this.archived());
    void this.reload();
  }

  name(c: Contact) {
    return c.name[this.lang()];
  }

  date(s: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(s));
  }

  telHref(p: string) {
    return 'tel:' + p.replace(/\s/g, '');
  }
  waHref(p: string) {
    return 'https://wa.me/' + p.replace(/[^0-9]/g, '');
  }
  mailHref(e: string) {
    return 'mailto:' + e;
  }

  async open(id: string) {
    const serial = ++this.detailSerial;
    this.selected.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.note.set('');
    this.reason.set('');
    this.tab.set('overview');
    this.noteRequest = crypto.randomUUID();
    try {
      const [contact, activity] = await Promise.all([
        this.api.get(id),
        this.api.activity(id),
      ]);
      if (serial === this.detailSerial) {
        this.selected.set(contact);
        this.timeline.set(activity.items);
        this.activityTotal.set(activity.total);
        this.activityPage.set(1);
      }
    } catch (e) {
      if (serial === this.detailSerial) this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }

  closeDrawer() {
    this.detailSerial++;
    this.selected.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }

  async moreActivity() {
    const c = this.selected();
    if (!c || this.detailLoading()) return;
    const serial = this.detailSerial;
    this.detailLoading.set(true);
    try {
      const page = this.activityPage() + 1;
      const r = await this.api.activity(c.id, page);
      if (serial === this.detailSerial) {
        this.timeline.update((a) => [...a, ...r.items]);
        this.activityTotal.set(r.total);
        this.activityPage.set(page);
      }
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }

  activityText(a: Activity) {
    const labels: Record<string, [string, string]> = {
      'contact.created': ['Contact created', 'تم إنشاء جهة الاتصال'],
      'contact.updated': ['Details updated', 'تم تعديل البيانات'],
      'contact.archived': ['Archived', 'تمت الأرشفة'],
      'contact.restored': ['Restored', 'تمت الاستعادة'],
      'contact.note': ['Note', 'ملاحظة'],
    };
    const after = (a.after ?? {}) as Record<string, unknown>;
    const note = typeof after['note'] === 'string' ? (after['note'] as string) : '';
    const reason = typeof after['reason'] === 'string' ? (after['reason'] as string) : '';
    return (
      (labels[a.action]?.[this.ar() ? 1 : 0] ?? a.action) +
      (note ? ' · ' + note : '') +
      (reason ? ' · ' + reason : '')
    );
  }

  openNew(c?: Contact) {
    this.editing.set(c ?? null);
    this.draft = c
      ? {
          type: c.type,
          name: c.name.en,
          nameAr: c.name.ar,
          companyName: c.companyName,
          phone: c.phones[0] ?? '',
          email: c.emails[0] ?? '',
          area: c.area,
          tags: c.tags.join(', '),
          ownerId: c.owner?.id ?? '',
          notes: c.notes,
        }
      : {
          type: 'buyer',
          name: '',
          nameAr: '',
          companyName: '',
          phone: '',
          email: '',
          area: '',
          tags: '',
          ownerId: '',
          notes: '',
        };
    this.formRequest = crypto.randomUUID();
    this.formError.set('');
    this.newOpen.set(true);
  }

  closeNew() {
    if (this.saving()) return;
    this.newOpen.set(false);
  }

  async submit() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const current = this.editing();
      const r = await this.api.write(current ? '/' + current.id + '/update' : '', {
        requestId: this.formRequest,
        type: this.draft.type,
        name: this.draft.name.trim(),
        ...(this.draft.nameAr.trim() ? { nameAr: this.draft.nameAr.trim() } : {}),
        companyName: this.draft.companyName.trim(),
        phones: this.draft.phone.trim() ? [this.draft.phone.trim()] : [],
        emails: this.draft.email.trim() ? [this.draft.email.trim()] : [],
        area: this.draft.area.trim(),
        tags: this.draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: this.draft.ownerId || null,
        notes: this.draft.notes.trim(),
        ...(current ? { version: current.version } : {}),
      });
      this.newOpen.set(false);
      await this.reload(this.page());
      await this.open(r.id);
      this.toast.set(this.t('Contact saved', 'تم حفظ جهة الاتصال'));
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async addNote() {
    const c = this.selected();
    if (!c || this.saving() || !this.note().trim()) return;
    this.saving.set(true);
    this.detailError.set('');
    try {
      await this.api.write('/' + c.id + '/notes', {
        requestId: this.noteRequest,
        version: c.version,
        note: this.note().trim(),
      });
      this.note.set('');
      this.noteRequest = crypto.randomUUID();
      await this.open(c.id);
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleArchive(action: 'archive' | 'restore') {
    const c = this.selected();
    if (!c || this.saving()) return;
    if (action === 'archive' && this.reason().trim().length < 10) {
      this.detailError.set(this.t('Reason must be at least 10 characters.', 'يجب ألا يقل السبب عن 10 أحرف.'));
      return;
    }
    this.saving.set(true);
    this.detailError.set('');
    try {
      await this.api.write('/' + c.id + '/archive', {
        requestId: crypto.randomUUID(),
        version: c.version,
        action,
        reason: action === 'archive' ? this.reason().trim() : this.t('Restored', 'تمت الاستعادة'),
      });
      this.reason.set('');
      await this.reload(this.page());
      await this.open(c.id);
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
