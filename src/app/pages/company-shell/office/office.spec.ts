import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { Office } from './office';
import { AuthService, canCreateLead, companyHomePath } from '../../../auth.service';
import { CompanyUiState } from '../company-ui-state';
import { RUNTIME_CONFIG } from '../../../runtime-config';
const client = {
  id: 'client',
  code: 'CL-REAL',
  name: 'Saved buyer',
  phone: '+12025550100',
  owner: { id: 'self', name: 'Saved Sales' },
  version: 4,
  status: 'new',
  source: 'incoming',
  needs: {
    purpose: 'rent',
    areas: ['Maadi'],
    type: 'apartment',
    furnishing: 'furnished',
    rentBudgetMinor: '1000000',
    saleBudgetMinor: null,
  },
  followUpAt: null,
  activities: [],
};
const property = {
  id: 'property',
  code: 'OP-REAL',
  title: 'Saved office apartment',
  responsible: { id: 'other', name: 'Other salesperson' },
  createdBy: { id: 'other', name: 'Other salesperson' },
  canEdit: false,
  status: 'available',
  version: 3,
  data: {
    ownerName: 'Saved Owner',
    ownerPhones: ['+12025550111'],
    address: 'Main Street',
    city: 'Cairo',
    areaName: 'Maadi',
    type: 'apartment',
    furnishing: 'furnished',
    area: 100,
    bedrooms: 2,
    purpose: 'rent',
    rentMinor: '1100000',
    minLeaseMonths: 1,
    photos: [],
  },
};
afterEach(() => TestBed.resetTestingModule());
async function setup(view = 'clients', manage = true) {
  const user = signal<any>({
    id: 'self',
    pool: 'company_user',
    role: 'agent',
    roles: ['agent', 'employee'],
    permissions: [
      'leads.read',
      'units.read',
      ...(manage ? ['leads.manage', 'reservations.read', 'reservations.manage'] : []),
    ],
    company: { type: 'real_estate_office' },
  });
  const request = vi.fn(async (path: string, body?: any): Promise<any> => {
    if (path.endsWith('/options'))
      return { staff: [{ id: 'self', name: 'Saved Sales' }], scope: 'own' };
    if (path.includes('/recommendations?'))
      return {
        items: [
          {
            property,
            priceMinor: '1100000',
            aboveBudgetMinor: '100000',
            aboveBudgetPercent: 10,
            reasons: {
              en: ['Maadi', 'Above budget within 10%'],
              ar: ['المعادي', 'أعلى من الميزانية ضمن ١٠٪'],
            },
          },
        ],
        total: 1,
        purpose: 'rent',
      };
    if (path.includes('/media') && body) return { path: '/api/v1/office/media/file' };
    if (path.includes('/filters')) return { items: [] };
    if (body) return { id: 'saved', version: 5 };
    if (path.endsWith('/clients/client')) return client;
    if (path.endsWith('/properties/property')) return property;
    if (path.includes('/properties?')) return { items: [property], total: 1 };
    if (path.includes('/deals?')) return { items: [], total: 0 };
    return { items: [client], total: 1 };
  });
  TestBed.configureTestingModule({
    imports: [Office],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user, request } },
      { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { officeView: view }, queryParamMap: convertToParamMap({}) },
          queryParamMap: of(convertToParamMap({})),
        },
      },
    ],
  });
  const f = TestBed.createComponent(Office);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request, user };
}
describe('Real estate office workflow', () => {
  it('loads scoped client API records, saves exact monthly budget and exposes office client creation to sales', async () => {
    const { c, f, request, user } = await setup();
    expect(f.nativeElement.textContent).toContain('Saved buyer');
    expect(canCreateLead(user())).toBe(true);
    expect(companyHomePath(user())).toBe('/company/office/dashboard');
    c.begin('client');
    c.form.name = 'New client';
    c.form.phone = '+12025550122';
    c.form.rentBudget = '10k';
    c.form.minBedrooms = 2;
    await c.save();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/clients') && b)?.[1]).toMatchObject({
      data: {
        name: 'New client',
        needs: { purpose: 'rent', rentBudgetMinor: '1000000', minBedrooms: 2 },
      },
    });
    expect(c.mode()).toBeNull();
  });
  it('shows shared office stock without allowing edits to another salesperson property, and filters real server prices', async () => {
    const { c, f, request } = await setup('properties');
    expect(f.nativeElement.textContent).toContain('Saved office apartment');
    expect(
      [...f.nativeElement.querySelectorAll('button')].some(
        (b: any) => b.textContent.trim() === 'Edit',
      ),
    ).toBe(false);
    c.filters = {
      purpose: 'rent',
      minPrice: '10k',
      maxPrice: '11k',
      furnishing: 'furnished',
      areaName: 'Maadi',
    };
    await c.load();
    expect(request.mock.calls.at(-1)?.[0]).toContain('minPrice=1000000');
    expect(request.mock.calls.at(-1)?.[0]).toContain('maxPrice=1100000');
    await c.openDetail(property.id);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Saved Owner');
    expect(f.nativeElement.textContent).toContain('+12025550111');
  });
  it('marks a 10% budget difference, then books the selected client with the current property version', async () => {
    const { c, f, request } = await setup();
    await c.openDetail('client');
    await c.recommend();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('10%');
    expect(f.nativeElement.textContent).toContain('Above budget');
    c.bookMatch(c.matches().items[0]);
    await f.whenStable();
    await c.save();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/bookings') && b)?.[1]).toMatchObject({
      data: { propertyId: 'property', propertyVersion: 3, clientId: 'client', purpose: 'rent' },
    });
  });
  it('closes monthly rent without commission/payroll requests and retains the form on server failure', async () => {
    const { c, request } = await setup('deals');
    const deal = {
      id: 'deal',
      version: 2,
      purpose: 'rent',
      client: { id: 'client' },
      notes: '',
      owner: { id: 'self' },
    };
    c.begin('close', deal);
    c.form.price = '12k';
    c.form.leaseStart = '2027-01-01';
    c.form.leaseEnd = '2027-02-01';
    request.mockRejectedValueOnce(new Error('Property changed; refresh'));
    await c.save();
    expect(c.mode()).toBe('close');
    expect(c.error()).toContain('Property changed');
    await c.save();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/deals/deal') && b)?.[1]).toMatchObject({
      version: 2,
      data: {
        action: 'close',
        priceMinor: '1200000',
        leaseStart: '2027-01-01',
        leaseEnd: '2027-02-01',
      },
    });
    expect(request.mock.calls.some(([p]) => /finance|commission/.test(p))).toBe(false);
  });
  it('supports photos, saved filters and Arabic labels without preview data', async () => {
    const { c, f, request } = await setup('properties');
    c.begin('property');
    await c.uploadFiles(
      {
        target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })], value: '' },
      } as any,
      'photo',
    );
    expect(c.form.photos).toBe('https://api.example.test/api/v1/office/media/file');
    expect(request.mock.calls.some(([p, b]) => p.endsWith('/media') && b instanceof FormData)).toBe(
      true,
    );
    c.mode.set(null);
    c.filters = { purpose: 'rent', maxPrice: '10k' };
    c.filterName = 'Rent list';
    await c.saveFilters();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/filters') && b)?.[1]).toMatchObject({
      data: { filters: { purpose: 'rent', maxPrice: '1000000' } },
    });
    TestBed.inject(CompanyUiState).lang.set('ar');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('عقارات المكتب');
  });
  it('hides write controls for read-only access and shows a truthful empty result', async () => {
    const { c, f, request } = await setup('clients', false);
    expect(f.nativeElement.textContent).not.toContain('+ New client');
    request.mockResolvedValueOnce({ items: [], total: 0 });
    await c.load();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No matching records');
    expect(f.nativeElement.textContent).not.toContain('Saved buyer');
  });
});
