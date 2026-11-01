import { Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CompaniesApi } from '../../../companies-api.service';
import { SubscriptionsApi } from '../../../subscriptions-api.service';
import { AdminUiState } from '../admin-ui-state';

type PlanKey = 'starter' | 'pro' | 'business' | 'enterprise';
type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface PlanInfo {
  key: PlanKey;
  nameEn: string;
  nameAr: string;
  monthlyMinor: number | null;
  annualMinor: number | null;
  users: number | null;
  listings: number | null;
  projects: number | null;
  storageGb: number | null;
}

interface Form {
  nameEn: string;
  nameAr: string;
  slug: string;
  type: string;
  city: string;
  adminEmail: string;
  phone: string;
  website: string;
  plan: PlanKey;
}

const PLAN_KEYS: PlanKey[] = ['starter', 'pro', 'business', 'enterprise'];
const PLAN_NAMES: Record<PlanKey, [string, string]> = {
  starter: ['Starter', 'أساسية'],
  pro: ['Pro', 'احترافية'],
  business: ['Business', 'أعمال'],
  enterprise: ['Enterprise', 'مؤسسات'],
};
const TYPES: Array<[string, string, string]> = [
  ['brokerage', 'Brokerage', 'وساطة عقارية'],
  ['developer', 'Developer', 'مطوّر عقاري'],
  ['property_mgmt', 'Property mgmt', 'إدارة عقارات'],
  ['hybrid', 'Hybrid', 'مختلط'],
];
const CITIES: Array<[string, string]> = [
  ['New Cairo', 'القاهرة الجديدة'],
  ['Sheikh Zayed', 'الشيخ زايد'],
  ['6th of October', 'السادس من أكتوبر'],
  ['New Capital', 'العاصمة الإدارية'],
  ['Heliopolis', 'مصر الجديدة'],
  ['Cairo', 'القاهرة'],
  ['Giza', 'الجيزة'],
  ['Alexandria', 'الإسكندرية'],
  ['North Coast', 'الساحل الشمالي'],
];
/** Design feature list; `need` is the plan rank that includes it. Static until per-company overrides exist at creation. */
const FEATURES: Array<[string, string, string, number]> = [
  ['leads', 'Leads', 'العملاء المحتملون', 0],
  ['pipeline', 'Pipeline', 'مسار الصفقات', 0],
  ['contacts', 'Contacts', 'جهات الاتصال', 0],
  ['projects', 'Projects', 'المشروعات', 0],
  ['units', 'Units', 'الوحدات', 0],
  ['reservations', 'Reservations', 'الحجوزات', 0],
  ['contracts', 'Contracts', 'العقود', 0],
  ['reports', 'Reports', 'التقارير', 0],
  ['commissions', 'Commissions', 'العمولات', 1],
  ['marketing', 'Marketing', 'التسويق', 1],
  ['routing', 'Lead routing', 'توزيع العملاء', 1],
  ['audit', 'Audit log', 'سجل التدقيق', 2],
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

@Component({
  selector: 'app-create-company',
  templateUrl: './create-company.html',
  styleUrls: ['../admin-ui.scss', './create-company.scss'],
})
export class CreateCompany {
  private readonly route=inject(ActivatedRoute);
  readonly draftId=signal<string|null>(null);
  readonly draftVersion=signal(0);
  readonly drafts=signal<any[]>([]);
  readonly quote=signal<any>(null);
  private quoteGeneration=0;
  private readonly api = inject(CompaniesApi);
  private readonly subsApi = inject(SubscriptionsApi);
  private readonly router = inject(Router);
  private readonly ui = inject(AdminUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }

  readonly step = signal<Step>(0);
  readonly tried = signal<Record<number, boolean>>({});
  readonly saving = signal(false);
  readonly error = signal('');
  readonly toast = signal('');
  readonly done = signal<any>(null);
  readonly slugTouched = signal(false);

  /** Fields the API accepts (POST /admin/api/v1/companies). */
  readonly f = signal<Form>({
    nameEn: '',
    nameAr: '',
    slug: '',
    type: 'brokerage',
    city: 'New Cairo',
    adminEmail: '',
    phone: '',
    website: '',
    plan: 'pro',
  });
  /** Design-only fields: shown and kept in the form, never sent (see BACKEND_MISSING.md). */
  readonly x = signal({
    country: 'EG',
    address: '',
    companyEmail: '',
    tax: '',
    cr: '',
    aName: '',
    aPhone: '',
    aTitle: '',
    aLang: 'ar',
    cycle: 'monthly',
    mode: 'paid',
    start: new Date().toISOString().slice(0, 10),
    pay: 'card',
    disc: '0',
    cur: 'EGP',
  });
  readonly limits = signal<Record<string, number | null>>({});
  readonly feats = signal<Record<string, boolean>>({});

  readonly plans = signal<PlanInfo[]>(
    PLAN_KEYS.map((key) => ({
      key,
      nameEn: PLAN_NAMES[key][0],
      nameAr: PLAN_NAMES[key][1],
      monthlyMinor: null,
      annualMinor:null,
      users: null,
      listings: null,
      projects: null,
      storageGb: null,
    })),
  );

  readonly types = TYPES;
  readonly cities = CITIES;
  readonly features = FEATURES;

  constructor() {
    void this.loadPlans();
    void this.loadDrafts();
    const id=this.route.snapshot.queryParamMap.get('draft');if(id)void this.resumeDraft(id);
  }
  private async loadPlans() {
    for (const options of [false, true]) {
      try {
        const data: any[] = await this.subsApi.plans(options);
        const rows = (Array.isArray(data) ? data : ((data as any)?.items ?? [])).filter(
          (p: any) => PLAN_KEYS.includes(p.key) && !p.archived,
        );
        if (!rows.length) continue;
        this.plans.set(
          PLAN_KEYS.map((key) => {
            const p = rows.find((r: any) => r.key === key) ?? {};
            return {
              key,
              nameEn: p.nameEn ?? PLAN_NAMES[key][0],
              nameAr: p.nameAr ?? PLAN_NAMES[key][1],
              annualMinor: typeof p.annualMinor==='number'?p.annualMinor:null,
              monthlyMinor: typeof p.monthlyMinor === 'number' ? p.monthlyMinor : null,
              users: p.users ?? null,
              listings: p.listings ?? null,
              projects: p.projects ?? null,
              storageGb: p.storageGb ?? null,
            };
          }),
        );
        this.resetLimits();
        await this.refreshQuote();
        return;
      } catch {}
    }
  }

  readonly steps = computed(() => [
    [this.t('Company', 'الشركة'), this.t('Name, type, contact', 'الاسم والنوع والتواصل')],
    [this.t('Administrator', 'المدير'), this.t('First admin & invite', 'أول مدير ودعوته')],
    [this.t('Subscription', 'الاشتراك'), this.t('Plan, cycle, billing', 'الباقة والفوترة')],
    [this.t('Limits', 'الحدود'), this.t('Resource limits', 'حدود الموارد')],
    [this.t('Features', 'الميزات'), this.t('Modules & add-ons', 'الوحدات والإضافات')],
    [this.t('Review', 'المراجعة'), this.t('Confirm & create', 'التأكيد والإنشاء')],
  ]);

  set<K extends keyof Form>(k: K, v: Form[K]) {
    this.f.update((f) => {
      const next = { ...f, [k]: v };
      if (k === 'nameEn' && !this.slugTouched()) next.slug = slugify(String(v));
      return next;
    });
    if (k === 'plan') {this.resetLimits();void this.refreshQuote();}
  }
  setSlug(v: string) {
    this.slugTouched.set(true);
    this.f.update((f) => ({ ...f, slug: v.toLowerCase() }));
  }
  setX(k: string, v: string) {
    this.x.update((x) => ({ ...x, [k]: v }));
    if(k==='cycle')void this.refreshQuote();
  }

  readonly errs = computed(() => {
    const f = this.f(),
      t = (en: string, ar: string) => this.t(en, ar);
    const req = t('Required', 'مطلوب');
    return [
      {
        nameEn: f.nameEn.trim().length < 2 ? req : '',
        nameAr: f.nameAr.trim().length < 2 ? req : '',
        slug:
          !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug) || f.slug.length < 2
            ? t('Lowercase letters, numbers and hyphens', 'حروف إنجليزية صغيرة وأرقام وشرطات')
            : '',
        city: !f.city.trim() ? req : '',
        phone:
          f.phone.replace(/\D/g, '').length < 8
            ? t('Enter a valid phone number', 'أدخل رقمًا صحيحًا')
            : '',
        website:
          f.website && !/^(https?:\/\/[^\s]+|[^\s:/]+\.[^\s/]+)$/.test(f.website)
            ? t('Enter a valid website', 'أدخل موقعًا صحيحًا')
            : '',
      },
      {
        adminEmail: !EMAIL.test(f.adminEmail.trim())
          ? t('Enter a valid email', 'أدخل بريدًا صحيحًا')
          : '',
      },
      {},
      {},
      {},
      {},
    ] as Array<Record<string, string>>;
  });
  err(step: number, k: string) {
    return this.tried()[step] ? (this.errs()[step][k] ?? '') : '';
  }
  private stepBad(i: number) {
    return Object.values(this.errs()[i]).some(Boolean);
  }
  readonly hasErrs = computed(() => this.tried()[this.step()] && this.stepBad(this.step()));

  go(i: number) {
    // Allow jumping back freely; forward only past valid steps.
    for (let j = 0; j < i; j++)
      if (this.stepBad(j)) {
        this.step.set(j as Step);
        this.tried.update((t) => ({ ...t, [j]: true }));
        return;
      }
    this.step.set(i as Step);
  }
  back() {
    if (this.step() > 0) this.step.set((this.step() - 1) as Step);
  }
  async next() {
    const s = this.step();
    if (this.stepBad(s)) {
      this.tried.update((t) => ({ ...t, [s]: true }));
      return;
    }
    if (s < 5) {
      this.step.set((s + 1) as Step);
      return;
    }
    await this.create();
  }
  cancel() {
    void this.router.navigateByUrl('/admin/onboarding');
  }
  private payload(){const f=this.f(),x=this.x();return {...f,country:x.country,address:x.address,companyEmail:x.companyEmail||undefined,taxNumber:x.tax,crNumber:x.cr,cycle:x.cycle,paymentMethod:['card','bank','instapay'].includes(x.pay)?x.pay:'bank',owner:x.aName.trim()?{name:x.aName.trim(),phone:x.aPhone,title:x.aTitle,lang:x.aLang}:undefined};}
  async loadDrafts(){try{this.drafts.set((await this.api.drafts()).items);}catch{}}
  async resumeDraft(id:string){try{const d=await this.api.draft(id),p=d.payload;this.draftId.set(d.id);this.draftVersion.set(d.version);this.f.update(f=>({...f,...Object.fromEntries(Object.keys(f).filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))}));this.x.update(x=>({...x,country:p.country??x.country,address:p.address??'',companyEmail:p.companyEmail??'',tax:p.taxNumber??'',cr:p.crNumber??'',cycle:p.cycle??'monthly',pay:p.paymentMethod??'bank',aName:p.owner?.name??'',aPhone:p.owner?.phone??'',aTitle:p.owner?.title??'',aLang:p.owner?.lang??'ar'}));this.slugTouched.set(true);await this.refreshQuote();}catch(e){this.error.set((e as Error).message);}}
  async saveDraft(){if(this.saving())return;this.saving.set(true);this.error.set('');try{const payload=Object.fromEntries(Object.entries(this.payload()).filter(([,v])=>v!==''&&v!==undefined));const d=await this.api.saveDraft({...payload,...(this.draftId()?{version:this.draftVersion()}:{})},this.draftId()??undefined);this.draftId.set(d.id);this.draftVersion.set(d.version);this.toast.set(this.t('Draft saved. No owner or subscription created.','تم حفظ المسودة دون إنشاء حساب أو اشتراك.'));await this.router.navigate([], {relativeTo:this.route,queryParams:{draft:d.id},replaceUrl:true});await this.loadDrafts();}catch(e){this.error.set((e as Error).message);}finally{this.saving.set(false);}}
  async refreshQuote(){const generation=++this.quoteGeneration;this.quote.set(null);try{const q=await this.api.quote({plan:this.f().plan,cycle:this.x().cycle});if(generation===this.quoteGeneration)this.quote.set(q);}catch(e){if(generation===this.quoteGeneration)this.error.set((e as Error).message);}}

  private async create() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const f = this.f();
    try {
      await this.refreshQuote();
      if(!this.quote())throw Error('Refresh the plan quote before creating the company');
      const created = await this.api.create({...this.payload(),planVersionId:this.quote().planVersionId,...(this.draftId()?{draftId:this.draftId(),draftVersion:this.draftVersion()}:{})});
      this.done.set(created);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  viewCompany() {
    const id = this.done()?.id;
    void this.router.navigateByUrl(
      '/admin/companies' + (id ? '?company=' + encodeURIComponent(id) : ''),
    );
  }
  another() {
    this.done.set(null);
    this.draftId.set(null);this.draftVersion.set(0);
    this.step.set(0);
    this.tried.set({});
    this.slugTouched.set(false);
    this.f.set({
      ...this.f(),
      nameEn: '',
      nameAr: '',
      slug: '',
      adminEmail: '',
      phone: '',
      website: '',
    });
  }

  // ---- plan / pricing ----
  readonly plan = computed(() => this.plans().find((p) => p.key === this.f().plan)!);
  planName(p: PlanInfo) {
    return this.ar() ? p.nameAr : p.nameEn;
  }
  money(minor: number | null) {
    return minor === null ? '—' : 'EGP ' + Math.round(minor / 100).toLocaleString('en-US');
  }
  planDesc(p: PlanInfo) {
    const u =
      p.users === null
        ? this.t('Unlimited users', 'مستخدمون بلا حد')
        : p.users + ' ' + this.t('users', 'مستخدم');
    const l =
      p.listings === null
        ? this.t('unlimited listings', 'وحدات بلا حد')
        : p.listings.toLocaleString('en-US') + ' ' + this.t('listings', 'وحدة');
    return u + ' · ' + l;
  }
  readonly summary=computed(()=>{const q=this.quote();return q?{base:Number(q.baseMinor),disc:Number(q.discountMinor),vat:Number(q.taxMinor),taxRate:q.taxBps/100,total:Number(q.totalMinor)}:null;});

  // ---- limits (static overrides on top of real plan defaults) ----
  readonly limitRows = computed(() => {
    const p = this.plan();
    const rows: Array<[string, string, number | null, string]> = [
      ['users', this.t('Users', 'المستخدمون'), p.users, ''],
      ['listings', this.t('Listings', 'الوحدات'), p.listings, ''],
      ['projects', this.t('Projects', 'المشروعات'), p.projects, ''],
      ['storage', this.t('Document storage', 'تخزين المستندات'), p.storageGb, 'GB'],
    ];
    return rows.map(([k, label, def, unit]) => {
      const v = k in this.limits() ? this.limits()[k] : def;
      return {
        k,
        label,
        unit,
        v,
        defVal: def,
        def:
          this.t('Plan default: ', 'افتراضي الباقة: ') +
          (def === null
            ? this.t('Unlimited', 'بلا حد')
            : def.toLocaleString('en-US') + (unit ? ' ' + unit : '')),
        over: v !== def,
      };
    });
  });
  resetLimits() {
    this.limits.set({});
  }
  setLimit(k: string, v: string) {
    const n = Number(v);
    this.limits.update((l) => ({ ...l, [k]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  }
  toggleUnlimited(k: string, current: number | null, def: number | null) {
    this.limits.update((l) => ({ ...l, [k]: current === null ? (def ?? 10) : null }));
  }

  // ---- features (static) ----
  private rank() {
    return PLAN_KEYS.indexOf(this.f().plan);
  }
  featOn(k: string, need: number) {
    return this.feats()[k] ?? this.rank() >= need;
  }
  featSub(need: number, on: boolean) {
    const inc = this.rank() >= need;
    const pn = this.planName(this.plan());
    if (on !== inc)
      return on
        ? this.t('Override · not in ', 'استثناء · غير مضمن في ') + pn
        : this.t('Disabled for this company', 'معطلة لهذه الشركة');
    return inc
      ? this.t('Included in ', 'مضمنة في ') + pn
      : this.t('Requires ', 'تتطلب ') + this.planName(this.plans()[need]);
  }
  toggleFeat(k: string, need: number) {
    const on = this.featOn(k, need);
    this.feats.update((f) => ({ ...f, [k]: !on }));
  }
  readonly featCount = computed(() => FEATURES.filter(([k, , , n]) => this.featOn(k, n)).length);

  typeName(k: string) {
    const t = TYPES.find((x) => x[0] === k);
    return t ? (this.ar() ? t[2] : t[1]) : k;
  }
  cityName(k: string) {
    const c = CITIES.find((x) => x[0] === k);
    return c ? (this.ar() ? c[1] : c[0]) : k;
  }
}
