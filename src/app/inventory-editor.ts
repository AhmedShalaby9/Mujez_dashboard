import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryApi, Project, Building } from './inventory-api.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { AuthService } from './auth.service';
import { majorAmount, minorAmount } from './sales-api.service';
@Component({
  selector: 'app-inventory-editor',
  imports: [FormsModule],
  template: `<div class="scrim scrim--top"></div>
    <section
      class="dialog dialog--wide"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="t('Inventory form', 'نموذج المخزون')"
    >
      <form (ngSubmit)="save()">
        <div class="dialog__head">
          <span class="dialog__title">{{ title() }}</span>
        </div>
        <div class="dialog__main">
          @if (error()) {
            <p class="note note--bad" role="alert">{{ error() }}</p>
          }
          <div class="grid">
            <label class="field">
              <span>{{ t('Code', 'الرمز') }}</span>
              <input
                class="mono"
                name="code"
                [(ngModel)]="form.code"
                required
                maxlength="50"
                (ngModelChange)="changed()"
              />
            </label>
            @if (kind() === 'project') {
              <label class="field">
                <span>{{ t('Segment', 'القطاع') }}</span>
                <select name="segment" [(ngModel)]="form.segment" (ngModelChange)="changed()">
                  <option value="res">{{ t('Residential', 'سكني') }}</option>
                  <option value="com">{{ t('Commercial', 'تجاري') }}</option>
                </select>
              </label>
            }
            @if (kind() === 'phase') {
              <label class="field">
                <span>{{ t('Delivery year', 'سنة التسليم') }}</span>
                <input
                  class="mono"
                  name="year"
                  type="number"
                  min="1900"
                  max="2200"
                  [(ngModel)]="form.deliveryYear"
                  required
                  (ngModelChange)="changed()"
                />
              </label>
            }
            @if (kind() === 'building') {
              <label class="field">
                <span>{{ t('Floors above ground', 'الأدوار فوق الأرض') }}</span>
                <input
                  class="mono"
                  name="floors"
                  type="number"
                  min="0"
                  max="300"
                  [(ngModel)]="form.floors"
                  required
                  (ngModelChange)="changed()"
                />
              </label>
            }
            @if (kind() === 'unit') {
              <label class="field">
                <span>{{ t('Listing', 'نوع الإدراج') }}</span>
                <select name="listing" [(ngModel)]="form.listing" (ngModelChange)="changed()">
                  <option value="primary">{{ t('Primary', 'أساسي') }}</option>
                  <option value="resale">{{ t('Resale', 'إعادة بيع') }}</option>
                  <option value="rental">{{ t('Rental', 'إيجار') }}</option>
                </select>
              </label>
            }
            <label class="field">
              <span>{{ kind() === 'unit' ? t('Location', 'الموقع') : t('Name', 'الاسم') }}</span>
              <input
                name="name"
                [(ngModel)]="form.name"
                required
                maxlength="200"
                (ngModelChange)="changed()"
              />
            </label>
            <label class="field">
              <span>{{
                kind() === 'unit'
                  ? t('Location in Arabic', 'الموقع بالعربية')
                  : t('Arabic name', 'الاسم بالعربية')
              }}</span>
              <input
                name="nameAr"
                dir="rtl"
                [(ngModel)]="form.nameAr"
                maxlength="200"
                (ngModelChange)="changed()"
              />
            </label>
            @if (kind() === 'project') {
              <label class="field">
                <span>{{ t('Developer', 'المطور') }}</span>
                <input
                  name="developer"
                  [(ngModel)]="form.developer"
                  required
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('Developer in Arabic', 'المطور بالعربية') }}</span>
                <input
                  name="developerAr"
                  dir="rtl"
                  [(ngModel)]="form.developerAr"
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('Location', 'الموقع') }}</span>
                <input
                  name="location"
                  [(ngModel)]="form.location"
                  required
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('Location in Arabic', 'الموقع بالعربية') }}</span>
                <input
                  name="locationAr"
                  dir="rtl"
                  [(ngModel)]="form.locationAr"
                  (ngModelChange)="changed()"
                />
              </label>
            }
          </div>
          @if (kind() === 'unit') {
            @if (canProjects()) {
              <span class="p-label">{{ t('PLACEMENT', 'الموضع') }}</span>
              <div class="field">
                <span>{{
                  t('Project (optional for standalone units)', 'المشروع (اختياري للوحدات المستقلة)')
                }}</span>
                <div class="pick">
                  <input
                    type="search"
                    name="projectSearch"
                    [(ngModel)]="projectSearch"
                    [placeholder]="t('Search projects', 'بحث المشروعات')"
                    (keydown.enter)="$event.preventDefault(); loadProjects(true)"
                  />
                  <button type="button" class="btn btn--sm" (click)="loadProjects(true)">
                    {{ t('Search', 'بحث') }}
                  </button>
                </div>
                <select name="project" [(ngModel)]="projectId" (ngModelChange)="chooseProject()">
                  <option value="">{{ t('Standalone', 'مستقلة') }}</option>
                  @for (p of projects(); track p.id) {
                    <option [value]="p.id">{{ p.code }} · {{ name(p.name) }}</option>
                  }
                </select>
                @if (projectPage * 50 < projectTotal()) {
                  <button type="button" class="link small" (click)="loadProjects(false)">
                    {{ t('More projects', 'مشروعات إضافية') }}
                  </button>
                }
              </div>
              <label class="field">
                <span>{{ t('Building', 'المبنى') }}</span>
                <select name="building" [(ngModel)]="form.buildingId" (ngModelChange)="changed()">
                  <option value="">{{ t('No building', 'بدون مبنى') }}</option>
                  @for (b of buildings(); track b.id) {
                    <option [value]="b.id">{{ b.code }} · {{ name(b.name) }}</option>
                  }
                </select>
              </label>
            }
            <span class="p-label">{{ t('UNIT DETAILS', 'تفاصيل الوحدة') }}</span>
            <div class="grid grid--3">
              <label class="field">
                <span>{{ t('Type', 'النوع') }}</span>
                <select name="type" [(ngModel)]="form.type" (ngModelChange)="changed()">
                  <option value="apt">{{ t('Apartment', 'شقة') }}</option>
                  <option value="villa">{{ t('Villa', 'فيلا') }}</option>
                  <option value="office">{{ t('Office', 'مكتب') }}</option>
                  <option value="retail">{{ t('Retail', 'تجاري') }}</option>
                </select>
              </label>
              <label class="field">
                <span>{{ t('Bedrooms', 'غرف النوم') }}</span>
                <input
                  class="mono"
                  name="bedrooms"
                  type="number"
                  min="0"
                  max="100"
                  [(ngModel)]="form.bedrooms"
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('Area (sqm)', 'المساحة (م²)') }}</span>
                <input
                  class="mono"
                  name="area"
                  type="number"
                  min="0.01"
                  step="0.01"
                  [(ngModel)]="form.area"
                  required
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('Floor', 'الدور') }}</span>
                <input
                  class="mono"
                  name="floor"
                  type="number"
                  min="-20"
                  max="300"
                  [(ngModel)]="form.floor"
                  (ngModelChange)="changed()"
                />
              </label>
              <label class="field">
                <span>{{ t('View', 'الإطلالة') }}</span>
                <input name="view" [(ngModel)]="form.view" (ngModelChange)="changed()" />
              </label>
              <label class="field">
                <span>{{ t('View in Arabic', 'الإطلالة بالعربية') }}</span>
                <input
                  name="viewAr"
                  dir="rtl"
                  [(ngModel)]="form.viewAr"
                  (ngModelChange)="changed()"
                />
              </label>
            </div>
            <label class="field">
              <span>{{
                form.listing === 'rental'
                  ? t('Monthly rent (EGP)', 'الإيجار الشهري (جنيه)')
                  : t('Price (EGP)', 'السعر (جنيه)')
              }}</span>
              <input
                class="mono"
                name="price"
                inputmode="decimal"
                [(ngModel)]="form.price"
                required
                (ngModelChange)="changed()"
              />
            </label>
          }
        </div>
        <div class="dialog__foot">
          <button type="button" class="btn" [disabled]="busy()" (click)="closed.emit()">
            {{ t('Cancel', 'إلغاء') }}
          </button>
          <button type="submit" class="btn btn--dark" [disabled]="busy()">
            {{ busy() ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ') }}
          </button>
        </div>
      </form>
    </section>`,
  styleUrls: ['./pages/admin-shell/admin-ui.scss', './pages/company-shell/company-ui.scss'],
  styles: [
    `
      .p-label {
        font-size: 11px;
        font-weight: 500;
        color: #8a8a90;
        letter-spacing: 0.04em;
      }
      .grid--3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      @media (max-width: 640px) {
        .grid--3 {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .pick {
        display: flex;
        gap: 6px;
        input {
          min-height: 32px;
        }
      }
      .field .link {
        align-self: flex-start;
      }
      .small {
        font-size: 12px;
      }
    `,
  ],
})
export class InventoryEditor implements OnInit {
  readonly api = inject(InventoryApi);
  readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  kind = input.required<'project' | 'phase' | 'building' | 'unit'>();
  record = input<any>(null);
  parent = input<string>('');
  initial = input<any>({});
  saved = output<any>();
  closed = output<void>();
  busy = signal(false);
  error = signal('');
  title() {
    const k = this.kind();
    const what = {
      project: this.t('project', 'مشروع'),
      phase: this.t('phase', 'مرحلة'),
      building: this.t('building', 'مبنى'),
      unit: this.t('unit', 'وحدة'),
    }[k];
    return (this.record() ? this.t('Edit ', 'تعديل ') : this.t('New ', 'إضافة ')) + what;
  }
  projects = signal<Project[]>([]);
  projectTotal = signal(0);
  buildings = signal<Building[]>([]);
  projectId = '';
  projectSearch = '';
  projectPage = 0;
  private projectSerial = 0;
  private buildingSerial = 0;
  requestId = crypto.randomUUID();
  form: any = {
    code: '',
    name: '',
    nameAr: '',
    developer: '',
    developerAr: '',
    location: '',
    locationAr: '',
    segment: 'res',
    deliveryYear: 2027,
    floors: 1,
    listing: 'resale',
    buildingId: '',
    type: 'apt',
    bedrooms: null,
    area: null,
    view: '',
    viewAr: '',
    floor: null,
    price: '',
  };
  t(en: string, ar: string) {
    return this.ui.lang() === 'ar' ? ar : en;
  }
  name(v: any) {
    return v?.[this.ui.lang()] ?? v?.en ?? '';
  }
  canProjects() {
    return this.auth.user()?.permissions.includes('projects.read') ?? false;
  }
  changed() {
    this.requestId = crypto.randomUUID();
  }
  async ngOnInit() {
    const r = this.record();
    if (r) {
      this.form = {
        ...this.form,
        code: r.code,
        name: r.name?.en ?? r.location?.en ?? '',
        nameAr: r.name?.ar ?? r.location?.ar ?? '',
        developer: r.developer?.en ?? '',
        developerAr: r.developer?.ar ?? '',
        location: r.location?.en ?? '',
        locationAr: r.location?.ar ?? '',
        segment: r.segment ?? 'res',
        deliveryYear: r.deliveryYear ?? 2027,
        floors: r.floors ?? 1,
        listing: r.listing ?? 'resale',
        buildingId: r.buildingId ?? '',
        type: r.type ?? 'apt',
        bedrooms: r.bedrooms ?? null,
        area: r.area === undefined ? null : Number(r.area),
        view: r.view?.en ?? '',
        viewAr: r.view?.ar ?? '',
        floor: r.floor ?? null,
        price: r.priceMinor ? majorAmount(r.priceMinor) : '',
      };
      this.projectId = r.projectId ?? '';
    } else {
      this.form = { ...this.form, ...this.initial() };
      this.projectId = this.initial().projectId ?? '';
    }
    if (this.kind() === 'unit' && this.canProjects()) {
      await this.loadProjects(true);
      if (this.projectId) await this.chooseProject(false);
    }
  }
  async loadProjects(reset: boolean) {
    const serial = ++this.projectSerial;
    try {
      const page = reset ? 1 : this.projectPage + 1;
      const r = await this.api.get<{ items: Project[]; total: number }>('projects', {
        page: String(page),
        limit: '50',
        q: this.projectSearch,
      });
      if (serial !== this.projectSerial) return;
      let items = reset ? r.items : [...this.projects(), ...r.items];
      if (reset && this.projectId && !items.some((p) => p.id === this.projectId)) {
        const p = await this.api.get<Project>('projects/' + this.projectId);
        if (serial !== this.projectSerial) return;
        items = [p, ...items];
      }
      this.projects.set(items);
      this.projectTotal.set(r.total);
      this.projectPage = page;
    } catch (e: any) {
      if (serial === this.projectSerial) this.error.set(e.message);
    }
  }
  async chooseProject(reset = true) {
    const serial = ++this.buildingSerial;
    if (reset) {
      this.form.buildingId = '';
      this.changed();
    }
    this.buildings.set([]);
    if (!this.projectId) return;
    try {
      const p = await this.api.get<Project>('projects/' + this.projectId);
      if (serial === this.buildingSerial)
        this.buildings.set(p.phases.flatMap((ph) => ph.buildings));
    } catch (e: any) {
      if (serial === this.buildingSerial) this.error.set(e.message);
    }
  }
  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const f = this.form,
        r = this.record(),
        kind = this.kind();
      let path = '',
        b: any = { requestId: this.requestId, code: f.code, ...(r ? { version: r.version } : {}) };
      if (kind === 'project') {
        path = 'projects' + (r ? '/' + r.id + '/update' : '');
        Object.assign(b, {
          name: f.name,
          nameAr: f.nameAr || undefined,
          developer: f.developer,
          developerAr: f.developerAr || undefined,
          location: f.location,
          locationAr: f.locationAr || undefined,
          segment: f.segment,
        });
      }
      if (kind === 'phase') {
        path = 'projects/' + this.parent() + '/phases' + (r ? '/' + r.id + '/update' : '');
        Object.assign(b, {
          name: f.name,
          nameAr: f.nameAr || undefined,
          deliveryYear: Number(f.deliveryYear),
        });
      }
      if (kind === 'building') {
        path =
          'projects/phases/' + this.parent() + '/buildings' + (r ? '/' + r.id + '/update' : '');
        Object.assign(b, { name: f.name, nameAr: f.nameAr || undefined, floors: Number(f.floors) });
      }
      if (kind === 'unit') {
        path = 'units' + (r ? '/' + r.id + '/update' : '');
        Object.assign(b, {
          location: f.name,
          locationAr: f.nameAr || undefined,
          buildingId: f.buildingId || null,
          listing: f.listing,
          type: f.type,
          bedrooms: f.bedrooms === null || f.bedrooms === '' ? null : Number(f.bedrooms),
          area: Number(f.area),
          view: f.view,
          viewAr: f.viewAr || undefined,
          floor: f.floor === null || f.floor === '' ? null : Number(f.floor),
          priceMinor: minorAmount(f.price),
        });
      }
      this.saved.emit(await this.api.write(path, b));
    } catch (e: any) {
      this.error.set(e.message ?? 'Save failed');
    } finally {
      this.busy.set(false);
    }
  }
}
