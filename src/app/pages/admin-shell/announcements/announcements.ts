import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth.service';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type AnnType = 'maint' | 'feature' | 'update' | 'billing';
type Target = 'all' | 'starter' | 'pro' | 'business' | 'enterprise';
type Status = 'draft' | 'scheduled' | 'published' | 'expired';
type AnnLang = 'both' | 'en' | 'ar';

interface Announcement {
  version: number;
  published: boolean;
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  type: AnnType;
  target: Target;
  from: string;
  to: string;
  status: Status;
  lang: AnnLang;
}

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  newBtn: string;
  colTitle: string;
  colTarget: string;
  colWindow: string;
  colStatus: string;
  colAction: string;
  edit: string;
  status: Record<Status, string>;
  type: Record<AnnType, string>;
  target: Record<Target, string>;
  langLabel: Record<AnnLang, string>;
  formTitleNew: string;
  formTitleEdit: string;
  fieldTitleEn: string;
  fieldTitleAr: string;
  fieldBodyEn: string;
  fieldBodyAr: string;
  fieldType: string;
  fieldTarget: string;
  fieldFrom: string;
  fieldTo: string;
  fieldLang: string;
  previewTitle: string;
  cancel: string;
  saveDraft: string;
  publish: string;
  draftToast: string;
  publishToast: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Support',
    title: 'Announcements',
    sub: 'Manage bilingual company notices and publishing schedules',
    newBtn: '+ New announcement',
    colTitle: 'Title',
    colTarget: 'Target',
    colWindow: 'Window',
    colStatus: 'Status',
    colAction: '',
    edit: 'Edit',
    status: { draft: 'Draft', scheduled: 'Scheduled', published: 'Published', expired: 'Expired' },
    type: { maint: 'Maintenance', feature: 'Feature', update: 'Update', billing: 'Billing' },
    target: {
      all: 'All companies',
      starter: 'Starter plan',
      pro: 'Pro plan',
      business: 'Business plan',
      enterprise: 'Enterprise plan',
    },
    langLabel: { both: 'EN + AR', en: 'English only', ar: 'Arabic only' },
    formTitleNew: 'New announcement',
    formTitleEdit: 'Edit announcement',
    fieldTitleEn: 'Title (English)',
    fieldTitleAr: 'Title (Arabic)',
    fieldBodyEn: 'Body (English)',
    fieldBodyAr: 'Body (Arabic)',
    fieldType: 'Type',
    fieldTarget: 'Target',
    fieldFrom: 'Starts',
    fieldTo: 'Ends',
    fieldLang: 'Language',
    previewTitle: 'Tenant banner preview',
    cancel: 'Cancel',
    saveDraft: 'Save as draft',
    publish: 'Publish',
    draftToast: 'Saved as draft.',
    publishToast: 'Publishing settings saved. Status follows the selected time window.',
    emptyTitle: 'No announcements yet',
  },
  ar: {
    eyebrow: 'الدعم',
    title: 'الإعلانات',
    sub: 'إدارة إعلانات الشركات باللغتين ومواعيد النشر',
    newBtn: '+ إعلان جديد',
    colTitle: 'العنوان',
    colTarget: 'الاستهداف',
    colWindow: 'الفترة',
    colStatus: 'الحالة',
    colAction: '',
    edit: 'تعديل',
    status: { draft: 'مسودة', scheduled: 'مجدول', published: 'منشور', expired: 'منتهٍ' },
    type: { maint: 'صيانة', feature: 'خاصية', update: 'تحديث', billing: 'فوترة' },
    target: {
      all: 'كل الشركات',
      starter: 'باقة Starter',
      pro: 'باقة Pro',
      business: 'باقة Business',
      enterprise: 'باقة Enterprise',
    },
    langLabel: { both: 'عربي + إنجليزي', en: 'إنجليزي فقط', ar: 'عربي فقط' },
    formTitleNew: 'إعلان جديد',
    formTitleEdit: 'تعديل الإعلان',
    fieldTitleEn: 'العنوان (إنجليزي)',
    fieldTitleAr: 'العنوان (عربي)',
    fieldBodyEn: 'النص (إنجليزي)',
    fieldBodyAr: 'النص (عربي)',
    fieldType: 'النوع',
    fieldTarget: 'الاستهداف',
    fieldFrom: 'يبدأ',
    fieldTo: 'ينتهي',
    fieldLang: 'اللغة',
    previewTitle: 'معاينة شريط إشعار الشركة',
    cancel: 'إلغاء',
    saveDraft: 'حفظ كمسودة',
    publish: 'نشر',
    draftToast: 'تم الحفظ كمسودة.',
    publishToast: 'تم حفظ إعدادات النشر. تتحدد الحالة وفق الفترة المختارة.',
    emptyTitle: 'لا توجد إعلانات بعد',
  },
};

