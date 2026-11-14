import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Inventory } from './pages/company-shell/inventory/inventory';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { AdminUiState } from './pages/admin-shell/admin-ui-state';
import { CatalogApi, type CatalogItem } from './catalog-api.service';
import { InventoryApi } from './inventory-api.service';
import { AuthService } from './auth.service';
const id = '83ca1c48-725c-43ec-97e9-cb1f3e6e2eae';
const row = (more: Partial<CatalogItem> = {}): CatalogItem => ({
  id,
  kind: 'units',
  parentId: null,
  name: { en: 'Real inventory', ar: 'مخزون حقيقي' },
  status: 'available',
  priceMinor: null,
  area: null,
  bedrooms: null,
  data: {},
  version: 0,
  followers: 0,
  children: 0,
  available: 0,
  fromPriceMinor: null,
  preference: {
    followed: false,
    favorite: false,
    muted: false,
    alerts: { units: true, price: true, launch: true, news: false },
  },
  ...more,
});
async function render(view: string, rows: CatalogItem[] = [], admin = false, ar = false) {
  const api = {
    list: vi.fn().mockResolvedValue({ items: rows, total: rows.length, page: 1, limit: 24 }),
    detail: vi.fn().mockResolvedValue(rows[0] ?? row()),
    preference: vi
      .fn()
      .mockImplementation(async (i: CatalogItem, b: any) => ({ ...i.preference, ...b })),
    save: vi.fn().mockResolvedValue(rows[0] ?? row()),
  };
  const params = convertToParamMap(['dev', 'co', 'unit'].includes(view) ? { id } : {});
  await TestBed.configureTestingModule({
    imports: [Inventory],
    providers: [
      provideRouter([]),
      { provide: InventoryApi, useValue: { get: vi.fn() } },
      { provide: CatalogApi, useValue: api },
      {
        provide: AuthService,
        useValue: {
          user: signal({
            pool: admin ? 'platform' : 'company_user',
            permissions: admin ? ['co.create', 'co.view'] : ['units.read', 'projects.read'],
          }),
        },
      },
      { provide: AdminUiState, useValue: { lang: signal(ar ? 'ar' : 'en') } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { view }, paramMap: params, queryParamMap: convertToParamMap({}) },
          paramMap: of(params),
          queryParamMap: of(convertToParamMap({})),
        },
      },
    ],
  }).compileComponents();
  TestBed.inject(CompanyUiState).lang.set(ar ? 'ar' : 'en');
  const f = TestBed.createComponent(Inventory);
  await f.componentInstance.load();
  f.detectChanges();
  return { f, api, c: f.componentInstance };
}
describe('Shared inventory catalog', () => {
  it('renders API records with stable UUID routes and no static preview data', async () => {
    const { f, api } = await render('units', [row()]);
    expect(api.list).toHaveBeenCalledWith(
      'units',
      expect.objectContaining({ page: '1', limit: '24' }),
    );
    expect(f.nativeElement.textContent).toContain('Real inventory');
    expect(f.nativeElement.querySelector('a.iv-record-link').getAttribute('href')).toContain(id);
    expect(f.nativeElement.querySelectorAll('.iv-ccard')).toHaveLength(1);
    expect(f.nativeElement.textContent).toContain('Not set');
  });
  it('shows a truthful empty catalog instead of falling back to fake records', async () => {
    const { f } = await render('devs');
    expect(f.nativeElement.querySelectorAll('.iv-dcard')).toHaveLength(0);
    expect(f.nativeElement.textContent).toContain('No catalog records');
  });
  it('sends filters and page changes to the server', async () => {
    const { c, api } = await render('units');
    c.bedrooms.set('3');
    c.status.set('available');
    c.page.set(2);
    await c.load();
    expect(api.list).toHaveBeenLastCalledWith(
      'units',
      expect.objectContaining({ bedrooms: '3', status: 'available', page: '2' }),
    );
  });
  it('keeps exact prices and distinguishes unknown prices from zero', async () => {
    const { c } = await render('unit', [row({ priceMinor: '900719925474099301' })]);
    expect(c.money('900719925474099301')).toBe('EGP 9,007,199,254,740,993.01');
    expect(c.money(null)).toBe('Not set');
    expect(c.money('0')).toBe('EGP 0.00');
  });
  it('persists preferences only after the server succeeds, preserving failures', async () => {
    const r = row();
    const { c, api } = await render('units', [r]);
    api.preference.mockRejectedValueOnce(new Error('Connection failed'));
    await c.preference(r, { favorite: true });
    expect(c.items()[0].preference.favorite).toBe(false);
    expect(c.error()).toBe('Connection failed');
    await c.preference(r, { favorite: true });
    expect(c.items()[0].preference.favorite).toBe(true);
  });
  it('supports direct detail links and Arabic fallback for missing content', async () => {
    const { f, api } = await render('unit', [row()], false, true);
    expect(api.detail).toHaveBeenCalledWith('units', id);
    expect(f.nativeElement.textContent).toContain('مخزون حقيقي');
    expect(f.nativeElement.textContent).toContain('غير محدد');
    expect(f.nativeElement.textContent).not.toContain('First delivery planned');
  });
  it('limits catalog edits to platform editors', async () => {
    const { f } = await render('devs');
    expect(f.nativeElement.textContent).not.toContain('+ Add record');
    TestBed.resetTestingModule();
    const { f: admin } = await render('devs', [], true);
    expect(admin.nativeElement.textContent).toContain('+ Add record');
  });
  it('preserves existing metadata and converts decimal prices exactly when saving', async () => {
    const r = row({
      data: { photos: ['https://example.test/a.jpg'], facilities: [{ en: 'Pool', ar: 'مسبح' }] },
    });
    const { c, api } = await render('unit', [r], true);
    await c.openEditor(r);
    c.draft.price = '9007199254740993.01';
    c.draft.parentId = '803c63e5-d984-433c-ac28-033187db42ee';
    await c.save();
    expect(api.save).toHaveBeenCalledWith(
      'units',
      expect.objectContaining({
        priceMinor: '900719925474099301',
        data: expect.objectContaining({ facilities: r.data.facilities }),
      }),
      id,
    );
  });
  it('shows loading errors and supports retry without displaying preview records', async () => {
    const { c, f, api } = await render('units');
    api.list.mockRejectedValueOnce(new Error('Service unavailable'));
    await c.load();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Service unavailable',
    );
    expect(c.items()).toEqual([]);
    await c.load();
    expect(c.error()).toBe('');
  });
  it('preserves zero values and treats cleared numeric inputs as unknown', async () => {
    const { c, api } = await render('units', [], true);
    await c.openEditor();
    Object.assign(c.draft, {
      name: 'Zero down studio',
      parentId: id,
      price: '0',
      bedrooms: null,
      area: null,
      bathrooms: 0,
      down: 0,
      years: 8,
    });
    await c.save();
    expect(api.save).toHaveBeenCalledWith(
      'units',
      expect.objectContaining({
        area: null,
        bedrooms: null,
        priceMinor: '0',
        data: expect.objectContaining({
          bathrooms: 0,
          paymentPlans: [expect.objectContaining({ downPercent: 0, years: 8 })],
        }),
      }),
      undefined,
    );
  });
  it('reuses the form command ID after a network failure to prevent duplicate records', async () => {
    const { c, api } = await render('devs', [], true);
    await c.openEditor();
    c.draft.name = 'Retry record';
    api.save.mockRejectedValueOnce(new Error('Connection interrupted'));
    await c.save();
    await c.save();
    expect(api.save.mock.calls[0][1]['requestId']).toBe(api.save.mock.calls[1][1]['requestId']);
  });
});
