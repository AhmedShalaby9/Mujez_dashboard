import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Leads } from './pages/company-shell/leads/leads';
import { Pipeline } from './pages/company-shell/pipeline/pipeline';
import { AuthService, ApiError } from './auth.service';
import {
  SalesApi,
  salesMoney,
  minorAmount,
  majorAmount,
  type SalesLead,
} from './sales-api.service';
const lead: SalesLead = {
  id: 'lead-1',
  reference: 'L-REAL',
  name: { en: 'Actual Buyer', ar: 'مشتري فعلي' },
  phone: '+201012345678',
  segment: 'res',
  want: { en: 'Apartment', ar: 'شقة' },
  budgetMinor: '125050',
  currency: 'EGP',
  source: 'manual',
  owner: { id: 'owner', name: 'Actual Owner' },
  stage: 'new',
  score: null,
  version: 1,
  archivedAt: null,
  createdAt: '2026-10-29T10:00:00Z',
  updatedAt: '2026-10-29T10:00:00Z',
  sample: false,
  opportunity: null,
};
const user = () =>
  signal({
    id: 'owner',
    permissions: [
      'workspace.view',
      'leads.read',
      'leads.manage',
      'pipeline.read',
      'pipeline.manage',
    ],
  });
describe('Company sales screens', () => {
  it('formats money exactly and rejects imprecise or invalid inputs', () => {
    expect(salesMoney('900719925474099399')).toBe('EGP 9,007,199,254,740,993.99');
    expect(minorAmount('001.05')).toBe('105');
    expect(minorAmount('', true)).toBeNull();
    expect(majorAmount('125050')).toBe('1250.50');
    expect(() => minorAmount('1.001')).toThrow();
    expect(() => minorAmount('EGP 10M')).toThrow();
  });
  it('loads real leads and activity, uses server filters, persists edits and notes', async () => {
    const calls: any[] = [];
    let row = { ...lead };
    const api = {
      get: async (path: string, q: any) => {
        calls.push({ path, q });
        if (path === 'leads/options') return { owners: [{ id: 'owner', name: 'Actual Owner' }] };
        if (path === 'leads') return { items: [row], total: 1 };
        if (path.endsWith('/activities'))
          return {
            items: [
              {
                id: 'activity',
                kind: 'lead.note_added',
                details: { note: 'Recorded buyer call' },
                actor: 'Actual Owner',
                at: '2026-10-29T10:00:00Z',
              },
            ],
            total: 1,
          };
        return row;
      },
      write: async (path: string, b: any) => {
        calls.push({ path, body: b });
        row = { ...row, version: row.version + 1 };
        return row;
      },
    };
    await TestBed.configureTestingModule({
      imports: [Leads],
      providers: [
        { provide: SalesApi, useValue: api },
        { provide: AuthService, useValue: { user: user() } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Leads);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(f.nativeElement.textContent).toContain('Actual Buyer');
    expect(f.nativeElement.textContent).not.toContain('Ahmed Samir');
    expect(f.nativeElement.textContent).toContain('EGP 1,250.50');
    c.stageFilter.set('qualified');
    await c.reload();
    expect(calls.filter((x) => x.path === 'leads').at(-1).q.stage).toBe('qualified');
    await c.open(lead.id);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Recorded buyer call');
    c.note.set('Actual note');
    await c.mutate('notes');
    expect(calls.find((x) => x.body?.note === 'Actual note').body.version).toBe(1);
    c.openNew(row);
    c.draft.want = 'Office';
    await c.submit();
    expect(
      calls.some((x) => x.path === 'leads/' + lead.id + '/update' && x.body.want === 'Office'),
    ).toBe(true);
  });
  it('uses backend duplicate candidates and persists an explicit linked override, preserving its request ID on retry', async () => {
    const sent: any[] = [];
    const api = {
      get: async (path: string) =>
        path === 'leads/options'
          ? { owners: [] }
          : path === 'leads'
            ? { items: [], total: 0 }
            : path.endsWith('/activities')
              ? { items: [], total: 0 }
              : lead,
      write: async (path: string, b: any) => {
        sent.push(b);
        if (sent.length === 1)
          throw new ApiError(409, {
            code: 'duplicate_lead',
            message: 'Duplicate',
            duplicates: [{ id: lead.id, name: lead.name, reference: lead.reference }],
          });
        return { ...lead, id: 'new-linked' };
      },
    };
    await TestBed.configureTestingModule({
      imports: [Leads],
      providers: [
        { provide: SalesApi, useValue: api },
        { provide: AuthService, useValue: { user: user() } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Leads);
    await f.whenStable();
    const c = f.componentInstance;
    c.openNew();
    c.draft.name = 'Actual Buyer';
    c.draft.phone = lead.phone;
    c.draft.budget = '100.10';
    await c.submit();
    expect(c.dupOpen()).toBe(true);
    expect(c.duplicateId()).toBe('lead-1');
    c.dupReason.set('Shared number confirmed with buyer');
    await c.submit('link');
    expect(sent[1].duplicateMode).toBe('link');
    expect(sent[1].duplicateOf).toBe('lead-1');
    expect(sent[1].budgetMinor).toBe('10010');
    expect(sent[1].requestId).toBe(sent[0].requestId);
  });
  it('does not show writes without permission and marks API failures rather than inventing rows', async () => {
    const u = user();
    u.set({ ...u(), permissions: ['workspace.view', 'leads.read'] });
    const api = {
      get: async (path: string) => {
        if (path === 'leads/options') return { owners: [] };
        throw Error('Subscription required');
      },
    };
    await TestBed.configureTestingModule({
      imports: [Leads],
      providers: [
        { provide: SalesApi, useValue: api },
        { provide: AuthService, useValue: { user: u } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Leads);
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.leads()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('Subscription required');
    expect(f.nativeElement.textContent).not.toContain('+ New lead');
  });
  it('pipeline uses server aggregates for all pages and only changes stages after a successful persisted write', async () => {
    let stage = 'new';
    const calls: any[] = [];
    const api = {
      get: async () => ({
        items: [
          {
            id: 'deal',
            reference: 'D-REAL',
            leadId: lead.id,
            leadReference: lead.reference,
            title: { en: 'Real deal', ar: 'فرصة' },
            contact: lead.name,
            valueMinor: '10000',
            type: 'sale',
            owner: lead.owner,
            stage,
            version: 0,
            leadVersion: 1,
            sample: false,
          },
        ],
        total: 2,
        stats: [
          { stage: 'new', count: 2, saleMinor: '99999' },
          { stage: 'qualified', count: 0, saleMinor: '0' },
        ],
      }),
      write: async (path: string, b: any) => {
        calls.push({ path, b });
        stage = b.stage;
        return {};
      },
    };
    await TestBed.configureTestingModule({
      imports: [Pipeline],
      providers: [
        { provide: SalesApi, useValue: api },
        { provide: AuthService, useValue: { user: user() } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Pipeline);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(c.columns()[0].total).toBe('99999');
    expect(c.columns()[0].count).toBe(2);
    expect(f.nativeElement.textContent).toContain('Real deal');
    await c.move(c.deals()[0], 'qualified');
    expect(calls[0].path).toBe('pipeline/deal/stage');
    expect(calls[0].b.version).toBe(1);
    expect(c.deals()[0].stage).toBe('qualified');
    api.write = async () => {
      throw Error('Lead changed. Refresh first.');
    };
    await c.move(c.deals()[0], 'viewing');
    expect(c.deals()[0].stage).toBe('qualified');
    expect(c.error()).toContain('Lead changed');
  });
});