type Draft = Omit<Announcement, 'id' | 'status' | 'version' | 'published'>;

const EMPTY_DRAFT: Draft = {
  titleEn: '',
  titleAr: '',
  bodyEn: '',
  bodyAr: '',
  type: 'update',
  target: 'all',
  from: '',
  to: '',
  lang: 'both',
};

@Component({
  selector: 'app-announcements',
  imports: [FormsModule],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss',
})
export class Announcements {
  private readonly api = inject(AuthService);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const items: Announcement[] = [];
      let page = 1;
      while (true) {
        const r = await this.api.request('/admin/api/v1/announcements?page=' + page + '&limit=100');
        items.push(...r.items);
        if (items.length >= r.total || !r.items.length) break;
        page++;
      }
      this.items.set(items);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  localTime(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly types: AnnType[] = ['maint', 'feature', 'update', 'billing'];
  readonly targets: Target[] = ['all', 'starter', 'pro', 'business', 'enterprise'];
  readonly langs: AnnLang[] = ['both', 'en', 'ar'];

  readonly items = signal<Announcement[]>([]);
  readonly editing = signal<Announcement | null>(null);
  readonly creating = signal(false);
  draft: Draft = { ...EMPTY_DRAFT };

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  title(a: Announcement): string {
    return this.lang() === 'ar' ? a.titleAr || a.titleEn : a.titleEn || a.titleAr;
  }

  body(a: Announcement): string {
    return this.lang() === 'ar' ? a.bodyAr || a.bodyEn : a.bodyEn || a.bodyAr;
  }

  statusName(s: Status): string {
    return this.L().status[s];
  }

  typeName(t: AnnType): string {
    return this.L().type[t];
  }

  targetName(t: Target): string {
    return this.L().target[t];
  }

  langName(l: AnnLang): string {
    return this.L().langLabel[l];
  }

  typeColorClass(t: AnnType): string {
    return 'banner--' + t;
  }

  openCreate(): void {
    this.creating.set(true);
    this.editing.set(null);
    this.draft = { ...EMPTY_DRAFT };
  }

  openEdit(a: Announcement): void {
    this.creating.set(false);
    this.editing.set(a);
    const { id, status, version, published, ...rest } = a;
    this.draft = { ...rest, from: this.localTime(a.from), to: this.localTime(a.to) };
  }

  close(): void {
    this.creating.set(false);
    this.editing.set(null);
  }

  async save(published: boolean): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const current = this.editing();
      await this.api.request(
        '/admin/api/v1/announcements' + (current ? '/' + current.id + '/update' : ''),
        {
          ...this.draft,
          version: current?.version ?? 0,
          published,
          from: this.draft.from ? new Date(this.draft.from).toISOString() : null,
          to: this.draft.to ? new Date(this.draft.to).toISOString() : null,
        },
      );
      this.close();
      await this.load();
      this.showToast(published ? this.L().publishToast : this.L().draftToast);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  saveDraft() {
    return this.save(false);
  }
  publish() {
    return this.save(true);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
