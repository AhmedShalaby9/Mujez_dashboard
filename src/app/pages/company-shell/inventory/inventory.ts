import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CompanyUiState } from '../company-ui-state';
import { InvScene, type Scene } from './inv-scene';
import { InventoryState, type AlertPrefs } from './inventory-state';
import {
  AGENTS,
  COS,
  DEVS,
  FIN,
  IC,
  PAL,
  STATUS,
  UNITS,
  UTYPES,
  type Unit,
  type Compound,
  type CoKind,
  type CoStatus,
} from './inventory-data';

type View = 'devs' | 'dev' | 'cos' | 'co' | 'units' | 'unit';
type DevFilter = 'all' | 'top' | 'ver';

/**
 * Inventory section: Developers, Compounds and Units (list + detail). Everything here is
 * static demo data from inventory-data.ts — there are no API calls.
 */
@Component({
  selector: 'app-inventory',
  imports: [InvScene, NgTemplateOutlet],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ui = inject(CompanyUiState);
  readonly state = inject(InventoryState);

  readonly IC = IC;
  readonly DEVS = DEVS;
  readonly COS = COS;
  readonly STATUS = STATUS;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly view = (this.route.snapshot.data['view'] as View) ?? 'cos';
  /** index of the developer / compound being viewed (detail pages) */
  readonly idx = computed(() => {
    const n = Number(this.params().get('id'));
    return Number.isInteger(n) && n >= 0 ? n : -1;
  });
  readonly notFound = computed(() =>
    this.view === 'dev'
      ? !DEVS[this.idx()]
      : this.view === 'co'
        ? !COS[this.idx()]
        : this.view === 'unit'
          ? !UNITS[this.idx()]
          : false,
  );

  readonly ar = computed(() => this.ui.lang() === 'ar');
  readonly L = computed(() => (this.ar() ? 1 : 0));
  readonly dir = computed(() => (this.ar() ? 'rtl' : 'ltr'));
  readonly flip = computed(() => (this.ar() ? 'scaleX(-1)' : 'none'));

  // list state
  readonly q = signal('');
  readonly devF = signal<DevFilter>('all');
  readonly sort = signal<'fol' | 'cos' | 'az'>('fol');
  readonly stF = signal<'all' | CoStatus>('all');
  readonly devSel = signal('all');
  // units list filters (the compound page links here with ?co=<index>)
  readonly uc = signal(this.route.snapshot.queryParamMap?.get('co') ?? 'all');
  readonly ut = signal('all');
  readonly ul = signal<'all' | 'primary' | 'resale' | 'ready' | 'offer' | 'launch'>('all');
  readonly ub = signal('any');
  readonly us = signal<'new' | 'plo' | 'phi' | 'ppm' | 'size'>('new');
  // unit detail
  readonly pl = signal(0);
  readonly mt = signal<'photos' | 'plan' | 'video'>('photos');
  // detail state
  readonly cl = signal<'en' | 'ar' | null>(null);
  readonly gal = signal(0);
  readonly faq = signal(0);
  readonly alOpen = signal(false);
  readonly toastMsg = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnDestroy() {
    clearTimeout(this.toastTimer);
  }

  /** English / Arabic picker */
  X(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  /** content language (detail pages can show the description in either language) */
  get CL() {
    return (this.cl() ?? (this.ar() ? 'ar' : 'en')) === 'ar' ? 1 : 0;
  }
  Y(en: string, ar: string) {
    return this.CL ? ar : en;
  }
  toast(m: string) {
    clearTimeout(this.toastTimer);
    this.toastMsg.set(m);
    this.toastTimer = setTimeout(() => this.toastMsg.set(''), 2400);
  }
  num(n: number) {
    return n.toLocaleString('en-US');
  }
  fmtK(n: number) {
    return n >= 1000
      ? (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + (this.ar() ? ' ألف' : 'K')
      : String(n);
  }
  egpM(v: number | string) {
    return this.ar() ? `${v} مليون ج.م` : `EGP ${v}M`;
  }
  inits(s: string) {
    return s
      .replace(/&/g, '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  scene(pi: number, v: number, kind: CoKind, id: string): Scene {
    const P = PAL[pi % PAL.length];
    return {
      gid: 'ivg' + id,
      s1: P[0],
      s2: P[1],
      sun: P[2],
      far: P[3],
      near: P[4],
      sea: P[5],
      accent: P[6],
      grd: kind === 'coast' ? '#EAD9B2' : kind === 'com' ? '#C9CDD3' : P[5],
      urb: kind === 'res' ? 1 : 0,
      cst: kind === 'coast' ? 1 : 0,
      com: kind === 'com' ? 1 : 0,
      sx: [300, 90, 230, 330, 150][v % 5],
      tf: 'translate(' + [0, -46, 34, -22, 56][v % 5] + ' 0)',
    };
  }
  stLbl(s: CoStatus) {
    return { t: STATUS[s][0][this.L()], bg: STATUS[s][1], fg: STATUS[s][2] };
  }

  // ---------------------------------------------------------------- navigation
  go(path: string, id?: number) {
    this.alOpen.set(false);
    void this.router.navigate(id === undefined ? ['/company', path] : ['/company', path, id]);
    try {
      document.querySelector('.iv-root')?.scrollIntoView({ block: 'start' });
    } catch {
      /* ignore */
    }
  }
  openDev(i: number) {
    this.go('developers', i);
  }
  openCo(i: number) {
    this.go('compounds', i);
  }
  openUnit(i: number) {
    this.go('units', i);
  }
  viewAllUnits(ci: number) {
    void this.router.navigate(['/company/units'], { queryParams: { co: ci } });
  }

  readonly crumbs = computed(() => {
    const L = this.L();
    const root =
      this.view === 'dev' || this.view === 'devs'
        ? { label: this.X('Developers', 'المطوّرون'), go: () => this.go('developers') }
        : this.view === 'unit' || this.view === 'units'
          ? { label: this.X('Units', 'الوحدات'), go: () => this.go('units') }
          : { label: this.X('Compounds', 'الكمباوندات'), go: () => this.go('compounds') };
    if (this.view === 'devs' || this.view === 'cos' || this.view === 'units' || this.notFound())
      return [];
    const i = this.idx();
    const name =
      this.view === 'dev'
        ? DEVS[i].n[L]
        : this.view === 'unit'
          ? UTYPES[UNITS[i].t][L] + ' · ' + UNITS[i].size + this.X(' m²', ' م²')
          : COS[i].n[L];
    return [root, { label: name, go: () => undefined }];
  });

  // ---------------------------------------------------------------- follow
  devFol(i: number) {
    return DEVS[i].fol + (this.state.followed()['d' + i] ? 1 : 0);
  }
  coFol(i: number) {
    return COS[i].fol + (this.state.followed()['c' + i] ? 1 : 0);
  }
  coCount(i: number) {
    return COS.filter((c) => c.d === i).length;
  }
  toggleFol(key: string, name: string, ev?: Event) {
    ev?.stopPropagation();
    const on = this.state.toggleFollow(key);
    this.toast(
      on
        ? this.X(`Following ${name} · you’ll get updates`, `تتابع ${name} · ستصلك التحديثات`)
        : this.X(`Unfollowed ${name}`, `تم إلغاء متابعة ${name}`),
    );
  }
  isFol(key: string) {
    return !!this.state.followed()[key];
  }

  // ---------------------------------------------------------------- developers list
  readonly l = computed(() => {
    const X = (e: string, a: string) => this.X(e, a);
    return {
      devs: X('Developers', 'المطوّرون'),
      cos: X('Compounds', 'الكمباوندات'),
      compounds: X('Compounds', 'كمباوندات'),
      followers: X('Followers', 'متابع'),
      delivered: X('Units delivered', 'وحدات مسلّمة'),
      founded: X('Founded', 'التأسيس'),
      top: X('Top developer', 'مطوّر مميز'),
      ver: X('Verified', 'موثّق'),
      search: X('Search…', 'بحث…'),
      about: X('About', 'نبذة'),
      trust: X('Why buyers trust them', 'لماذا يثق بهم المشترون'),
      contact: X('Contact', 'التواصل'),
      social: X('Social', 'التواصل الاجتماعي'),
      theirCos: X('Compounds by this developer', 'كمباوندات هذا المطوّر'),
      overview: X('Overview', 'نظرة عامة'),
      location: X('Location', 'الموقع'),
      payment: X('Payment plans', 'خطط السداد'),
      phases: X('Phases', 'المراحل'),
      types: X('Unit types', 'أنواع الوحدات'),
      facilities: X('Facilities & amenities', 'المرافق والخدمات'),
      faqs: X('FAQs', 'الأسئلة الشائعة'),
      news: X('Latest update', 'آخر الأخبار'),
      brochure: X('Brochure', 'الكتيّب'),
      totalU: X('Total units', 'إجمالي الوحدات'),
      primU: X('Developer units', 'وحدات المطوّر'),
      resU: X('Resale units', 'وحدات إعادة بيع'),
      startP: X('Starting price', 'يبدأ من'),
      delivery: X('Delivery', 'الاستلام'),
      finishing: X('Finishing', 'التشطيب'),
      masterplan: X('Master plan', 'المخطط العام'),
      openMap: X('Open in Maps', 'فتح في الخرائط'),
      stack: X('Stacking plan', 'خريطة الوحدات'),
      contentL: X('Content', 'المحتوى'),
      alertsT: X('Alerts for this compound', 'تنبيهات هذا الكمباوند'),
      mute: X('Mute all alerts', 'كتم كل التنبيهات'),
      share: X('Share', 'مشاركة'),
      avail: X('available', 'متاحة'),
      units: X('units', 'وحدة'),
      price: X('Price', 'السعر'),
      size: X('Size', 'المساحة'),
      ends: X('Ends', 'ينتهي'),
      sold: X('Sold', 'مباع'),
      next: X('Next phase', 'المرحلة القادمة'),
      unitsT: X('Units', 'الوحدات'),
    };
  });

  devCard(d: (typeof DEVS)[number], i: number) {
    const L = this.L();
    const on = this.isFol('d' + i);
    return {
      i,
      name: d.n[L],
      name2: d.n[1 - L],
      init: this.inits(d.n[0]),
      c: d.c,
      top: !!d.top,
      ver: !!d.ver,
      cos: String(this.coCount(i)),
      fol: this.fmtK(this.devFol(i)),
      del: d.del ? this.num(d.del) + '+' : '—',
      sinceT: this.X('Since ' + d.yr, 'منذ ' + d.yr),
      fBg: on ? '#fff' : '#111113',
      fFg: on ? '#111113' : '#fff',
      fBd: on ? '#E2E2DC' : '#111113',
      fLbl: on ? this.X('Following', 'تتابعه') : this.X('+ Follow', '+ متابعة'),
    };
  }

  readonly devChips = computed(() =>
    (
      [
        ['all', this.X('All', 'الكل'), DEVS.length],
        ['top', this.X('Top developers', 'المطوّرون المميزون'), DEVS.filter((d) => d.top).length],
        ['ver', this.X('Verified', 'موثّقون'), DEVS.filter((d) => d.ver).length],
      ] as [DevFilter, string, number][]
    ).map(([k, label, n]) => ({
      k,
      label: label + ' · ' + n,
      bg: this.devF() === k ? '#111113' : '#fff',
      fg: this.devF() === k ? '#fff' : '#111113',
      bd: this.devF() === k ? '#111113' : '#E2E2DC',
    })),
  );
  readonly sorts = computed(() => [
    { v: 'fol', l: this.X('Most followed', 'الأكثر متابعة') },
    { v: 'cos', l: this.X('Most compounds', 'الأكثر كمباوندات') },
    { v: 'az', l: this.X('Name A–Z', 'الاسم أ–ي') },
  ]);
  readonly devMeta = computed(() =>
    this.X(
      `${DEVS.length} developers · ${COS.length} compounds`,
      `${DEVS.length} مطوّرين · ${COS.length} كمباوند`,
    ),
  );
  readonly devList = computed(() => {
    this.state.followed();
    const ql = this.q().trim().toLowerCase(),
      f = this.devF(),
      L = this.L();
    const list = DEVS.map((d, i) => ({ d, i })).filter(
      ({ d }) =>
        (f === 'all' || (f === 'top' ? d.top : d.ver)) &&
        (!ql || (d.n[0] + ' ' + d.n[1]).toLowerCase().includes(ql)),
    );
    const s = this.sort();
    list.sort((a, b) =>
      s === 'az'
        ? a.d.n[L].localeCompare(b.d.n[L])
        : s === 'cos'
          ? this.coCount(b.i) - this.coCount(a.i)
          : this.devFol(b.i) - this.devFol(a.i),
    );
    return list.map(({ d, i }) => this.devCard(d, i));
  });

  // ---------------------------------------------------------------- developer profile
  readonly dv = computed(() => {
    if (this.view !== 'dev' || this.notFound()) return null;
    this.state.followed();
    const i = this.idx(),
      d = DEVS[i],
      CL = this.CL;
    const card = this.devCard(d, i);
    return {
      ...card,
      cover: this.scene(i, 3, 'com', 'dc' + i),
      bio: d.bio[CL],
      bioDir: CL ? 'rtl' : 'ltr',
      hasStock: !!d.stock,
      stock: d.stock ? d.stock[this.L()] : '',
      yr: String(d.yr),
      delBig: d.del
        ? this.X(`${this.num(d.del)}+ units delivered`, `أكثر من ${this.num(d.del)} وحدة مسلّمة`)
        : this.X('First delivery planned for 2027', 'أول تسليم مخطط في 2027'),
      delSub: d.del
        ? this.X('Trust signal · verified by Mujez', 'مؤشر ثقة · تحقق منه موجز')
        : this.X('No delivered units yet', 'لا توجد وحدات مسلّمة بعد'),
      folN: this.num(this.devFol(i)),
      hasTrust: !!d.ver && d.trust.length > 0,
      trust: d.trust.map((t) => t[this.L()]),
      contacts: (
        [
          ['phone', d.ph, 'ltr'],
          ['mail', d.em, 'ltr'],
          ['web', d.web, 'ltr'],
          ['office', d.hq[CL], CL ? 'rtl' : 'ltr'],
        ] as [string, string, string][]
      ).map(([ic, v, dir]) => ({ ic: IC[ic], v, dir })),
      socials: d.so.map((k) => ({
        ic: IC[k],
        label: (
          { fb: 'Facebook', ig: 'Instagram', x: 'X', li: 'LinkedIn' } as Record<string, string>
        )[k],
      })),
      cos: String(this.coCount(i)),
      unitsN: this.num(UNITS.filter((u) => COS[u.c].d === i).length),
      unitsL: this.X('Units listed', 'وحدات معروضة'),
      devCos: COS.map((c, ci) => ({ c, ci }))
        .filter((x) => x.c.d === i)
        .map(({ c, ci }) => this.coCard(c, ci, 2, 'dm')),
    };
  });
  readonly clSeg = computed(() =>
    (['en', 'ar'] as const).map((k) => {
      const on = (this.cl() ?? (this.ar() ? 'ar' : 'en')) === k;
      return {
        k,
        label: k === 'en' ? 'English' : 'العربية',
        bg: on ? '#fff' : 'transparent',
        fg: on ? '#111113' : '#6E6E73',
        fw: on ? 600 : 400,
      };
    }),
  );
  copy(v: string) {
    this.toast(this.X('Copied: ', 'تم النسخ: ') + v);
  }
  openSocial(label: string) {
    this.toast(this.X('Opening ', 'جارٍ فتح ') + label + '…');
  }

  // ---------------------------------------------------------------- compounds list
  priceLine(c: Compound) {
    return c.st === 'soon'
      ? this.X('Expected from ', 'متوقع من ') + this.egpM(c.from)
      : this.X('From ', 'يبدأ من ') + this.egpM(c.from);
  }
  availLine(c: Compound) {
    return c.st === 'sold'
      ? this.X('Sold out', 'نفدت الوحدات')
      : c.st === 'soon'
        ? this.X(`${this.num(c.tot)} units · opening soon`, `${this.num(c.tot)} وحدة · قريبًا`)
        : this.X(`${c.av} units available`, `${c.av} وحدة متاحة`);
  }
  coCard(c: Compound, i: number, v = 0, idPrefix = 'c') {
    const L = this.L(),
      dv = DEVS[c.d],
      s = this.stLbl(c.st),
      faved = this.isFol('c' + i);
    return {
      i,
      name: c.n[L],
      name2: c.n[1 - L],
      dev: dv.n[L],
      devInit: this.inits(dv.n[0]),
      devC: dv.c,
      area: c.a[L],
      st: s.t,
      stBg: s.bg,
      stFg: s.fg,
      from: this.priceLine(c),
      avail: this.availLine(c),
      avC: c.st === 'sold' ? '#8A8A90' : '#2F4A0A',
      fol: this.fmtK(this.coFol(i)),
      faved,
      hBg: faved ? '#C8F169' : 'rgba(17,17,19,0.62)',
      hFg: faved ? '#111113' : '#fff',
      sc: this.scene(c.p, v, c.k, idPrefix + i),
      ver: !!dv.ver,
      units: this.X(`${this.num(c.tot)} units`, `${this.num(c.tot)} وحدة`),
    };
  }
  readonly stChips = computed(() =>
    (
      [
        ['all', this.X('All', 'الكل'), COS.length],
        ...(Object.keys(STATUS) as CoStatus[]).map((k) => [
          k,
          STATUS[k][0][this.L()],
          COS.filter((c) => c.st === k).length,
        ]),
      ] as [string, string, number][]
    ).map(([k, l, n]) => ({
      k: k as 'all' | CoStatus,
      label: l + ' · ' + n,
      bg: this.stF() === k ? '#111113' : '#fff',
      fg: this.stF() === k ? '#fff' : '#111113',
      bd: this.stF() === k ? '#111113' : '#E2E2DC',
      dot: k === 'all' ? 'transparent' : STATUS[k as CoStatus][1],
    })),
  );
  readonly devOpts = computed(() => [
    { v: 'all', l: this.X('All developers', 'كل المطوّرين') },
    ...DEVS.map((d, i) => ({ v: String(i), l: d.n[this.L()] })),
  ]);
  readonly coMeta = computed(() => {
    const av = this.num(COS.reduce((a, c) => a + c.av, 0));
    return this.X(
      `${COS.length} compounds · ${av} units available · ${DEVS.length} developers`,
      `${COS.length} كمباوند · ${av} وحدة متاحة · ${DEVS.length} مطوّرين`,
    );
  });
  readonly coList = computed(() => {
    this.state.followed();
    const ql = this.q().trim().toLowerCase(),
      sf = this.stF(),
      ds = this.devSel();
    return COS.map((c, i) => ({ c, i }))
      .filter(
        ({ c }) =>
          (sf === 'all' || c.st === sf) &&
          (ds === 'all' || String(c.d) === ds) &&
          (!ql || (c.n[0] + ' ' + c.n[1] + ' ' + c.a[0] + ' ' + c.a[1]).toLowerCase().includes(ql)),
      )
      .map(({ c, i }) => this.coCard(c, i));
  });

  // ---------------------------------------------------------------- compound detail
  readonly co = computed(() => {
    if (this.view !== 'co' || this.notFound()) return null;
    this.state.followed();
    this.state.muted();
    this.state.alerts();
    const X = (e: string, a: string) => this.X(e, a),
      Y = (e: string, a: string) => this.Y(e, a);
    const L = this.L(),
      CL = this.CL,
      ar = this.ar();
    const i = this.idx(),
      c = COS[i],
      dv = DEVS[c.d],
      card = this.coCard(c, i),
      delivered = !!c.since;
    const num = (n: number) => this.num(n),
      egpM = (v: number | string) => this.egpM(v);

    const GL: Record<CoKind, Bi2[]> = {
      coast: [
        ['Beachfront', 'الشاطئ'],
        ['Crystal lagoon', 'البحيرات الكريستالية'],
        ['Clubhouse', 'النادي'],
        ['Typical chalet', 'شاليه نموذجي'],
        ['Aerial view', 'منظر جوي'],
      ],
      res: [
        ['Main gate', 'البوابة الرئيسية'],
        ['Central park', 'الحديقة المركزية'],
        ['Clubhouse', 'النادي'],
        ['Typical villa', 'فيلا نموذجية'],
        ['Aerial view', 'منظر جوي'],
      ],
      com: [
        ['Tower exterior', 'واجهة البرج'],
        ['Lobby', 'البهو'],
        ['Office floor', 'دور مكاتب'],
        ['Retail promenade', 'ممشى المحلات'],
        ['Aerial view', 'منظر جوي'],
      ],
    };
    const gal = GL[c.k].map((g, k) => ({
      label: g[L],
      sc: this.scene((c.p + k) % PAL.length, k, c.k, 'g' + i + '-' + k),
      on: this.gal() === k,
      bd: this.gal() === k ? '#111113' : 'transparent',
    }));
    const galIdx = Math.min(this.gal(), gal.length - 1);

    const descs: Record<CoKind, Bi2> = {
      coast: [
        `${c.n[0]} is a ${c.ac}-acre beach community by ${dv.n[0]} in ${c.a[0]}. Chalets, twin houses and villas sit around crystal lagoons, with a private beach, a marina and a clubhouse.`,
        `${c.n[1]} مجتمع ساحلي على مساحة ${c.ac} فدان من ${dv.n[1]} في ${c.a[1]}. شاليهات وتوين هاوس وفيلات حول بحيرات كريستالية، مع شاطئ خاص ومارينا ونادٍ.`,
      ],
      res: [
        `${c.n[0]} is a ${c.ac}-acre gated compound by ${dv.n[0]} in ${c.a[0]}, built around a central park with a school, a clubhouse and daily retail inside the gates.`,
        `${c.n[1]} كمباوند مسوّر على مساحة ${c.ac} فدان من ${dv.n[1]} في ${c.a[1]}، حول حديقة مركزية مع مدرسة ونادٍ ومحلات يومية داخل الأسوار.`,
      ],
      com: [
        `${c.n[0]} is a business district by ${dv.n[0]} in ${c.a[0]}, with grade-A offices, medical clinics and retail along a landscaped promenade.`,
        `${c.n[1]} منطقة أعمال من ${dv.n[1]} في ${c.a[1]}، بمكاتب فئة أولى وعيادات ومحلات على ممشى منسّق.`,
      ],
    };
    const HL: Record<CoKind, Bi2[]> = {
      coast: [
        [`${c.ac} acres`, `${c.ac} فدان`],
        ['1.2 km beachfront', 'شاطئ بطول 1.2 كم'],
        ['60% green & water', '60% مساحات خضراء ومياه'],
        ['Private marina', 'مارينا خاصة'],
      ],
      res: [
        [`${c.ac} acres`, `${c.ac} فدان`],
        ['80% green spaces', '80% مساحات خضراء'],
        ['International school', 'مدرسة دولية'],
        ['3 km jogging track', 'مسار جري 3 كم'],
      ],
      com: [
        [`${c.ac} acres`, `${c.ac} فدان`],
        ['LEED-ready towers', 'أبراج صديقة للبيئة'],
        ['2,400 parking spaces', '2,400 موقف سيارات'],
        ['Monorail station nearby', 'محطة مونوريل قريبة'],
      ],
    };
    const FAC: Record<CoKind, [string, string, string][]> = {
      coast: [
        ['wave', 'Private beach', 'شاطئ خاص'],
        ['pool', 'Crystal lagoons', 'بحيرات كريستالية'],
        ['boat', 'Marina', 'مارينا'],
        ['club', 'Clubhouse', 'نادٍ اجتماعي'],
        ['gym', 'Gym & spa', 'جيم وسبا'],
        ['kids', 'Kids area', 'منطقة أطفال'],
        ['shop', 'Commercial strip', 'منطقة تجارية'],
        ['lock', '24/7 security', 'أمن 24 ساعة'],
      ],
      res: [
        ['tree', 'Central park', 'حديقة مركزية'],
        ['club', 'Clubhouse', 'نادٍ اجتماعي'],
        ['pool', 'Swimming pools', 'حمامات سباحة'],
        ['gym', 'Gym', 'جيم'],
        ['kids', 'Kids area', 'منطقة أطفال'],
        ['run', 'Jogging track', 'مسار جري'],
        ['mosque', 'Mosque', 'مسجد'],
        ['shop', 'Retail & cafés', 'محلات وكافيهات'],
        ['med', 'Medical center', 'مركز طبي'],
        ['lock', 'Gated & 24/7 security', 'أسوار وأمن 24 ساعة'],
      ],
      com: [
        ['office', 'Grade-A offices', 'مكاتب فئة أولى'],
        ['shop', 'Retail promenade', 'ممشى تجاري'],
        ['med', 'Medical clinics', 'عيادات طبية'],
        ['car', 'Underground parking', 'جراج تحت الأرض'],
        ['lock', 'Smart access control', 'تحكم ذكي في الدخول'],
        ['gym', 'Business club & gym', 'نادي أعمال وجيم'],
      ],
    };
    const TY: Record<CoKind, [string, string, number, number, number, number][]> = {
      coast: [
        ['Chalet', 'شاليه', 95, 140, 1, 0.55],
        ['Twin house', 'توين هاوس', 210, 260, 1.9, 0.25],
        ['Standalone villa', 'فيلا مستقلة', 280, 420, 3.1, 0.2],
      ],
      res: [
        ['Apartment', 'شقة', 110, 210, 1, 0.6],
        ['Duplex', 'دوبلكس', 220, 310, 1.7, 0.15],
        ['Townhouse', 'تاون هاوس', 240, 300, 2.2, 0.15],
        ['Standalone villa', 'فيلا مستقلة', 320, 480, 3.4, 0.1],
      ],
      com: [
        ['Office', 'مكتب', 60, 240, 1, 0.6],
        ['Retail', 'محل تجاري', 40, 180, 1.3, 0.25],
        ['Clinic', 'عيادة', 45, 90, 0.9, 0.15],
      ],
    };
    const types = TY[c.k].map(([e, a, s1, s2, m, share]) => ({
      t: ar ? a : e,
      size: `${s1}–${s2} ${X('m²', 'م²')}`,
      n: num(Math.round(c.tot * share)),
      price: X('From ', 'من ') + egpM((c.from * m).toFixed(1)),
      w: Math.round(share * 100) + '%',
    }));

    const r1 = (v: number) => Math.round(v * 10) / 10;
    const pr = (a: number, b: number) => (ar ? `${a} – ${b} مليون ج.م` : `EGP ${a}M – ${b}M`);
    const lo = c.from,
      hi = r1(c.from * 2.6);
    const dlT = delivered ? X('Delivered ' + c.since, 'سُلّمت ' + c.since) : (c.dl as Bi2)[L];
    const PH = (
      e: string,
      a: string,
      stt: CoStatus,
      avl: number,
      tot: number,
      plo: number,
      phi: number,
      dl: string,
    ) => {
      const s = this.stLbl(stt);
      return {
        n: ar ? a : e,
        st: s.t,
        stBg: s.bg,
        stFg: s.fg,
        avail:
          stt === 'sold'
            ? X('Sold out', 'نفدت')
            : stt === 'soon'
              ? X('Not released yet', 'لم تُطرح بعد')
              : X(`${avl} of ${tot} available`, `${avl} من ${tot} متاحة`),
        w: Math.round(((tot - avl) / Math.max(1, tot)) * 100) + '%',
        price: plo ? pr(plo, phi) : '—',
        dl,
        canStack: stt !== 'soon',
      };
    };
    let phases;
    if (c.st === 'sold') {
      const a = Math.round(c.tot * 0.5);
      phases = [
        PH('Phase 1', 'المرحلة 1', 'sold', 0, a, lo, hi, dlT),
        PH('Phase 2', 'المرحلة 2', 'sold', 0, c.tot - a, lo, hi, dlT),
      ];
    } else if (c.st === 'soon') {
      phases = [PH('Phase 1', 'المرحلة 1', 'soon', 0, c.tot, 0, 0, dlT)];
    } else if (delivered) {
      phases = [
        PH(
          'Phase 1',
          'المرحلة 1',
          'resale',
          Math.round(c.rs * 0.6),
          Math.round(c.tot * 0.55),
          lo,
          hi,
          dlT,
        ),
        PH(
          'Phase 2',
          'المرحلة 2',
          'resale',
          c.rs - Math.round(c.rs * 0.6),
          c.tot - Math.round(c.tot * 0.55),
          r1(lo * 1.1),
          hi,
          dlT,
        ),
      ];
    } else {
      const sold = c.tot - c.av,
        p1dl = dv.del ? X('Delivered 2025', 'سُلّمت 2025') : dlT;
      if (c.st === 'launch') {
        const a2 = Math.round(c.av * 0.35),
          a3 = c.av - a2,
          t1 = Math.round(sold * 0.6),
          t2 = a2 + Math.round(sold * 0.3),
          t3 = c.tot - t1 - t2;
        phases = [
          PH('Phase 1', 'المرحلة 1', 'sold', 0, t1, r1(lo * 0.85), r1(hi * 0.8), p1dl),
          PH('Phase 2', 'المرحلة 2', 'selling', a2, t2, lo, hi, dlT),
          PH(
            'Phase 3',
            'المرحلة 3',
            'launch',
            a3,
            t3,
            r1(lo * 1.08),
            r1(hi * 1.1),
            (c.dl as Bi2)[L],
          ),
        ];
      } else {
        const t1 = Math.round(sold * 0.7);
        phases = [
          PH('Phase 1', 'المرحلة 1', 'sold', 0, t1, r1(lo * 0.85), r1(hi * 0.8), p1dl),
          PH('Phase 2', 'المرحلة 2', c.st, c.av, c.tot - t1, lo, hi, dlT),
        ];
      }
    }

    const resalePlan = delivered || c.st === 'sold';
    const plans: { t: string; s: string; m: string; best: boolean }[] = resalePlan
      ? [
          {
            t: X('Cash or bank mortgage', 'كاش أو تمويل عقاري'),
            s: X(
              'Resale units are paid to the owner; mortgage through partner banks.',
              'وحدات إعادة البيع تُدفع للمالك، والتمويل عبر البنوك الشريكة.',
            ),
            m: '',
            best: true,
          },
        ]
      : (
          [
            [c.dn, c.yr],
            [c.dn + 10, Math.max(4, c.yr - 2)],
            [c.dn + 25, Math.max(3, c.yr - 4)],
          ] as [number, number][]
        ).map(([dn, yr], k) => {
          const monthly = num(Math.round((c.from * 1e6 * (1 - dn / 100)) / (yr * 12) / 1000));
          return {
            t: X(`${dn}% down · ${yr} years`, `مقدم ${dn}% · ${yr} سنوات`),
            s:
              k === 0
                ? X('Longest plan · quarterly installments', 'أطول خطة · أقساط ربع سنوية')
                : k === 1
                  ? X('Monthly installments', 'أقساط شهرية')
                  : X(
                      `${8 + k * 2}% cash discount on the remaining amount`,
                      `خصم ${8 + k * 2}% على المبلغ المتبقي كاش`,
                    ),
            m: X(
              `≈ EGP ${monthly}K / month from the starting price`,
              `≈ ${monthly} ألف ج.م شهريًا من أقل سعر`,
            ),
            best: k === 0,
          };
        });

    const promo =
      c.promo && (c.st === 'launch' || c.st === 'offer')
        ? {
            t:
              c.st === 'launch'
                ? Y(
                    `${phases.length > 2 ? 'Phase 3' : 'Phase 1'} launch · ${c.dn}% down over ${c.yr} years`,
                    `إطلاق ${phases.length > 2 ? 'المرحلة 3' : 'المرحلة 1'} · مقدم ${c.dn}% على ${c.yr} سنوات`,
                  )
                : Y(
                    c.dn === 0 ? '0% down payment until Nov 30' : 'Up to 12% off ready units',
                    c.dn === 0 ? 'بدون مقدم حتى 30 نوفمبر' : 'خصم حتى 12% على الوحدات الجاهزة',
                  ),
            s:
              c.st === 'launch'
                ? Y(
                    'Priority booking for followers · launch prices for the first 60 units',
                    'أولوية الحجز للمتابعين · أسعار الإطلاق لأول 60 وحدة',
                  )
                : Y(
                    'Limited offer from the developer on selected units',
                    'عرض محدود من المطوّر على وحدات مختارة',
                  ),
            kind: c.st === 'launch' ? X('NEW LAUNCH', 'إطلاق جديد') : X('OFFER', 'عرض خاص'),
            video: c.st === 'launch',
            start: X('Nov 10, 2026', '10 نوفمبر 2026'),
            end: X('Dec 10, 2026', '10 ديسمبر 2026'),
            left: X('26 days left', 'متبقي 26 يومًا'),
            sc: this.scene((c.p + 2) % PAL.length, 4, c.k, 'pr' + i),
          }
        : null;

    const FAQ: [string, string, string, string][] = [
      [
        `Is ${c.n[0]} ready to move?`,
        `هل ${c.n[1]} جاهز للاستلام؟`,
        delivered
          ? `Yes. ${c.n[0]} was delivered in ${c.since}; available units are resale and ready to move.`
          : `Not yet. Delivery is planned for ${(c.dl as Bi2)[0]}. Units are sold off-plan with the payment plans above.`,
        delivered
          ? `نعم. تم تسليم ${c.n[1]} في ${c.since}، والوحدات المتاحة إعادة بيع وجاهزة للسكن.`
          : `ليس بعد. الاستلام مخطط في ${(c.dl as Bi2)[1]}. الوحدات تُباع على الخريطة بخطط السداد الموضحة.`,
      ],
      [
        'What is the minimum down payment?',
        'ما أقل مقدم؟',
        delivered
          ? 'Resale units are usually paid in cash or with a bank mortgage.'
          : `${c.dn}% on the longest plan, with installments over ${c.yr} years.`,
        delivered
          ? 'وحدات إعادة البيع تُدفع عادة كاش أو بتمويل عقاري.'
          : `${c.dn}% في أطول خطة، مع أقساط على ${c.yr} سنوات.`,
      ],
      [
        'Can I resell my unit before delivery?',
        'هل يمكنني إعادة بيع وحدتي قبل الاستلام؟',
        `Yes, after paying 30% of the unit price, subject to a transfer fee set by ${dv.n[0]}.`,
        `نعم، بعد سداد 30% من ثمن الوحدة، مع رسوم تنازل تحددها ${dv.n[1]}.`,
      ],
    ];
    const news = c.news
      ? c.st === 'launch'
        ? {
            date: X('Nov 10, 2026', '10 نوفمبر 2026'),
            t: Y('Phase 3 launched with 80 new units', 'إطلاق المرحلة 3 بـ80 وحدة جديدة'),
            b: Y(
              'Followers got 48 hours of priority booking. 28 units were reserved on launch day.',
              'حصل المتابعون على أولوية حجز 48 ساعة. تم حجز 28 وحدة في يوم الإطلاق.',
            ),
          }
        : {
            date: X('Nov 2, 2026', '2 نوفمبر 2026'),
            t: Y('Construction of Phase 2 reached 70%', 'وصلت أعمال إنشاء المرحلة 2 إلى 70%'),
            b: Y(
              'Façades and landscaping are under way; handover of the first buildings starts on schedule.',
              'تجري أعمال الواجهات واللاندسكيب، وتسليم أول المباني يبدأ في موعده.',
            ),
          }
      : null;

    const prefs = this.state.prefs(i),
      muted = !!this.state.muted()[i],
      fol = this.isFol('c' + i),
      prim = c.tot - c.rs;
    const faqOpen = this.faq();
    return {
      ...card,
      desc: descs[c.k][CL],
      descDir: CL ? 'rtl' : 'ltr',
      hl: HL[c.k].map((h) => h[CL]),
      devName: dv.n[L],
      devTop: !!dv.top,
      devVer: !!dv.ver,
      devFol: X(`${this.fmtK(this.devFol(c.d))} followers`, `${this.fmtK(this.devFol(c.d))} متابع`),
      devCos: X(`${this.coCount(c.d)} compounds`, `${this.coCount(c.d)} كمباوند`),
      delivery: delivered
        ? X(`Delivered since ${c.since}`, `مُسلّم منذ ${c.since}`)
        : (c.dl as Bi2)[L],
      deliverySub: delivered
        ? X('Ready to move · resale units only', 'جاهز للسكن · إعادة بيع فقط')
        : X('Planned handover', 'موعد التسليم المخطط'),
      finishing: FIN[c.fin][L],
      finishingSub:
        c.fin === 'full'
          ? X('Kitchen, bathrooms and AC included', 'يشمل المطبخ والحمامات والتكييف')
          : c.fin === 'semi'
            ? X('Plastered walls, pipes and wiring', 'محارة ومواسير وكهرباء')
            : X('Concrete structure and façade only', 'الهيكل الخرساني والواجهة فقط'),
      mainSc: gal[galIdx].sc,
      mainLbl: gal[galIdx].label,
      galN: galIdx + 1 + ' / ' + gal.length,
      folN: num(this.coFol(i)),
      brochure: X(`${c.n[0]} brochure · PDF · 18 MB`, `كتيّب ${c.n[1]} · PDF · 18 ميجا`),
      areaName: c.a[L],
      gal,
      hasPromo: !!promo,
      promo,
      coUnits: UNITS.map((u, k) => ({ u, k }))
        .filter((x) => x.u.c === i)
        .slice(0, 4)
        .map(({ u, k }) => this.unitCard(u, k, 'cu')),
      coUnitsT: X(
        `Units for sale · ${UNITS.filter((u) => u.c === i).length}`,
        `وحدات للبيع · ${UNITS.filter((u) => u.c === i).length}`,
      ),
      stats: (
        [
          [this.l().totalU, num(c.tot), '', '#111113'],
          [this.l().primU, num(prim), Math.round((prim / c.tot) * 100) + '%', '#111113'],
          [this.l().resU, num(c.rs), Math.round((c.rs / c.tot) * 100) + '%', '#1F4E8C'],
          [this.l().startP, egpM(c.from), c.st === 'soon' ? X('expected', 'متوقع') : '', '#111113'],
          [X('Followers', 'المتابعون'), num(this.coFol(i)), '', '#111113'],
        ] as [string, string, string, string][]
      ).map(([k, v, s, col]) => ({ k, v, s, c: col })),
      primW: Math.round((prim / c.tot) * 100) + '%',
      resW: Math.round((c.rs / c.tot) * 100) + '%',
      phases,
      types,
      facilities: FAC[c.k].map(([ic, e, a]) => ({ ic: IC[ic], t: ar ? a : e })),
      plans: plans.map((p) => ({
        ...p,
        bd: p.best ? '#111113' : '#E7E7E2',
        tag: p.best
          ? delivered
            ? X('Resale', 'إعادة بيع')
            : X('Most popular', 'الأكثر طلبًا')
          : '',
      })),
      paySum: resalePlan
        ? X('Resale · cash or mortgage', 'إعادة بيع · كاش أو تمويل')
        : X(
            `Down payment from ${c.dn}% · up to ${c.yr} years`,
            `مقدم من ${c.dn}% · حتى ${c.yr} سنوات`,
          ),
      faqs: FAQ.map((f, k) => ({
        k,
        q: f[CL],
        a: f[2 + CL],
        open: faqOpen === k,
        rot: faqOpen === k ? '45deg' : '0deg',
        bg: faqOpen === k ? '#F7F7F4' : '#fff',
      })),
      faqDir: CL ? 'rtl' : 'ltr',
      news,
      fol,
      folLbl: fol ? X('Following', 'تتابعه') : X('+ Follow', '+ متابعة'),
      folBg: fol ? '#fff' : '#111113',
      folFg: fol ? '#111113' : '#fff',
      folBd: fol ? '#E2E2DC' : '#111113',
      muted,
      bellIc: muted ? IC['bellOff'] : IC['bell'],
      bellBg: muted ? '#F1F1ED' : fol ? '#C8F169' : '#fff',
      muteSw: { bg: muted ? '#111113' : '#C4C4BE', j: muted ? 'flex-end' : 'flex-start' },
      alerts: (
        [
          ['units', X('New units released', 'طرح وحدات جديدة')],
          ['price', X('Price changes', 'تغيير الأسعار')],
          ['launch', X('Launches & offers', 'الإطلاقات والعروض')],
          ['news', X('Construction news', 'أخبار الإنشاء')],
        ] as [keyof AlertPrefs, string][]
      ).map(([k, l]) => ({
        k,
        l,
        ckBg: prefs[k] && !muted ? '#111113' : '#fff',
        ckBd: prefs[k] && !muted ? '#111113' : '#C4C4BE',
        ck: prefs[k] && !muted ? '✓' : '',
        op: muted ? 0.45 : 1,
      })),
      alHint: fol
        ? X('You follow this compound', 'أنت تتابع هذا الكمباوند')
        : X('Follow to start getting alerts', 'تابع لتصلك التنبيهات'),
    };
  });

  // ---------------------------------------------------------------- units
  egp(n: number) {
    return this.ar() ? `${this.num(Math.round(n))} ج.م` : `EGP ${this.num(Math.round(n))}`;
  }
  uRef(u: Unit) {
    return (
      COS[u.c].n[0].replace(/^The /, '').slice(0, 3).toUpperCase() +
      '-' +
      String(u.id).padStart(5, '0')
    );
  }
  uTitle(u: Unit, l: number) {
    const c = COS[u.c],
      tp = UTYPES[u.t][l];
    if (!u.beds)
      return l ? `${tp} في ${c.n[1]} – ${u.size} م²` : `${tp} in ${c.n[0]} – ${u.size} m²`;
    return l
      ? `${tp} في ${c.n[1]} – ${u.beds === 1 ? 'غرفة نوم' : u.beds + ' غرف نوم'}`
      : `${tp} in ${c.n[0]} – ${u.beds} bedroom${u.beds > 1 ? 's' : ''}`;
  }
  uPrice(u: Unit) {
    return u.offer ? Math.round((u.price * (1 - u.offer / 100)) / 100) * 100 : u.price;
  }
  uPlans(u: Unit) {
    const c = COS[u.c],
      P = this.uPrice(u),
      maint = Math.round((u.price * 0.08) / 100) * 100;
    const base: [number, number][] =
      u.list === 'resale' && u.ready
        ? [[3, 30]]
        : u.list === 'resale'
          ? [[Math.max(3, c.yr - 3), Math.max(20, c.dn + 15)]]
          : [
              [c.yr, c.dn],
              [Math.max(3, c.yr - 2), c.dn + 10],
              [Math.max(3, c.yr - 4), c.dn + 20],
            ];
    const seen = new Set<string>();
    const plans = base
      .filter(([y, d]) => !seen.has(y + '-' + d) && !!seen.add(y + '-' + d))
      .map(([years, dpPct]) => {
        const dp = Math.round((P * dpPct) / 100);
        const bulk =
          years >= 8
            ? (
                [
                  [0.05, 8],
                  [0.05, 12],
                ] as [number, number][]
              )
                .slice(0, years >= 10 ? 2 : 1)
                .map(([f, at]) => ({ v: Math.round(P * f), at }))
            : [];
        const count = years * 4;
        const inst = Math.round((P - dp - bulk.reduce((a, b) => a + b.v, 0)) / count);
        return { cash: false, years, dpPct, dp, bulk, count, inst, maint, total: P, disc: 0 };
      });
    const disc = u.list === 'primary' ? 15 : 0;
    plans.push({
      cash: true,
      years: 0,
      dpPct: 100,
      dp: Math.round(P * (1 - disc / 100)),
      bulk: [],
      count: 0,
      inst: 0,
      maint,
      total: Math.round(P * (1 - disc / 100)),
      disc,
    });
    return plans;
  }
  payLine(u: Unit) {
    const p = this.uPlans(u)[0];
    return p.cash
      ? this.X('Cash · resale', 'كاش · إعادة بيع')
      : this.X(`${p.dpPct}% down · ${p.years} yrs`, `مقدم ${p.dpPct}% · ${p.years} سنوات`);
  }
  uBadges(u: Unit) {
    const X = (e: string, a: string) => this.X(e, a);
    return (
      [
        u.sold ? [X('Sold', 'مباعة'), '#E4E4DF', '#6E6E73'] : null,
        u.launch ? [X('New Launch', 'إطلاق جديد'), '#C8F169', '#111113'] : null,
        u.offer ? [X(`Offer −${u.offer}%`, `عرض −${u.offer}%`), '#F2B84B', '#111113'] : null,
        u.featured ? [X('Featured', 'مميزة'), '#111113', '#fff'] : null,
      ].filter(Boolean) as string[][]
    ).map(([t, bg, fg]) => ({ t, bg, fg }));
  }
  unitCard(u: Unit, i: number, idp = 'u') {
    const L = this.L(),
      c = COS[u.c],
      dv = DEVS[c.d],
      faved = this.isFol('u' + i);
    const ppm = this.num(Math.round(this.uPrice(u) / u.size));
    return {
      i,
      title: this.uTitle(u, L),
      ref: this.uRef(u),
      sc: this.scene(u.p, u.v + 1, c.k, idp + u.id),
      badges: this.uBadges(u),
      list: u.list === 'primary' ? this.X('Primary', 'من المطوّر') : this.X('Resale', 'إعادة بيع'),
      listBg: u.list === 'primary' ? '#EEF6DA' : '#E3ECF8',
      listFg: u.list === 'primary' ? '#2F4A0A' : '#1F4E8C',
      price: this.egp(this.uPrice(u)),
      was: u.offer ? this.egp(u.price) : '',
      hasWas: !!u.offer,
      ppm: this.X(`${ppm} EGP/m²`, `${ppm} ج.م/م²`),
      co: c.n[L],
      dev: dv.n[L],
      devInit: this.inits(dv.n[0]),
      devC: dv.c,
      area: c.a[L],
      beds: String(u.beds),
      hasBeds: u.beds > 0,
      baths: String(u.baths),
      size: `${u.size} ${this.X('m²', 'م²')}`,
      del: u.ready
        ? this.X('Ready to move', 'جاهز للسكن')
        : this.X('Delivery ', 'الاستلام ') + (c.dl as Bi2)[L],
      delC: u.ready ? '#2F4A0A' : '#3B3B40',
      pay: this.payLine(u),
      faved,
      hBg: faved ? '#C8F169' : 'rgba(17,17,19,0.62)',
      hFg: faved ? '#111113' : '#fff',
      heart: faved ? '♥' : '♡',
      op: u.sold ? 0.6 : 1,
    };
  }
  toggleFav(i: number, ev?: Event) {
    ev?.stopPropagation();
    const on = this.state.toggleFollow('u' + i);
    this.toast(
      on
        ? this.X('Saved to favorites', 'تمت الإضافة للمفضلة')
        : this.X('Removed from favorites', 'تمت الإزالة من المفضلة'),
    );
  }
  private chip<T extends string>(cur: T, set: (v: T) => void) {
    return ([k, l, n]: [T, string, number?]) => ({
      k,
      label: n === undefined ? l : l + ' · ' + n,
      go: () => set(k),
      bg: cur === k ? '#111113' : '#fff',
      fg: cur === k ? '#fff' : '#111113',
      bd: cur === k ? '#111113' : '#E2E2DC',
    });
  }
  readonly uMeta = computed(() =>
    this.X(
      `${UNITS.length} units · ${UNITS.filter((u) => !u.sold).length} for sale · ${COS.length} compounds`,
      `${UNITS.length} وحدة · ${UNITS.filter((u) => !u.sold).length} للبيع · ${COS.length} كمباوند`,
    ),
  );
  readonly uListChips = computed(() =>
    (
      [
        ['all', this.X('All', 'الكل'), UNITS.length],
        [
          'primary',
          this.X('Primary', 'من المطوّر'),
          UNITS.filter((u) => u.list === 'primary').length,
        ],
        ['resale', this.X('Resale', 'إعادة بيع'), UNITS.filter((u) => u.list === 'resale').length],
        ['ready', this.X('Ready to move', 'جاهز للسكن'), UNITS.filter((u) => u.ready).length],
        ['offer', this.X('Offers', 'عروض'), UNITS.filter((u) => u.offer).length],
        ['launch', this.X('Launches', 'إطلاقات'), UNITS.filter((u) => u.launch).length],
      ] as ['all' | 'primary' | 'resale' | 'ready' | 'offer' | 'launch', string, number][]
    ).map(this.chip(this.ul(), (v) => this.ul.set(v))),
  );
  readonly uBedChips = computed(() =>
    (
      [
        ['any', this.X('Any', 'الكل')],
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['4', '4+'],
      ] as [string, string][]
    ).map(this.chip(this.ub(), (v) => this.ub.set(v))),
  );
  readonly uTypeOpts = computed(() => [
    { v: 'all', l: this.X('All property types', 'كل أنواع الوحدات') },
    ...Object.keys(UTYPES).map((k) => ({
      v: k,
      l: UTYPES[k][this.L()] + ' · ' + UNITS.filter((u) => u.t === k).length,
    })),
  ]);
  readonly uCoOpts = computed(() => [
    { v: 'all', l: this.X('All compounds', 'كل الكمباوندات') },
    ...COS.map((c, i) => ({ v: String(i), l: c.n[this.L()] })),
  ]);
  readonly uSorts = computed(() => [
    { v: 'new', l: this.X('Newest', 'الأحدث') },
    { v: 'plo', l: this.X('Price: low to high', 'السعر: من الأقل') },
    { v: 'phi', l: this.X('Price: high to low', 'السعر: من الأعلى') },
    { v: 'ppm', l: this.X('Price per m²', 'سعر المتر') },
    { v: 'size', l: this.X('Largest', 'الأكبر مساحة') },
  ]);
  readonly hasUFilter = computed(
    () =>
      this.uc() !== 'all' ||
      this.ut() !== 'all' ||
      this.ul() !== 'all' ||
      this.ub() !== 'any' ||
      !!this.q(),
  );
  clearU() {
    this.uc.set('all');
    this.ut.set('all');
    this.ul.set('all');
    this.ub.set('any');
    this.q.set('');
  }
  readonly unitList = computed(() => {
    this.state.followed();
    const ql = this.q().trim().toLowerCase(),
      uc = this.uc(),
      ut = this.ut(),
      ul = this.ul(),
      ub = this.ub(),
      us = this.us();
    const list = UNITS.map((u, i) => ({ u, i })).filter(({ u }) => {
      const c = COS[u.c];
      if (uc !== 'all' && String(u.c) !== uc) return false;
      if (ut !== 'all' && u.t !== ut) return false;
      if (ul === 'primary' && u.list !== 'primary') return false;
      if (ul === 'resale' && u.list !== 'resale') return false;
      if (ul === 'offer' && !u.offer) return false;
      if (ul === 'launch' && !u.launch) return false;
      if (ul === 'ready' && !u.ready) return false;
      if (ub !== 'any' && (ub === '4' ? u.beds < 4 : u.beds !== +ub)) return false;
      return (
        !ql ||
        (
          this.uTitle(u, 0) +
          ' ' +
          this.uTitle(u, 1) +
          ' ' +
          this.uRef(u) +
          ' ' +
          c.a[0] +
          ' ' +
          c.a[1]
        )
          .toLowerCase()
          .includes(ql)
      );
    });
    list.sort(
      (a, b) =>
        Number(a.u.sold) - Number(b.u.sold) ||
        (us === 'plo'
          ? this.uPrice(a.u) - this.uPrice(b.u)
          : us === 'phi'
            ? this.uPrice(b.u) - this.uPrice(a.u)
            : us === 'size'
              ? b.u.size - a.u.size
              : us === 'ppm'
                ? this.uPrice(a.u) / a.u.size - this.uPrice(b.u) / b.u.size
                : a.u.days - b.u.days),
    );
    return list.map(({ u, i }) => this.unitCard(u, i));
  });
  readonly uCount = computed(() =>
    this.X(`${this.unitList().length} results`, `${this.unitList().length} نتيجة`),
  );

  readonly un = computed(() => {
    if (this.view !== 'unit' || this.notFound()) return null;
    this.state.followed();
    const X = (e: string, a: string) => this.X(e, a);
    const L = this.L(),
      CL = this.CL,
      i = this.idx(),
      u = UNITS[i],
      c = COS[u.c],
      dv = DEVS[c.d];
    const card = this.unitCard(u, i),
      plans = this.uPlans(u),
      pi = Math.min(this.pl(), plans.length - 1),
      p = plans[pi],
      ag = AGENTS[u.ag];
    const dl = (c.dl as Bi2 | undefined) ?? ['', ''];
    const media: [string, string][] = [
      ['photos', X('Photos', 'الصور') + ' · 5'],
      ['plan', X('Floor plan', 'المسقط')],
      ...(u.video ? ([['video', X('Video', 'فيديو')]] as [string, string][]) : []),
    ];
    const mt = media.some((m) => m[0] === this.mt()) ? this.mt() : 'photos';
    const rooms: [string, string][] = u.beds
      ? [
          [X('Living', 'المعيشة'), '#F7F9F0'],
          ...Array.from(
            { length: Math.min(u.beds, 3) },
            (_, k) => [X('Bedroom ' + (k + 1), 'نوم ' + (k + 1)), '#fff'] as [string, string],
          ),
          [X('Kitchen', 'المطبخ'), '#FDF6E6'],
          [X('Bath', 'حمام'), '#EEF4FA'],
        ]
      : [
          [X('Open space', 'مساحة مفتوحة'), '#F7F9F0'],
          [X('Pantry', 'بوفيه'), '#FDF6E6'],
          [X('WC', 'دورة مياه'), '#EEF4FA'],
        ];
    const m2 = X('m²', 'م²');
    const spec = (
      [
        [X('Property type', 'نوع الوحدة'), UTYPES[u.t][L]],
        [X('Size', 'المساحة'), `${u.size} ${m2}`],
        u.beds ? [X('Bedrooms', 'غرف النوم'), String(u.beds)] : null,
        [X('Bathrooms', 'الحمامات'), String(u.baths)],
        u.level ? [X('Level', 'الدور'), u.level[L]] : null,
        u.garden ? [X('Garden', 'الحديقة'), `${u.garden} ${m2}`] : null,
        u.land ? [X('Land', 'الأرض'), `${u.land} ${m2}`] : null,
        u.outdoor ? [X('Roof terrace', 'تراس الروف'), `${u.outdoor} ${m2}`] : null,
        [X('Finishing', 'التشطيب'), FIN[c.fin][L]],
        [X('Delivery', 'الاستلام'), u.ready ? X('Ready to move', 'جاهز للسكن') : dl[L]],
        [
          X('Listing', 'نوع العرض'),
          u.list === 'primary'
            ? X('Primary · from developer', 'من المطوّر مباشرة')
            : X('Resale · from owner', 'إعادة بيع · من المالك'),
        ],
        [
          X('Payment', 'الدفع'),
          plans.length > 1 ? X('Installments or cash', 'تقسيط أو كاش') : X('Cash', 'كاش'),
        ],
        [X('Maintenance', 'الصيانة'), this.egp(p.maint)],
        [X('Reference', 'الكود'), this.uRef(u)],
      ].filter(Boolean) as string[][]
    ).map(([k, v]) => ({ k, v }));
    const tp = UTYPES[u.t];
    const descEn = u.beds
      ? `${tp[0]} in ${c.n[0]} by ${dv.n[0]}, ${u.size} m², ${u.beds} bedroom${u.beds > 1 ? 's' : ''}, ${u.baths} bathroom${u.baths > 1 ? 's' : ''}. ${FIN[c.fin][0]}. ${u.ready ? 'Ready to move.' : 'Delivery ' + dl[0] + '.'}${u.garden ? ` Private garden of ${u.garden} m².` : ''}${u.outdoor ? ` Roof terrace of ${u.outdoor} m².` : ''}`
      : `${tp[0]} in ${c.n[0]} by ${dv.n[0]}, ${u.size} m² on ${u.level ? u.level[0].toLowerCase() : 'the ground floor'}. ${FIN[c.fin][0]}. ${u.ready ? 'Ready to operate.' : 'Delivery ' + dl[0] + '.'}`;
    const descAr = u.beds
      ? `${tp[1]} في ${c.n[1]} من ${dv.n[1]}، مساحتها ${u.size} م² و${u.beds === 1 ? 'غرفة نوم' : u.beds + ' غرف نوم'} و${u.baths === 1 ? 'حمام' : u.baths === 2 ? 'حمامان' : u.baths + ' حمامات'}. ${FIN[c.fin][1]}. ${u.ready ? 'جاهزة للسكن.' : 'التسليم ' + dl[1] + '.'}${u.garden ? ` حديقة خاصة ${u.garden} م².` : ''}${u.outdoor ? ` تراس روف ${u.outdoor} م².` : ''}`
      : `${tp[1]} في ${c.n[1]} من ${dv.n[1]}، مساحته ${u.size} م²${u.level ? ' في ' + u.level[1] : ''}. ${FIN[c.fin][1]}. ${u.ready ? 'جاهز للتشغيل.' : 'التسليم ' + dl[1] + '.'}`;
    const payRows: [string, string, string][] = p.cash
      ? [
          [
            X('Cash price', 'السعر كاش'),
            this.egp(p.total),
            p.disc
              ? X(`${p.disc}% cash discount`, `خصم كاش ${p.disc}%`)
              : X('Paid on contract', 'يُدفع عند التعاقد'),
          ],
        ]
      : [
          [
            X('Down payment', 'المقدم'),
            p.dp ? this.egp(p.dp) : X('No down payment', 'بدون مقدم'),
            `${p.dpPct}%`,
          ],
          [
            X('Quarterly installment', 'القسط ربع السنوي'),
            this.egp(p.inst),
            X(
              `${p.count} installments over ${p.years} years`,
              `${p.count} قسط على ${p.years} سنوات`,
            ),
          ],
          ...p.bulk.map(
            (b) =>
              [
                X('Bulk payment', 'دفعة إضافية'),
                this.egp(b.v),
                X(`with installment ${b.at}`, `مع القسط ${b.at}`),
              ] as [string, string, string],
          ),
          [
            X('Total price', 'إجمالي السعر'),
            this.egp(p.total),
            u.offer ? X(`after ${u.offer}% offer`, `بعد خصم ${u.offer}%`) : '',
          ],
        ];
    const cnt = UNITS.filter((x) => x.c === u.c).length,
      devCos = COS.filter((x) => x.d === c.d).length,
      devUnits = UNITS.filter((x) => COS[x.c].d === c.d).length;
    const st = this.stLbl(c.st),
      gal = this.gal();
    const ppm = this.num(Math.round(this.uPrice(u) / u.size));
    return {
      ...card,
      title2: this.uTitle(u, 1 - L),
      desc: CL ? descAr : descEn,
      descDir: CL ? 'rtl' : 'ltr',
      listed: X(
        `Listed ${u.days} day${u.days > 1 ? 's' : ''} ago · ${u.views} views`,
        `أُضيفت منذ ${u.days} يوم · ${u.views} مشاهدة`,
      ),
      ppmBig: X(`${ppm} EGP per m²`, `${ppm} ج.م للمتر`),
      mainSc: this.scene((u.p + gal) % 6, u.v + gal, c.k, 'um' + u.id),
      galN: gal + 1 + ' / 5',
      coIdx: u.c,
      devIdx: c.d,
      coSc: this.scene(c.p, 0, c.k, 'uc' + u.id),
      coSt: st.t,
      coStBg: st.bg,
      coStFg: st.fg,
      coFrom: X('From ', 'يبدأ من ') + this.egpM(c.from),
      coUnits: X(`${cnt} units listed`, `${cnt} وحدة معروضة`),
      devUnits: X(
        `${devCos} compounds · ${devUnits} units`,
        `${devCos} كمباوند · ${devUnits} وحدة`,
      ),
      devVer: !!dv.ver,
      media: media.map(([k, l]) => ({
        k: k as 'photos' | 'plan' | 'video',
        l,
        bg: mt === k ? '#111113' : 'rgba(255,255,255,0.92)',
        fg: mt === k ? '#fff' : '#111113',
      })),
      mPhotos: mt === 'photos',
      mPlan: mt === 'plan',
      mVideo: mt === 'video',
      thumbs: [0, 1, 2, 3, 4].map((k) => ({
        k,
        sc: this.scene((u.p + k) % 6, u.v + k, c.k, 'ut' + u.id + '-' + k),
        bd: gal === k ? '#111113' : 'transparent',
      })),
      rooms: rooms.map(([n, bg]) => ({ n, bg })),
      planSize: `${u.size} ${m2}`,
      hasOffer: !!u.offer,
      offerT: X(
        `${u.offer}% off this unit until Nov 30, 2026`,
        `خصم ${u.offer}% على هذه الوحدة حتى 30 نوفمبر 2026`,
      ),
      offerS: X(
        `Was ${this.egp(u.price)} · you save ${this.egp(u.price - this.uPrice(u))}`,
        `كان ${this.egp(u.price)} · توفير ${this.egp(u.price - this.uPrice(u))}`,
      ),
      isLaunch: u.launch,
      launchT: X(
        'Launch price · priority booking for followers',
        'سعر الإطلاق · أولوية الحجز للمتابعين',
      ),
      spec,
      planTabs: plans.map((q, k) => ({
        k,
        l: q.cash
          ? X('Cash', 'كاش')
          : X(`${q.years} yrs · ${q.dpPct}%`, `${q.years} سنوات · ${q.dpPct}%`),
        bg: pi === k ? '#111113' : '#fff',
        fg: pi === k ? '#fff' : '#111113',
        bd: pi === k ? '#111113' : '#E2E2DC',
      })),
      payRows: payRows.map(([k, v, s]) => ({ k, v, s })),
      maintRow: X(
        `Maintenance deposit ${this.egp(p.maint)} · one-time, not included in the price`,
        `وديعة صيانة ${this.egp(p.maint)} · مرة واحدة ولا تدخل في السعر`,
      ),
      ag: {
        n: ag[L],
        init: ag[0]
          .split(' ')
          .map((w) => w[0])
          .join(''),
        role: X('Sales agent · Nile Realty', 'وكيل مبيعات · النيل العقارية'),
      },
      sellerV: X('Verified seller', 'بائع موثّق'),
      reserveL: u.sold ? X('Sold', 'مباعة') : X('Reserve · hold 48h', 'حجز · 48 ساعة'),
      similar: UNITS.map((x, k) => ({ x, k }))
        .filter(({ x, k }) => x.c === u.c && k !== i)
        .slice(0, 3)
        .map(({ x, k }) => this.unitCard(x, k, 'us')),
      uL: {
        price: X('Price', 'السعر'),
        specs: X('Unit details', 'تفاصيل الوحدة'),
        calc: X('Payment plans', 'خطط السداد'),
        desc: X('Description', 'الوصف'),
        compound: X('Compound', 'الكمباوند'),
        seller: X('Listed by', 'المعلن'),
        similar: X('More units in this compound', 'وحدات أخرى في هذا الكمباوند'),
        call: X('Call', 'اتصال'),
        wa: X('WhatsApp', 'واتساب'),
        stack: X('Stacking plan', 'خريطة الوحدات'),
        vid: X('Walkthrough video · 1:12', 'فيديو جولة · 1:12'),
        north: X('N', 'ش'),
      },
    };
  });
  reserve() {
    const u = UNITS[this.idx()];
    this.toast(
      u.sold
        ? this.X('This unit is sold', 'هذه الوحدة مباعة')
        : this.X(
            'Unit held for 48 hours · record the deposit before it expires',
            'تم حجز الوحدة 48 ساعة · سجّل العربون قبل انتهاء المدة',
          ),
    );
  }
  addUnit() {
    this.toast(
      this.X(
        'Units come from developer feeds, Excel import or + Add unit',
        'تأتي الوحدات من بيانات المطوّرين أو استيراد Excel أو إضافة وحدة',
      ),
    );
  }
  setSel(ev: Event, s: 'uc' | 'ut' | 'us') {
    const v = (ev.target as HTMLSelectElement).value;
    if (s === 'uc') this.uc.set(v);
    else if (s === 'ut') this.ut.set(v);
    else this.us.set(v as 'new' | 'plo' | 'phi' | 'ppm' | 'size');
  }

  toggleFaq(k: number) {
    this.faq.set(this.faq() === k ? -1 : k);
  }
  toggleAl(ev: Event) {
    ev.stopPropagation();
    this.alOpen.update((v) => !v);
  }
  togglePref(k: keyof AlertPrefs) {
    if (this.state.muted()[this.idx()]) return;
    this.state.togglePref(this.idx(), k);
  }
  toggleMute() {
    const m = this.state.toggleMute(this.idx());
    this.toast(
      m
        ? this.X('Alerts muted for this compound', 'تم كتم تنبيهات هذا الكمباوند')
        : this.X('Alerts on', 'التنبيهات مفعّلة'),
    );
  }
  setGal(k: number) {
    this.gal.set(k);
  }
  stackSoon() {
    this.toast(this.X('Opens the unit-by-unit stacking plan', 'يفتح خريطة الوحدات'));
  }
  addDev() {
    this.toast(
      this.X('New developers are added by Mujez admins', 'يضيف مديرو موجز المطوّرين الجدد'),
    );
  }
  addCo() {
    this.toast(
      this.X(
        'Compounds are added from Inventory import or by Mujez admins',
        'تُضاف الكمباوندات من استيراد المخزون أو من مديري موجز',
      ),
    );
  }
  info(en: string, ar: string) {
    this.toast(this.X(en, ar));
  }
  onInput(ev: Event) {
    this.q.set((ev.target as HTMLInputElement).value);
  }
  onSel(ev: Event, s: 'sort' | 'dev') {
    const v = (ev.target as HTMLSelectElement).value;
    if (s === 'sort') this.sort.set(v as 'fol' | 'cos' | 'az');
    else this.devSel.set(v);
  }
}

type Bi2 = [string, string];
