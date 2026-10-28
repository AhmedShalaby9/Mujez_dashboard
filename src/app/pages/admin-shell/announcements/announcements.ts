import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUiState, type Lang } from '../admin-ui-state';

type AnnType = 'maint' | 'feature' | 'update' | 'billing';
type Target = 'all' | 'starter' | 'pro' | 'business' | 'enterprise';
type Status = 'draft' | 'scheduled' | 'published' | 'expired';
type AnnLang = 'both' | 'en' | 'ar';

interface Announcement {
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

const SEED: Announcement[] = [
  { id: 'ANN-1', titleEn: 'Scheduled maintenance', titleAr: 'صيانة مجدولة', bodyEn: 'Mujez will be briefly unavailable Oct 30, 02:00–04:00 Cairo time for planned maintenance.', bodyAr: 'ستكون منصة مجاز غير متاحة لفترة وجيزة يوم 30 أكتوبر من 02:00 حتى 04:00 بتوقيت القاهرة لصيانة مجدولة.', type: 'maint', target: 'all', from: 'Oct 30, 02:00', to: 'Oct 30, 04:00', status: 'published', lang: 'both' },
  { id: 'ANN-2', titleEn: 'New: Advanced lead routing', titleAr: 'جديد: توجيه العملاء المتقدم', bodyEn: 'Business and Enterprise plans can now set weighted and round-robin routing rules with SLA auto-reassignment.', bodyAr: 'يمكن الآن لباقتي Business وEnterprise ضبط قواعد توجيه بالتناوب أو بالوزن مع إعادة توجيه تلقائي حسب SLA.', type: 'feature', target: 'business', from: 'Oct 20', to: 'Nov 20', status: 'published', lang: 'both' },
  { id: 'ANN-3', titleEn: 'Invoices now itemize VAT', titleAr: 'الفواتير الآن تُفصّل ضريبة القيمة المضافة', bodyEn: 'Starting November 1, all invoices show subtotal, 14% VAT and total as separate lines.', bodyAr: 'اعتبارًا من 1 نوفمبر، تعرض جميع الفواتير الإجمالي الفرعي وضريبة 14٪ والإجمالي كبنود منفصلة.', type: 'billing', target: 'all', from: 'Nov 1', to: '—', status: 'scheduled', lang: 'both' },
  { id: 'ANN-4', titleEn: 'Property Finder sync incident resolved', titleAr: 'تم حل عطل مزامنة بروبرتي فايندر', bodyEn: 'The listing sync issue affecting some accounts on Oct 27 has been resolved.', bodyAr: 'تم حل مشكلة مزامنة الإعلانات التي أثرت على بعض الحسابات في 27 أكتوبر.', type: 'update', target: 'all', from: 'Oct 28', to: 'Oct 28', status: 'expired', lang: 'both' },
  { id: 'ANN-5', titleEn: 'Preview: commission scheme builder', titleAr: 'معاينة: أداة بناء مخططات العمولة', bodyEn: 'A visual builder for multi-tier commission splits is coming to Business and Enterprise.', bodyAr: 'أداة بصرية لبناء تقسيمات عمولة متعددة المستويات قادمة لباقتي Business وEnterprise.', type: 'feature', target: 'enterprise', from: 'TBD', to: 'TBD', status: 'draft', lang: 'both' },
];

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
    sub: 'Maintenance, features and product updates inside tenant CRMs',
    newBtn: '+ New announcement',
    colTitle: 'Title',
    colTarget: 'Target',
    colWindow: 'Window',
    colStatus: 'Status',
    colAction: '',
    edit: 'Edit',
    status: { draft: 'Draft', scheduled: 'Scheduled', published: 'Published', expired: 'Expired' },
    type: { maint: 'Maintenance', feature: 'Feature', update: 'Update', billing: 'Billing' },
    target: { all: 'All companies', starter: 'Starter plan', pro: 'Pro plan', business: 'Business plan', enterprise: 'Enterprise plan' },
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
    publishToast: 'Announcement published.',
    emptyTitle: 'No announcements yet',
  },
  ar: {
    eyebrow: 'الدعم',
    title: 'الإعلانات',
    sub: 'الصيانة والخصائص وتحديثات المنتج داخل أنظمة الشركات',
    newBtn: '+ إعلان جديد',
    colTitle: 'العنوان',
    colTarget: 'الاستهداف',
    colWindow: 'الفترة',
    colStatus: 'الحالة',
    colAction: '',
    edit: 'تعديل',
    status: { draft: 'مسودة', scheduled: 'مجدول', published: 'منشور', expired: 'منتهٍ' },
    type: { maint: 'صيانة', feature: 'خاصية', update: 'تحديث', billing: 'فوترة' },
    target: { all: 'كل الشركات', starter: 'باقة Starter', pro: 'باقة Pro', business: 'باقة Business', enterprise: 'باقة Enterprise' },
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
    publishToast: 'تم نشر الإعلان.',
    emptyTitle: 'لا توجد إعلانات بعد',
  },
};

type Draft = Omit<Announcement, 'id' | 'status'>;

const EMPTY_DRAFT: Draft = {
  titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', type: 'update', target: 'all', from: '', to: '', lang: 'both',
};

@Component({
  selector: 'app-announcements',
  imports: [FormsModule],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss',
})
export class Announcements {
  private readonly ui = inject(AdminUiState);

  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly types: AnnType[] = ['maint', 'feature', 'update', 'billing'];
  readonly targets: Target[] = ['all', 'starter', 'pro', 'business', 'enterprise'];
  readonly langs: AnnLang[] = ['both', 'en', 'ar'];

  readonly items = signal<Announcement[]>(SEED);
  readonly editing = signal<Announcement | null>(null);
  readonly creating = signal(false);
  draft: Draft = { ...EMPTY_DRAFT };

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  title(a: Announcement): string {
    return this.lang() === 'ar' ? a.titleAr : a.titleEn;
  }

  body(a: Announcement): string {
    return this.lang() === 'ar' ? a.bodyAr : a.bodyEn;
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
    const { id, status, ...rest } = a;
    this.draft = { ...rest };
  }

  close(): void {
    this.creating.set(false);
    this.editing.set(null);
  }

  private upsert(status: Status): void {
    const current = this.editing();
    if (current) {
      this.items.update((list) =>
        list.map((a) => (a.id === current.id ? { ...current, ...this.draft, status } : a)),
      );
    } else {
      const id = 'ANN-' + (this.items().length + 1 + Math.floor(Math.random() * 90));
      this.items.update((list) => [{ id, ...this.draft, status }, ...list]);
    }
    this.close();
  }

  saveDraft(): void {
    this.upsert('draft');
    this.showToast(this.L().draftToast);
  }

  publish(): void {
    this.upsert('published');
    this.showToast(this.L().publishToast);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
