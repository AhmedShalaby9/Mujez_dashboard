import { RUNTIME_CONFIG } from '../../../runtime-config';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import { CompactAmountDirective } from '../../../compact-amount.directive';
import { minorAmount, majorAmount, salesMoney } from '../../../sales-api.service';
import {
  type OfficeField,
  clientFields,
  propertyFields,
  commonFilters,
  purposes,
  propertyTypes,
  furnishing,
  clientStatuses,
  propertyStatuses,
  dealStatuses,
} from './office-fields';
@Component({
  selector: 'app-office',
  imports: [FormsModule, RouterLink, CompactAmountDirective],
  templateUrl: './office.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    './office.scss',
  ],
})
export class Office {
  readonly auth = inject(AuthService);
  private readonly config = inject(RUNTIME_CONFIG);
  readonly ui = inject(CompanyUiState);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly view = this.route.snapshot.data['officeView'] as
    'dashboard' | 'clients' | 'properties' | 'bookings' | 'deals';
  readonly rows = signal<any[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly options = signal<any>({ staff: [], scope: 'own' });
  readonly detail = signal<any>(null);
  readonly matches = signal<any>(null);
  readonly matching = signal(false);
  readonly savedFilters = signal<any[]>([]);
  readonly summary = signal<any>({});
  readonly mode = signal<
    'client' | 'property' | 'activity' | 'book' | 'close' | 'cancel' | 'renew' | null
  >(null);
  readonly fields = signal<OfficeField[]>([]);
  readonly target = signal<any>(null);
  readonly choices = signal<any[]>([]);
  readonly choiceTotal = signal(0);
  readonly choicePage = signal(1);
  readonly choiceLoading = signal(false);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('leads.manage') ?? false,
  );
  readonly canBook = computed(
    () => this.canManage() && !!this.auth.user()?.permissions.includes('reservations.manage'),
  );
  form: any = {};
  filters: Record<string, any> = {};
  filterName = '';
  savedId = '';
  advanced = false;
  lookup = '';
  matchPurpose = 'rent';
  private requestId = '';
  private signature = '';
  private generation = 0;
  private detailGeneration = 0;
  private choiceGeneration = 0;
  private choiceSearchTimer?: ReturnType<typeof setTimeout>;
  private readonly choicePageSize = 100;
  readonly purposes = purposes;
  readonly clientStatuses = clientStatuses;
  readonly propertyStatuses = propertyStatuses;
  readonly dealStatuses = dealStatuses;
  cityOptions(includeArchived = false): [string, string, string][] {
    return (this.options().cities ?? [])
      .filter((c: any) => includeArchived || !c.archived || c.id === this.form.cityId)
      .map((c: any) => [
        c.id,
        c.nameEn + (c.archived ? ' (deleted)' : ''),
        c.nameAr + (c.archived ? ' (محذوفة)' : ''),
      ]);
  }
  ownerPhoneLocal(value: string) {
    return String(value ?? '').replace(/^\+20/, '');
  }
  now() {
    return new Date().toISOString();
  }
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  money(v: any) {
    return v == null ? this.t('Not set', 'غير محدد') : salesMoney(String(v));
  }
  title() {
    return this.t(
      {
        dashboard: 'Office overview',
        clients: 'Clients',
        properties: 'Office properties',
        bookings: 'Bookings',
        deals: 'Deals',
      }[this.view],
      {
        dashboard: 'ملخص المكتب',
        clients: 'العملاء',
        properties: 'عقارات المكتب',
        bookings: 'الحجوزات',
        deals: 'الصفقات',
      }[this.view],
    );
  }
  label(v: string) {
    const found = [
      ...purposes,
      ...propertyTypes,
      ...furnishing,
      ...clientStatuses,
      ...propertyStatuses,
      ...dealStatuses,
    ].find((x) => x[0] === v);
    return found ? this.t(found[1], found[2]) : v;
  }
  date(v: any) {
    if (!v) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(v));
  }
  local(v: any) {
    if (!v) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(v));
    const g = (k: string) => parts.find((p) => p.type === k)?.value;
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
  }
  private querySub = this.route.queryParamMap.subscribe((p) => {
    if (this.view === 'clients' && p.get('new') && this.options().staff.length)
      this.begin('client');
  });
  ngOnDestroy() {
    this.querySub.unsubscribe();
    this.generation++;
    this.detailGeneration++;
    this.choiceGeneration++;
    if (this.choiceSearchTimer) clearTimeout(this.choiceSearchTimer);
  }
  constructor() {
    if (this.view === 'bookings') this.filters['status'] = 'booked';
    void this.start();
  }
  async api(path: string, body?: any) {
    return this.auth.request('/api/v1/office/' + path, body);
  }
  async start() {
    try {
      this.options.set(await this.api('options'));
      if (this.view === 'clients' && this.route.snapshot.queryParamMap.get('new'))
        this.begin('client');
      await this.load();
      if (['clients', 'properties'].includes(this.view))
        this.savedFilters.set((await this.api('filters?view=' + this.view)).items);
      const id = this.route.snapshot.queryParamMap.get(
        this.view === 'clients' ? 'clientId' : 'propertyId',
      );
      if (id && ['clients', 'properties'].includes(this.view)) await this.openDetail(id);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async load() {
    const n = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.view === 'dashboard') {
        const results = await Promise.all([
          this.api('clients?limit=1'),
          this.api('properties?limit=1&status=available'),
          this.api('deals?limit=1&status=booked'),
          this.api('deals?limit=1&status=rented'),
          this.api('deals?limit=1&status=sold'),
        ]);
        if (n === this.generation)
          this.summary.set({
            clients: results[0].total,
            properties: results[1].total,
            bookings: results[2].total,
            closed: results[3].total + results[4].total,
          });
        return;
      }
      const q: Record<string, string> = { page: String(this.page()), limit: '24' };
      for (const [key, value] of Object.entries(this.filters)) {
        if (value === null || value === undefined || value === '') continue;
        q[key] = ['minPrice', 'maxPrice'].includes(key)
          ? minorAmount(String(value))!
          : String(value);
      }
      const r = await this.api(
        (this.view === 'bookings' ? 'deals' : this.view) + '?' + new URLSearchParams(q),
      );
      if (n !== this.generation) return;
      this.rows.set(r.items);
      this.total.set(r.total);
    } catch (e) {
      if (n === this.generation) {
        this.rows.set([]);
        this.total.set(0);
        this.error.set((e as Error).message);
      }
    } finally {
      if (n === this.generation) this.loading.set(false);
    }
  }
  apply() {
    this.page.set(1);
    void this.load();
  }
  reset() {
    this.filters = this.view === 'bookings' ? { status: 'booked' } : {};
    this.savedId = '';
    this.apply();
  }
  removeFilter(key: string) {
    delete this.filters[key];
    this.apply();
  }
  activeFilters() {
    return Object.entries(this.filters).filter(
      ([, v]) => v !== '' && v !== null && v !== undefined,
    );
  }
  filterLabel(key: string) {
    const f = this.filterFields().find((x) => x.key === key);
    return f ? this.t(f.en, f.ar) : key;
  }
  filterFields(): OfficeField[] {
    const staff = this.options().staff.map(
      (x: any) => [x.id, x.name, x.name] as [string, string, string],
    );
    const status =
      this.view === 'clients'
        ? clientStatuses
        : this.view === 'properties'
          ? propertyStatuses
          : dealStatuses;
    const extra: OfficeField[] = [
      { key: 'status', en: 'Status', ar: 'الحالة', options: status },
      {
        key: 'ownerId',
        en: this.view === 'properties' ? 'Responsible salesperson' : 'Salesperson',
        ar: 'السيلز المسؤول',
        options: staff,
      },
      {
        key: 'sort',
        en: 'Sort',
        ar: 'الترتيب',
        options: [
          ['newest', 'Newest', 'الأحدث'],
          ['oldest', 'Oldest', 'الأقدم'],
          ...(this.view === 'properties'
            ? ([
                ['price_low', 'Price low to high', 'السعر تصاعديًا'],
                ['price_high', 'Price high to low', 'السعر تنازليًا'],
                ['area_high', 'Largest area', 'المساحة الأكبر'],
              ] as [string, string, string][])
            : []),
        ],
      },
    ];
    if (this.view === 'clients')
      return [
        ...commonFilters,
        ...extra,
        { key: 'source', en: 'Source', ar: 'المصدر' },
        { key: 'lastContactBefore', en: 'Last contact before', ar: 'آخر تواصل قبل', type: 'date' },
        { key: 'moveInBefore', en: 'Move-in by', ar: 'السكن قبل', type: 'date' },
        {
          key: 'callbacks',
          en: 'Follow-up',
          ar: 'المتابعة',
          options: [
            ['due', 'Due / overdue', 'مستحقة / متأخرة'],
            ['scheduled', 'Scheduled', 'لها موعد'],
            ['none', 'No follow-up date', 'بدون موعد'],
            ['no_contact', 'Never called', 'لم يتم الاتصال'],
          ],
        },
      ];
    if (this.view === 'properties')
      return [
        ...commonFilters,
        ...extra,
        { key: 'createdBy', en: 'Added by', ar: 'أضيف بواسطة', options: staff },
        { key: 'city', en: 'Project', ar: 'مشروع', options: this.cityOptions(true) },
        { key: 'finish', en: 'Finishing', ar: 'التشطيب' },
        { key: 'minFloor', en: 'Minimum floor', ar: 'أقل دور', type: 'number' },
        { key: 'maxFloor', en: 'Maximum floor', ar: 'أعلى دور', type: 'number' },
        { key: 'verifiedBefore', en: 'Last confirmed before', ar: 'آخر تأكيد قبل', type: 'date' },
        { key: 'availableBefore', en: 'Available by', ar: 'متاح بحلول', type: 'date' },
        {
          key: 'expiring',
          en: 'Lease ending soon',
          ar: 'إيجار ينتهي قريبًا',
          options: [['15', 'Within 15 days', 'خلال ١٥ يومًا']],
        },
      ];
    return [
      commonFilters[0],
      {
        key: 'purpose',
        en: 'Purpose',
        ar: 'الغرض',
        options: purposes.filter((p) => p[0] !== 'both'),
      },
      ...extra,
      commonFilters[11],
      commonFilters[12],
    ];
  }
  async saveFilters() {
    if (!this.filterName.trim()) return;
    try {
      const filters: any = { ...this.filters };
      for (const k of ['minPrice', 'maxPrice'])
        if (filters[k]) filters[k] = minorAmount(String(filters[k]));
      for (const k of Object.keys(filters))
        if (filters[k] === '' || filters[k] == null) delete filters[k];
      await this.api('filters', {
        requestId: crypto.randomUUID(),
        data: { view: this.view, name: this.filterName.trim(), filters },
      });
      this.savedFilters.set((await this.api('filters?view=' + this.view)).items);
      this.filterName = '';
      this.notice.set(this.t('Filters saved.', 'تم حفظ الفلاتر.'));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  useSaved() {
    const f = this.savedFilters().find((x) => x.id === this.savedId);
    if (!f) return;
    this.filters = { ...f.filters };
    for (const k of ['minPrice', 'maxPrice'])
      if (this.filters[k]) this.filters[k] = majorAmount(String(this.filters[k]));
    this.apply();
  }
  paginate(d: number) {
    if (this.page() + d < 1 || this.loading()) return;
    this.page.update((p) => p + d);
    void this.load();
  }
  async openDetail(id: string) {
    const n = ++this.detailGeneration;
    this.error.set('');
    this.matches.set(null);
    try {
      const r = await this.api(this.view + '/' + id);
      if (n === this.detailGeneration) {
        this.detail.set(r);
        this.matchPurpose = r.needs?.purpose === 'sale' ? 'sale' : 'rent';
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  closeDetail() {
    if (this.saving()) return;
    this.detailGeneration++;
    this.detail.set(null);
    this.matches.set(null);
  }
  closeForm() {
    if (this.saving()) return;
    this.choiceGeneration++;
    if (this.choiceSearchTimer) clearTimeout(this.choiceSearchTimer);
    this.mode.set(null);
    this.choices.set([]);
  }
  begin(mode: NonNullable<ReturnType<typeof this.mode>>, row: any = null) {
    if (this.saving()) return;
    this.target.set(row);
    this.mode.set(mode);
    this.error.set('');
    this.requestId = crypto.randomUUID();
    this.signature = '';
    this.choiceGeneration++;
    if (this.choiceSearchTimer) clearTimeout(this.choiceSearchTimer);
    this.choicePage.set(1);
    this.choiceTotal.set(0);
    this.lookup = '';
    this.choices.set([]);
    this.form = {};
    if (mode === 'client') {
      this.form = {
        name: '',
        phone: '',
        email: '',
        source: 'inbound_call',
        status: 'new',
        purpose: 'rent',
        areas: '',
        type: '',
        furnishing: '',
        saleBudget: '',
        rentBudget: '',
        minBedrooms: null,
        minBathrooms: null,
        minArea: null,
        maxArea: null,
        moveIn: '',
        followUpAt: '',
        ...(row
          ? {
              ...row,
              ...row.needs,
              areas: (row.needs.areas ?? []).join('\n'),
              saleBudget: row.needs.saleBudgetMinor ? majorAmount(row.needs.saleBudgetMinor) : '',
              rentBudget: row.needs.rentBudgetMinor ? majorAmount(row.needs.rentBudgetMinor) : '',
              followUpAt: this.local(row.followUpAt),
              ownerId: row.owner.id,
            }
          : {}),
      };
      this.fields.set([
        ...clientFields,
        ...(this.options().scope !== 'own'
          ? [
              {
                key: 'ownerId',
                en: 'Responsible salesperson',
                ar: 'السيلز المسؤول',
                options: this.staffOptions(),
              },
            ]
          : []),
      ]);
    }
    if (mode === 'property') {
      this.form = {
        title: '',
        ownerName: '',
        ownerPhone: '',
        cityId: '',
        areaName: '',
        address: '',
        type: 'apartment',
        purpose: 'rent',
        furnishing: 'unfurnished',
        bedrooms: null,
        bathrooms: null,
        area: null,
        floor: null,
        finish: '',
        salePrice: '',
        rentPrice: '',
        deposit: '',
        minLeaseMonths: 1,
        availableOn: '',
        verifiedOn: '',
        photos: '',
        description: '',
        negotiable: false,
        ...(row
          ? {
              ...row.data,
              title: row.title,
              ownerPhone: this.ownerPhoneLocal(row.data.ownerPhones[0]),
              cityId:
                row.data.cityId ??
                (this.options().cities ?? []).find((c: any) =>
                  [c.nameEn, c.nameAr].includes(row.data.city),
                )?.id ??
                '',
              photos: (row.data.photos ?? []).join('\n'),
              salePrice: row.data.saleMinor ? majorAmount(row.data.saleMinor) : '',
              rentPrice: row.data.rentMinor ? majorAmount(row.data.rentMinor) : '',
              deposit: row.data.depositMinor ? majorAmount(row.data.depositMinor) : '',
              responsibleId: row.responsible.id,
              status: row.status,
            }
          : {}),
      };
      this.fields.set([
        ...propertyFields.map((f) =>
          f.key === 'cityId' ? { ...f, options: this.cityOptions() } : f,
        ),
        ...(row && ['available', 'withdrawn'].includes(row.status)
          ? [
              {
                key: 'status',
                en: 'Availability',
                ar: 'التوافر',
                options: propertyStatuses.filter((x) => ['available', 'withdrawn'].includes(x[0])),
              },
            ]
          : []),
        ...(this.options().scope !== 'own'
          ? [
              {
                key: 'responsibleId',
                en: 'Responsible salesperson',
                ar: 'السيلز المسؤول',
                options: this.staffOptions(),
              },
            ]
          : []),
      ]);
    }
    if (mode === 'activity') {
      this.form = {
        kind: 'call',
        notes: '',
        propertyId: '',
        scheduledAt: '',
        followUpAt: this.local(row.followUpAt),
        outcome: '',
      };
      this.fields.set([
        {
          key: 'kind',
          en: 'Activity',
          ar: 'النشاط',
          options: [
            ['call', 'Call', 'مكالمة'],
            ['note', 'Note', 'ملاحظة'],
            ['viewing', 'Viewing', 'معاينة'],
          ],
        },
        { key: 'notes', en: 'Notes', ar: 'الملاحظات', type: 'textarea', required: true },
        { key: 'outcome', en: 'Outcome', ar: 'النتيجة' },
        {
          key: 'scheduledAt',
          en: 'Viewing date · Cairo',
          ar: 'موعد المعاينة · القاهرة',
          type: 'datetime-local',
        },
        {
          key: 'followUpAt',
          en: 'Next follow-up · Cairo',
          ar: 'المتابعة القادمة · القاهرة',
          type: 'datetime-local',
        },
      ]);
      void this.searchChoices();
    }
    if (mode === 'book') {
      this.form = {
        purpose: row.data.purpose === 'sale' ? 'sale' : 'rent',
        clientId: '',
        notes: '',
      };
      this.fields.set([
        {
          key: 'purpose',
          en: 'Purpose',
          ar: 'الغرض',
          options: purposes.filter(
            (p) => p[0] !== 'both' && (row.data.purpose === 'both' || p[0] === row.data.purpose),
          ),
        },
        { key: 'notes', en: 'Agreement notes', ar: 'ملاحظات الاتفاق', type: 'textarea' },
      ]);
      void this.searchChoices();
    }
    if (mode === 'close') {
      this.form = {
        price: '',
        leaseStart: '',
        leaseEnd: '',
        contractUrl: '',
        notes: row.notes ?? '',
      };
      this.fields.set([
        {
          key: 'price',
          en: row.purpose === 'rent' ? 'Agreed monthly rent · EGP' : 'Final sale price · EGP',
          ar:
            row.purpose === 'rent'
              ? 'الإيجار الشهري المتفق عليه · جنيه'
              : 'سعر البيع النهائي · جنيه',
          type: 'money',
          required: true,
        },
        ...(row.purpose === 'rent'
          ? [
              {
                key: 'leaseStart',
                en: 'Lease start',
                ar: 'بداية الإيجار',
                type: 'date',
                required: true,
              },
              {
                key: 'leaseEnd',
                en: 'Lease end · available again on this date',
                ar: 'نهاية الإيجار · متاح مجددًا في هذا التاريخ',
                type: 'date',
                required: true,
              },
            ]
          : []),
        {
          key: 'contractUrl',
          en: 'Contract link · optional HTTPS',
          ar: 'رابط العقد · HTTPS اختياري',
        },
        { key: 'notes', en: 'Notes', ar: 'الملاحظات', type: 'textarea' },
      ]);
    }
    if (mode === 'cancel') {
      this.form = { reason: '' };
      this.fields.set([
        {
          key: 'reason',
          en: 'Cancellation reason',
          ar: 'سبب الإلغاء',
          type: 'textarea',
          required: true,
        },
      ]);
    }
    if (mode === 'renew') {
      this.form = { leaseEnd: row.leaseEnd };
      this.fields.set([
        {
          key: 'leaseEnd',
          en: 'New lease end',
          ar: 'نهاية الإيجار الجديدة',
          type: 'date',
          required: true,
        },
      ]);
    }
  }
  staffOptions() {
    return this.options().staff.map((s: any) => [s.id, s.name, s.name] as [string, string, string]);
  }
  formTitle() {
    const key = this.mode()!;
    return this.t(
      {
        client: 'Client',
        property: 'Office property',
        activity: 'Client activity / viewing',
        book: 'Book property for your client',
        close: 'Close deal',
        cancel: 'Cancel booking',
        renew: 'Renew lease',
      }[key],
      {
        client: 'بيانات العميل',
        property: 'عقار المكتب',
        activity: 'تواصل / معاينة العميل',
        book: 'حجز العقار لعميلك',
        close: 'إغلاق الصفقة',
        cancel: 'إلغاء الحجز',
        renew: 'تجديد الإيجار',
      }[key],
    );
  }
  scheduleChoiceSearch() {
    if (this.choiceSearchTimer) clearTimeout(this.choiceSearchTimer);
    this.choiceGeneration++;
    this.choiceLoading.set(false);
    this.choicePage.set(1);
    this.choiceTotal.set(0);
    this.choiceSearchTimer = setTimeout(() => {
      this.choiceSearchTimer = undefined;
      void this.searchChoices();
    }, 250);
  }
  choiceHasMore() {
    return this.choicePage() * this.choicePageSize < this.choiceTotal();
  }
  choiceResultCount() {
    return Math.min(this.choicePage() * this.choicePageSize, this.choiceTotal());
  }
  async searchChoices(loadMore = false) {
    const mode = this.mode();
    if (mode !== 'book' && mode !== 'activity') return;
    if (this.choiceSearchTimer) {
      clearTimeout(this.choiceSearchTimer);
      this.choiceSearchTimer = undefined;
      loadMore = false;
    }
    const generation = ++this.choiceGeneration;
    const page = loadMore ? this.choicePage() + 1 : 1;
    this.choiceLoading.set(true);
    try {
      const path = mode === 'book' ? 'clients' : 'properties';
      const q = new URLSearchParams({
        q: this.lookup.trim(),
        page: String(page),
        limit: String(this.choicePageSize),
      });
      if (mode === 'book' && this.options().scope !== 'company')
        q.set('ownerId', this.auth.user()!.id);
      const r = await this.api(path + '?' + q);
      if (this.mode() !== mode || generation !== this.choiceGeneration) return;
      const selected = this.choices().find(
        (x) => x.id === (mode === 'book' ? this.form.clientId : this.form.propertyId),
      );
      const items = loadMore
        ? [
            ...this.choices(),
            ...r.items.filter((x: any) => !this.choices().some((c) => c.id === x.id)),
          ]
        : r.items;
      this.choices.set(
        selected && !items.some((x: any) => x.id === selected.id) ? [selected, ...items] : items,
      );
      this.choicePage.set(page);
      this.choiceTotal.set(r.total);
    } catch (e) {
      if (generation === this.choiceGeneration) this.error.set((e as Error).message);
    } finally {
      if (generation === this.choiceGeneration) this.choiceLoading.set(false);
    }
  }
  async recommend() {
    const row = this.detail();
    if (!row || this.matching()) return;
    this.matching.set(true);
    this.error.set('');
    try {
      this.matches.set(
        await this.api('clients/' + row.id + '/recommendations?purpose=' + this.matchPurpose),
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.matching.set(false);
    }
  }
  bookMatch(match: any) {
    const client = this.detail();
    this.begin('book', match.property);
    this.form.clientId = client.id;
    this.choices.set([client]);
  }
  private lines(v: any) {
    return String(v ?? '')
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  private amount(v: any) {
    return v == null || v === '' ? null : minorAmount(String(v));
  }
  payload() {
    const f = this.form,
      mode = this.mode();
    if (mode === 'client') {
      const nullable = (v: any) => (v === '' || v == null ? null : Number(v));
      return {
        name: f.name,
        phone: f.phone,
        email: f.email || '',
        source: f.source,
        status: f.status,
        ...(f.ownerId ? { ownerId: f.ownerId } : {}),
        followUpAt: f.followUpAt || null,
        needs: {
          purpose: f.purpose,
          areas: this.lines(f.areas),
          type: f.type || '',
          furnishing: f.furnishing || '',
          saleBudgetMinor: this.amount(f.saleBudget),
          rentBudgetMinor: this.amount(f.rentBudget),
          minBedrooms: nullable(f.minBedrooms),
          minBathrooms: nullable(f.minBathrooms),
          minArea: nullable(f.minArea),
          maxArea: nullable(f.maxArea),
          moveIn: f.moveIn || null,
        },
      };
    }
    if (mode === 'property') {
      const d: any = {};
      for (const key of [
        'title',
        'ownerName',
        'cityId',
        'areaName',
        'address',
        'type',
        'purpose',
        'furnishing',
        'finish',
        'description',
      ])
        d[key] = f[key] ?? '';
      for (const key of ['bedrooms', 'bathrooms', 'area', 'floor'])
        d[key] = f[key] === '' || f[key] == null ? null : Number(f[key]);
      Object.assign(d, {
        ownerPhones: ['+20' + String(f.ownerPhone ?? '').trim()],
        photos: String(f.photos ?? '')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        saleMinor: this.amount(f.salePrice),
        rentMinor: this.amount(f.rentPrice),
        depositMinor: this.amount(f.deposit),
        minLeaseMonths: Number(f.minLeaseMonths),
        availableOn: f.availableOn || null,
        verifiedOn: f.verifiedOn || null,
        negotiable: !!f.negotiable,
      });
      for (const key of ['responsibleId', 'duplicateReason']) if (f[key]) d[key] = f[key];
      if (['available', 'withdrawn'].includes(f.status)) d.status = f.status;
      return d;
    }
    if (mode === 'activity')
      return {
        kind: f.kind,
        notes: f.notes,
        outcome: f.outcome || '',
        propertyId: f.propertyId || null,
        scheduledAt: f.scheduledAt || null,
        followUpAt: f.followUpAt || null,
      };
    if (mode === 'book')
      return {
        propertyId: this.target().id,
        propertyVersion: this.target().version,
        clientId: f.clientId,
        purpose: f.purpose,
        notes: f.notes || '',
      };
    if (mode === 'close')
      return {
        action: 'close',
        priceMinor: this.amount(f.price),
        ...(this.target().purpose === 'rent'
          ? { leaseStart: f.leaseStart, leaseEnd: f.leaseEnd }
          : {}),
        contractUrl: f.contractUrl || '',
        notes: f.notes || '',
      };
    if (mode === 'cancel') return { action: 'cancel', reason: f.reason };
    return { action: 'renew', leaseEnd: f.leaseEnd };
  }
  async save() {
    if (this.saving()) return;
    this.error.set('');
    try {
      const data = this.payload(),
        row = this.target(),
        mode = this.mode();
      const path =
        mode === 'client'
          ? 'clients' + (row ? '/' + row.id : '')
          : mode === 'property'
            ? 'properties' + (row ? '/' + row.id : '')
            : mode === 'activity'
              ? 'clients/' + row.id + '/activities'
              : mode === 'book'
                ? 'bookings'
                : 'deals/' + row.id;
      const signature = JSON.stringify([path, data, row?.version]);
      if (signature !== this.signature) {
        this.signature = signature;
        this.requestId = crypto.randomUUID();
      }
      this.saving.set(true);
      await this.api(path, {
        requestId: this.requestId,
        data,
        ...(row && mode !== 'book' ? { version: row.version } : {}),
      });
      this.mode.set(null);
      this.notice.set(this.t('Saved successfully.', 'تم الحفظ بنجاح.'));
      this.matches.set(null);
      await this.load();
      if (this.detail() && ['clients', 'properties'].includes(this.view))
        await this.openDetail(this.detail().id);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async uploadFiles(event: Event, kind: 'photo' | 'contract') {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length || this.saving()) return;
    if (kind === 'photo' && this.lines(this.form.photos).length + files.length > 20) {
      this.error.set(this.t('Up to 20 photos per property.', 'الحد الأقصى ٢٠ صورة للعقار.'));
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      for (const file of files) {
        const form = new FormData();
        form.set('requestId', crypto.randomUUID());
        form.set('kind', kind);
        form.set('file', file);
        if (kind === 'contract') form.set('clientId', this.target().client.id);
        const r = await this.api('media', form);
        const url = this.config.apiUrl + r.path;
        if (kind === 'photo') this.form.photos = [this.form.photos, url].filter(Boolean).join('\n');
        else this.form.contractUrl = url;
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }
  canAct(row: any) {
    return (
      this.canBook() &&
      (this.options().scope === 'company' || row.owner.id === this.auth.user()?.id)
    );
  }
}
