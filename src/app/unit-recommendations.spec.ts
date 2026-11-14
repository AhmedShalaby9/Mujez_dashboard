import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LeadUnitRecommendations } from './pages/company-shell/leads/lead-unit-recommendations';
import { SalesApi, type SalesLead } from './sales-api.service';
import { AuthService } from './auth.service';
const lead: SalesLead = {
  id: 'b60c53cf-fc4d-46ca-9d3c-53ba718d647a',
  reference: 'L-AI',
  name: { en: 'Private buyer', ar: 'عميل' },
  phone: '+201012345678',
  email: 'private@example.test',
  want: { en: 'Apartment', ar: 'شقة' },
  segment: 'res',
  budgetMinor: '1000000000',
  currency: 'EGP',
  source: 'manual',
  owner: null,
  stage: 'new',
  score: null,
  version: 3,
  archivedAt: null,
  createdAt: '2026-11-14',
  updatedAt: '2026-11-14',
  sample: false,
  opportunity: null,
};
const item = {
  unit: {
    id: 'b9dbe966-a8f6-438f-8251-e379e377c425',
    name: { en: 'Real apartment', ar: 'شقة حقيقية' },
    priceMinor: '1050000000',
    currency: 'EGP',
    area: '180.00',
    bedrooms: 3,
    type: 'apt',
    location: { en: 'New Cairo', ar: 'القاهرة الجديدة' },
    deliveryYear: 2027,
    cover: null,
    reference: { asOf: '2026-10-14', aiCover: false },
    compound: { id: 'c', name: { en: 'Compound', ar: 'كمباوند' } },
    developer: { id: 'd', name: { en: 'Developer', ar: 'مطوّر' } },
  },
  reasons: [{ en: '3 bedrooms', ar: '٣ غرف' }],
  warnings: [{ en: 'Above budget by EGP 500,000.00 (5.00%).', ar: 'أعلى من الميزانية' }],
  overBudgetMinor: '50000000',
};
const complete = {
  id: 'run-1',
  status: 'succeeded',
  preferences: {},
  error: null,
  result: {
    items: [item],
    eligibleCount: 45,
    shortlistedCount: 30,
    needsMoreInfo: false,
    budgetMinor: lead.budgetMinor,
    ceilingMinor: '1100000000',
    needs: {
      types: ['apt'],
      locations: ['New Cairo'],
      minBedrooms: 3,
      maxBedrooms: 3,
      minArea: null,
      maxArea: null,
      maxDeliveryYear: 2028,
    },
    generatedAt: '2026-11-14T10:00:00Z',
  },
};
async function render(options: { readOnly?: boolean; latest?: any } = {}) {
  let current = options.latest ?? null;
  const api = {
    get: vi
      .fn()
      .mockImplementation(async (path: string) =>
        path.endsWith('/options')
          ? { locations: [{ en: 'New Cairo', ar: 'القاهرة الجديدة' }] }
          : path.endsWith('/unit-recommendations')
            ? { run: current }
            : current,
      ),
    write: vi.fn().mockImplementation(async () => ({
      id: 'run-1',
      status: 'processing',
      preferences: {},
      error: null,
      result: null,
    })),
  };
  await TestBed.configureTestingModule({
    imports: [LeadUnitRecommendations],
    providers: [
      provideRouter([]),
      { provide: SalesApi, useValue: api },
      {
        provide: AuthService,
        useValue: {
          user: signal({
            permissions: ['leads.read', 'units.read'],
            workspace: options.readOnly ? { mode: 'read' } : undefined,
          }),
        },
      },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(LeadUnitRecommendations);
  f.componentRef.setInput('lead', lead);
  f.detectChanges();
  await f.whenStable();
  await vi.waitFor(() => {
    f.detectChanges();
    expect(f.componentInstance.loading()).toBe(false);
  });
  f.detectChanges();
  return { f, c: f.componentInstance, api, setCurrent: (r: any) => (current = r) };
}
describe('Lead unit recommendations', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('loads saved results without making paid requests and shows the actual 10% policy', async () => {
    const { f, api } = await render();
    expect(api.write).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('10%');
    expect(f.nativeElement.textContent).toContain('EGP 10,000,000.00');
  });
  it('starts a job with only explicit preferences, then displays actual unit links and over-budget warnings', async () => {
    const { f, c, api, setCurrent } = await render();
    c.preferences.location = 'New Cairo';
    c.preferences.minBedrooms = 3;
    await c.generate();
    expect(api.write).toHaveBeenCalledWith(
      `leads/${lead.id}/unit-recommendations`,
      expect.objectContaining({
        leadVersion: 3,
        preferences: { location: 'New Cairo', minBedrooms: 3 },
      }),
    );
    const sent = JSON.stringify(api.write.mock.calls);
    expect(sent).not.toContain(lead.phone);
    expect(sent).not.toContain(lead.email);
    expect(sent).not.toContain(lead.name.en);
    setCurrent(complete);
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Real apartment');
    expect(f.nativeElement.textContent).toContain('Above budget by EGP 500,000.00');
    expect(f.nativeElement.querySelector('a.ai-view').getAttribute('href')).toContain(item.unit.id);
  });
  it('shows provider failure and stale states without fake matches', async () => {
    const { f, c, setCurrent } = await render({
      latest: { id: 'run-1', status: 'processing', error: null, result: null, preferences: {} },
    });
    setCurrent({
      id: 'run-1',
      status: 'failed',
      result: null,
      preferences: {},
      error: { code: 'provider_unavailable', message: 'AI provider unavailable' },
    });
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('AI provider unavailable');
    expect(f.nativeElement.querySelector('.ai-match')).toBeNull();
    setCurrent({
      ...complete,
      status: 'stale',
      result: null,
      error: { code: 'lead_or_catalog_changed' },
    });
    await c.refresh();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Generate fresh recommendations');
  });
  it('blocks generation in read-only workspace sessions', async () => {
    const { c, api, f } = await render({ readOnly: true });
    await c.generate();
    expect(api.write).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('.ai-generate').disabled).toBe(true);
  });
  it('reuses the request ID after a network error', async () => {
    const { c, api } = await render();
    api.write.mockRejectedValueOnce(new Error('Network interrupted'));
    await c.generate();
    await c.generate();
    expect(api.write.mock.calls[0][1]['requestId']).toBe(api.write.mock.calls[1][1]['requestId']);
  });
  it('renders no-match results as an empty state instead of preview units', async () => {
    const { f } = await render({
      latest: { ...complete, result: { ...complete.result, items: [], eligibleCount: 0 } },
    });
    expect(f.nativeElement.textContent).toContain('No available primary units');
    expect(f.nativeElement.querySelector('.ai-match')).toBeNull();
  });
});
