import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { InventoryApi, type InventoryUnit } from '../../../inventory-api.service';
import {
  CatalogApi,
  type CatalogItem,
  type CatalogKind,
  type Bi,
  type CatalogData,
  type CatalogPreference,
} from '../../../catalog-api.service';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import { AdminUiState } from '../../admin-shell/admin-ui-state';
interface Draft {
  name: string;
  ar: string;
  parentId: string;
  status: string;
  price: string;
  area: string;
  bedrooms: string;
  description: string;
  descriptionAr: string;
  location: string;
  locationAr: string;
  type: string;
  listing: string;
  phone: string;
  email: string;
  website: string;
  cover: string;
  photos: string;
  floorPlan: string;
  brochure: string;
  map: string;
  deliveryYear: string;
  finishing: string;
  founded: string;
  delivered: string;
  bathrooms: string;
  down: string;
  years: string;
  top: boolean;
  verified: boolean;
}
@Component({
  selector: 'app-inventory',
  imports: [FormsModule, RouterLink],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.scss', '../../admin-shell/admin-ui.scss'],
})
export class Inventory implements OnDestroy {
  readonly api = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  readonly legacy = signal<InventoryUnit | null>(null);
  readonly archiveConfirm = signal(false);
  readonly auth = inject(AuthService);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private companyUi = inject(CompanyUiState);
  private adminUi = inject(AdminUiState);
  readonly admin = computed(() => this.auth.user()?.pool === 'platform');
  readonly preferencesReadOnly = computed(() => this.auth.user()?.workspace?.mode === 'read');
  private formRequestId = crypto.randomUUID();
  readonly canManage = computed(
    () => this.admin() && !!this.auth.user()?.permissions.includes('co.create'),
  );
  readonly ar = computed(
    () => (this.admin() ? this.adminUi.lang() : this.companyUi.lang()) === 'ar',
  );
  readonly dir = computed(() => (this.ar() ? 'rtl' : 'ltr'));
  readonly view = this.route.snapshot.data['view'] as string;
  readonly kind: CatalogKind = this.view.startsWith('dev')
    ? 'developers'
    : this.view.startsWith('co')
      ? 'compounds'
      : 'units';
  readonly detail = ['dev', 'co', 'unit'].includes(this.view);
  readonly base = computed(() => (this.admin() ? '/admin' : '/company'));
  readonly items = signal<CatalogItem[]>([]);
  readonly item = signal<CatalogItem | null>(null);
  readonly related = signal<CatalogItem[]>([]);
  readonly relatedTotal = signal(0);
  readonly parents = signal<CatalogItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 24;
  readonly q = signal('');
  readonly filter = signal('all');
  readonly status = signal('');
  readonly sort = signal('new');
  readonly parentId = signal('');
  readonly type = signal('');
  readonly listing = signal('');
  readonly bedrooms = signal('');
  readonly gallery = signal(0);
  readonly media = signal<'photos' | 'plan'>('photos');
  readonly plan = signal(0);
  readonly editor = signal(false);
  readonly editing = signal<CatalogItem | null>(null);
  draft: Draft = this.blank();
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sub: Subscription;
  readonly title = computed(() =>
    this.kind === 'developers'
      ? this.X('Developers', 'المطوّرون')
      : this.kind === 'compounds'
        ? this.X('Compounds', 'الكمباوندات')
        : this.X('Units', 'الوحدات'),
  );
  readonly pictures = computed(() => {
    const d = this.item()?.data;
    return d ? [...new Set([d.cover, ...(d.photos ?? [])].filter((v): v is string => !!v))] : [];
  });
  readonly statuses = computed(() =>
    this.kind === 'units'
      ? ['available', 'hold', 'reserved', 'under_contract', 'sold', 'soon']
      : ['launch', 'offer', 'selling', 'resale', 'sold', 'soon', 'not_set'],
  );
  readonly alertKeys = ['units', 'price', 'launch', 'news'] as const;
  readonly types = [
    'apt',
    'villa',
    'chalet',
    'townhouse',
    'twinhouse',
    'studio',
    'office',
    'retail',
    'other',
    'duplex',
    'clinic',
    'penthouse',
    'loft',
    'cabin',
    'family_house',
  ];
  constructor() {
    this.sub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(() => {
      this.page.set(1);
      this.parentId.set(
        this.route.snapshot.queryParamMap?.get('co') ??
          this.route.snapshot.queryParamMap?.get('parentId') ??
          '',
      );
      void this.load();
    });
  }
  X(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  label(v: Bi | undefined | null) {
    return (v ? (this.ar() ? v.ar || v.en : v.en) : '') || this.X('Not set', 'غير محدد');
  }
  num(v: unknown) {
    return v === null || v === undefined || v === '' ? this.X('Not set', 'غير محدد') : String(v);
  }
  nameInitial(i: CatalogItem) {
    return i.name.en
      .split(' ')
      .map((x) => x[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  statusLabel(s: string) {
    const names: Record<string, [string, string]> = {
      launch: ['New launch', 'إطلاق جديد'],
      offer: ['Offer', 'عرض'],
      selling: ['Selling', 'متاح للبيع'],
      resale: ['Resale', 'إعادة بيع'],
      sold: ['Sold', 'مباع'],
      soon: ['Coming soon', 'قريبًا'],
      available: ['Available', 'متاحة'],
      hold: ['On hold', 'محجوزة مؤقتًا'],
      reserved: ['Reserved', 'محجوزة'],
      under_contract: ['Under contract', 'تحت التعاقد'],
      primary: ['Primary', 'من المطوّر'],
      rental: ['Rental', 'إيجار'],
      apt: ['Apartment', 'شقة'],
      villa: ['Villa', 'فيلا'],
      chalet: ['Chalet', 'شاليه'],
      townhouse: ['Townhouse', 'تاون هاوس'],
      twinhouse: ['Twin house', 'توين هاوس'],
      studio: ['Studio', 'استوديو'],
      office: ['Office', 'مكتب'],
      retail: ['Retail', 'محل'],
      other: ['Other', 'أخرى'],
      not_set: ['Not set', 'غير محدد'],
      duplex: ['Duplex', 'دوبلكس'],
      clinic: ['Clinic', 'عيادة'],
      penthouse: ['Penthouse', 'بنتهاوس'],
      loft: ['Loft', 'لوفت'],
      cabin: ['Cabin', 'كابينة'],
      family_house: ['Family house', 'منزل عائلي'],
    };
    return names[s] ? this.X(...names[s]) : s;
  }
  money(v: string | null | undefined, currency = 'EGP') {
    if (v == null) return this.X('Not set', 'غير محدد');
    const n = BigInt(v);
    return (
      currency +
      ' ' +
      (n / 100n).toLocaleString(this.ar() ? 'ar-EG' : 'en-US') +
      '.' +
      String(n % 100n).padStart(2, '0')
    );
  }
  image(i: CatalogItem) {
    return i.data.cover ?? i.data.photos?.[0] ?? null;
  }
  path(i: CatalogItem) {
    return [this.base(), i.kind, i.id];
  }
  async load() {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    this.item.set(null);
    this.related.set([]);
    this.legacy.set(null);
    try {
      const legacyId = this.route.snapshot.queryParamMap?.get('unitId');
      if (!this.admin() && this.kind === 'units' && !this.detail && legacyId) {
        const u = await this.inventory.get<InventoryUnit>('units/' + legacyId);
        if (seq === this.seq) this.legacy.set(u);
        return;
      }
      if (this.detail) {
        const id = this.route.snapshot.paramMap.get('id')!;
        const row = await this.api.detail(this.kind, id);
        if (seq !== this.seq) return;
        this.item.set(row);
        this.gallery.set(0);
        this.media.set('photos');
        this.plan.set(0);
        if (this.kind !== 'units') {
          const next = this.kind === 'developers' ? 'compounds' : 'units';
          const children = await this.api.list(next, { parentId: id, limit: '12' });
          if (seq !== this.seq) return;
          this.related.set(children.items);
          this.relatedTotal.set(children.total);
        }
      } else {
        const params: Record<string, string> = {
          page: String(this.page()),
          limit: String(this.limit),
          q: this.q(),
          filter: this.filter(),
          sort: this.sort(),
        };
        for (const [key, v] of Object.entries({
          parentId: this.parentId(),
          status: this.status(),
          type: this.type(),
          listing: this.listing(),
          bedrooms: this.bedrooms(),
        }))
          if (v) params[key] = v;
        const res = await this.api.list(this.kind, params);
        if (seq !== this.seq) return;
        this.items.set(res.items);
        this.total.set(res.total);
      }
    } catch (e) {
      if (seq === this.seq)
        this.error.set(e instanceof Error ? e.message : 'Unable to load catalog');
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
  changed() {
    this.page.set(1);
    void this.load();
  }
  search(v: string) {
    this.q.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.changed(), 250);
  }
  setFilter(v: string) {
    this.filter.set(v);
    this.changed();
  }
  turn(n: number) {
    this.page.update((p) => p + n);
    void this.load();
  }
  async preference(i: CatalogItem, b: Partial<CatalogPreference>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const pref = await this.api.preference(i, b);
      const update = (x: CatalogItem) =>
        x.id === i.id
          ? {
              ...x,
              preference: pref,
            }
          : x;
      this.items.update((a) => a.map(update));
      this.related.update((a) => a.map(update));
      this.item.update((x) => (x ? update(x) : null));
      this.notice.set(this.X('Preferences saved.', 'تم حفظ التفضيلات.'));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  toggleAlert(i: CatalogItem, k: 'units' | 'price' | 'launch' | 'news') {
    void this.preference(i, { alerts: { ...i.preference.alerts, [k]: !i.preference.alerts[k] } });
  }
  async share() {
    try {
      await navigator.clipboard.writeText(location.href);
      this.notice.set(this.X('Link copied.', 'تم نسخ الرابط.'));
    } catch {
      this.notice.set(location.href);
    }
  }
  paymentLabel(i: CatalogItem) {
    const p = i.data.paymentPlans?.[this.plan()];
    if (p?.isCash) return this.X('Cash price', 'السعر النقدي');
    if (!p?.frequency) return this.X('Estimated monthly installment', 'القسط الشهري التقريبي');
    const labels: Record<string, [string, string]> = {
      monthly: ['Monthly installment', 'القسط الشهري'],
      quarterly: ['Quarterly installment', 'القسط ربع السنوي'],
      annually: ['Annual installment', 'القسط السنوي'],
      'semi-annually': ['Semiannual installment', 'القسط نصف السنوي'],
      'one-time': ['One-time payment', 'دفعة واحدة'],
      other: ['Installment', 'القسط'],
    };
    return this.X(...(labels[p.frequency] ?? labels['other']));
  }
  monthly(i: CatalogItem) {
    const p = i.data.paymentPlans?.[this.plan()];
    if (!p) return this.X('Not set', 'غير محدد');
    if (p.isCash) return this.money(p.priceMinor, p.currency);
    if (p.frequency) return this.money(p.installmentMinor, p.currency);
    const price = p.priceMinor ?? i.priceMinor;
    if (price === null || p.years <= 0) return this.X('Not set', 'غير محدد');
    const months = Math.round(p.years * 12);
    if (months < 1) return this.X('Not set', 'غير محدد');
    const down = BigInt(Math.round(p.downPercent * 100));
    const balance = (BigInt(price) * (10000n - down)) / 10000n;
    return this.money(((balance + BigInt(months) - 1n) / BigInt(months)).toString(), p.currency);
  }
  blank(): Draft {
    return {
      name: '',
      ar: '',
      parentId: '',
      status: this?.kind === 'units' ? 'available' : 'selling',
      price: '',
      area: '',
      bedrooms: '',
      description: '',
      descriptionAr: '',
      location: '',
      locationAr: '',
      type: 'apt',
      listing: 'primary',
      phone: '',
      email: '',
      website: '',
      cover: '',
      photos: '',
      floorPlan: '',
      brochure: '',
      map: '',
      deliveryYear: '',
      finishing: '',
      founded: '',
      delivered: '',
      bathrooms: '',
      down: '',
      years: '',
      top: false,
      verified: false,
    };
  }
  async openEditor(row: CatalogItem | null = null) {
    this.formRequestId = crypto.randomUUID();
    this.error.set('');
    this.editing.set(row);
    this.draft = this.blank();
    if (row) {
      const d = row.data;
      Object.assign(this.draft, {
        name: row.name.en,
        ar: row.name.ar,
        parentId: row.parentId ?? '',
        status: row.status,
        price:
          row.priceMinor === null
            ? ''
            : `${BigInt(row.priceMinor) / 100n}.${String(BigInt(row.priceMinor) % 100n).padStart(2, '0')}`,
        area: row.area ?? '',
        bedrooms: row.bedrooms === null ? '' : String(row.bedrooms),
        description: d.description?.en ?? '',
        descriptionAr: d.description?.ar ?? '',
        location: d.location?.en ?? '',
        locationAr: d.location?.ar ?? '',
        type: d.type ?? 'apt',
        listing: d.listing ?? 'primary',
        phone: d.phone ?? '',
        email: d.email ?? '',
        website: d.website ?? '',
        cover: d.cover ?? '',
        photos: (d.photos ?? []).join('\n'),
        floorPlan: d.floorPlan ?? '',
        brochure: d.brochure ?? '',
        map: d.map ?? '',
        deliveryYear: String(d.deliveryYear ?? ''),
        finishing: d.finishing?.en ?? '',
        founded: String(d.founded ?? ''),
        delivered: String(d.delivered ?? ''),
        bathrooms: String(d.bathrooms ?? ''),
        down: String(d.paymentPlans?.[0]?.downPercent ?? ''),
        years: String(d.paymentPlans?.[0]?.years ?? ''),
        top: !!d.top,
        verified: !!d.verified,
      });
    }
    this.parents.set([]);
    this.editor.set(true);
  }
  async searchParents(v: string) {
    try {
      if (this.kind === 'developers') return;
      const r = await this.api.list(this.kind === 'units' ? 'compounds' : 'developers', {
        q: v,
        limit: '100',
      });
      this.parents.set(r.items);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  hasValue(v: unknown) {
    return v !== null && v !== undefined && v !== '';
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const d = this.draft;
      let priceMinor: string | null = null;
      if (d.price) {
        if (!/^\d+(?:\.\d{1,2})?$/.test(d.price))
          throw new Error(
            this.X('Enter a valid price with up to two decimals.', 'أدخل سعرًا صحيحًا.'),
          );
        const [whole, fraction = ''] = d.price.split('.');
        priceMinor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
      }
      const data: CatalogData = { ...this.editing()?.data };
      for (const key of [
        'phone',
        'email',
        'website',
        'cover',
        'floorPlan',
        'brochure',
        'map',
      ] as const) {
        if (d[key]) data[key] = d[key];
        else delete data[key];
      }
      data.description = { en: d.description, ar: d.descriptionAr };
      if (d.location) data.location = { en: d.location, ar: d.locationAr || d.location };
      else delete data.location;
      data.photos = d.photos
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (this.kind === 'developers') {
        data.top = d.top;
        data.verified = d.verified;
        for (const key of ['founded', 'delivered'] as const) {
          if (this.hasValue(d[key])) data[key] = Number(d[key]);
          else delete data[key];
        }
      } else {
        for (const key of ['deliveryYear', 'bathrooms'] as const) {
          if (this.hasValue(d[key])) data[key] = Number(d[key]);
          else delete data[key];
        }
        if (d.finishing)
          data.finishing = {
            en: d.finishing,
            ar:
              this.editing()?.data.finishing?.en === d.finishing
                ? this.editing()!.data.finishing!.ar
                : d.finishing,
          };
        else delete data.finishing;
        if (this.hasValue(d.down) && this.hasValue(d.years))
          data.paymentPlans = [
            {
              ...data.paymentPlans?.[0],
              name: data.paymentPlans?.[0]?.name ?? { en: 'Payment plan', ar: 'خطة السداد' },
              downPercent: Number(d.down),
              years: Number(d.years),
            },
            ...(data.paymentPlans?.slice(1) ?? []),
          ];
        else data.paymentPlans = [];
        if (this.kind === 'units') {
          data.type = d.type;
          data.listing = d.listing;
        }
      }
      const row = await this.api.save(
        this.kind,
        {
          requestId: this.formRequestId,
          ...(this.editing() ? { version: this.editing()!.version } : {}),
          parentId: d.parentId || null,
          name: { en: d.name, ar: d.ar || d.name },
          status: d.status,
          priceMinor,
          area: this.hasValue(d.area) ? Number(d.area) : null,
          bedrooms: this.hasValue(d.bedrooms) ? Number(d.bedrooms) : null,
          data,
        },
        this.editing()?.id,
      );
      this.editor.set(false);
      this.notice.set(this.X('Catalog record saved.', 'تم حفظ السجل.'));
      if (this.detail && row.id !== this.item()?.id) await this.router.navigate(this.path(row));
      else await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  async archive() {
    const i = this.item();
    if (!i || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.archive(i);
      this.archiveConfirm.set(false);
      await this.router.navigate([this.base(), this.kind]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  ngOnDestroy() {
    this.seq++;
    this.sub.unsubscribe();
    clearTimeout(this.timer);
  }
}
