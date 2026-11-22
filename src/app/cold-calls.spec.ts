import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ColdCalls } from './pages/company-shell/cold-calls/cold-calls';
import { AuthService } from './auth.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { RUNTIME_CONFIG } from './runtime-config';
afterEach(() => TestBed.resetTestingModule());
async function setup(manage = true) {
  const request = vi.fn(async (path: string, body?: any): Promise<any> => {
    if (path.includes('/preview'))
      return {
        valid: 1,
        duplicates: 1,
        rejected: 1,
        errors: [],
        sample: [{ row: 2, name: 'Old contact', phone: '+12025550199' }],
      };
    if (path.includes('/import')) return { imported: 1, duplicates: 1, rejected: 1, errors: [] };
    if (path.includes('/convert')) return { leadId: 'lead-1' };
    if (path.includes('options')) return { owners: [{ id: 'self', name: 'Sales' }] };
    return {
      items: [
        { id: 'cold-1', name: 'Old contact', phone: '+12025550199', owner: 'Sales', version: 0 },
      ],
      total: 1,
    };
  });
  TestBed.configureTestingModule({
    imports: [ColdCalls],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          request,
          user: () => ({ permissions: manage ? ['leads.read', 'leads.manage'] : ['leads.read'] }),
        },
      },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
      { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
    ],
  });
  const f = TestBed.createComponent(ColdCalls);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
describe('Cold calls', () => {
  it('renders persisted contacts and keeps importing separate from CRM lead creation', async () => {
    const { f, c, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Old contact');
    await c.openImport();
    c.fileChanged({
      target: { files: [new File(['name,phone\nOld contact,+12025550199'], 'contacts.csv')] },
    } as any);
    await c.upload();
    expect(c.preview().valid).toBe(1);
    expect(request.mock.calls.some(([p]) => p.endsWith('/import'))).toBe(false);
    await c.upload(true);
    expect(c.result().imported).toBe(1);
    expect(request.mock.calls.some(([p]) => p === '/api/v1/leads')).toBe(false);
    const form = request.mock.calls.find(([p]) => p.endsWith('/import'))![1] as FormData;
    expect(form.get('requestId')).toBeTruthy();
  });
  it('converts only after entering needs and sends a versioned idempotent request', async () => {
    const { c, request } = await setup();
    c.startConvert(c.rows()[0]);
    await c.convert();
    expect(request.mock.calls.some(([p]) => p.includes('/convert'))).toBe(false);
    c.want = 'Apartment';
    await c.convert();
    expect(request.mock.calls.find(([p]) => p.includes('/convert'))![1]).toMatchObject({
      version: 0,
      segment: 'res',
      want: 'Apartment',
    });
    expect(c.leadId()).toBe('lead-1');
  });
  it('keeps read-only access free of import and conversion controls', async () => {
    const { f } = await setup(false);
    const labels = [...f.nativeElement.querySelectorAll('button')].map((b: any) => b.textContent);
    expect(labels.some((x) => x.includes('Import file'))).toBe(false);
    expect(labels.some((x) => x.includes('Convert to lead'))).toBe(false);
  });
});
