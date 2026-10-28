import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../auth.service';
import { SupportTickets } from './support-tickets/support-tickets';
import { Announcements } from './announcements/announcements';

describe('Support and announcements API screens', () => {
  it('loads real ticket data and preserves the reply draft when a stale mutation is rejected', async () => {
    const calls: Array<[string, any]> = [];
    const ticket = {
      id: 'T-REAL',
      companyEn: 'Real Company',
      companyAr: 'شركة حقيقية',
      subjectEn: 'Real ticket',
      subjectAr: 'تذكرة حقيقية',
      category: 'tech',
      priority: 'high',
      status: 'open',
      assigned: null,
      assignedTo: null,
      created: '2026-10-28T12:00:00Z',
      updated: '2026-10-28T12:00:00Z',
      requester: 'Actual requester',
      slaDue: '2026-10-28T20:00:00Z',
      version: 4,
      messages: [
        {
          author: 'agent',
          textEn: 'Recorded intake',
          textAr: 'Recorded intake',
          time: '2026-10-28T12:00:00Z',
        },
      ],
      notes: [],
      requests: [],
    };
    const api = {
      user: signal({ id: 'actor', permissions: ['support', 'ws.read'] }),
      request: async (path: string, body?: any) => {
        calls.push([path, body]);
        if (body) throw Error('Ticket changed. Refresh first.');
        if (path.endsWith('/options')) return { companies: [], agents: [] };
        if (path.endsWith('/T-REAL')) return ticket;
        return {
          items: [ticket],
          total: 1,
          kpis: { open: 1, waiting: 0, overdue: 0, resolved: 0, active: 1 },
        };
      },
    };
    await TestBed.configureTestingModule({
      imports: [SupportTickets],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(SupportTickets);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Real ticket');
    await f.componentInstance.openTicket(ticket as any);
    f.componentInstance.replyDraft.set('Do not lose this reply');
    await f.componentInstance.sendReply();
    f.detectChanges();
    expect(calls.at(-1)).toEqual([
      '/admin/api/v1/support-tickets/T-REAL/entries',
      { version: 4, kind: 'reply', text: 'Do not lose this reply' },
    ]);
    expect(f.componentInstance.replyDraft()).toBe('Do not lose this reply');
    expect(f.nativeElement.textContent).toContain('Ticket changed. Refresh first.');
  });
  it('saves bilingual publication settings using UTC dates and withdraws through save-as-draft', async () => {
    const calls: Array<[string, any]> = [];
    let rows: any[] = [];
    const api = {
      request: async (path: string, body?: any) => {
        calls.push([path, body]);
        if (body) {
          rows = [
            {
              id: 'ANN-REAL',
              ...body,
              version: body.version + 1,
              status: body.published ? 'scheduled' : 'draft',
            },
          ];
          return rows[0];
        }
        return { items: rows, total: rows.length };
      },
    };
    await TestBed.configureTestingModule({
      imports: [Announcements],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(Announcements);
    await f.whenStable();
    f.componentInstance.openCreate();
    f.componentInstance.draft = {
      titleEn: 'Approved update',
      titleAr: 'تحديث معتمد',
      bodyEn: 'Approved body',
      bodyAr: 'نص معتمد',
      type: 'update',
      target: 'pro',
      from: '2030-10-28T10:00',
      to: '2030-10-29T10:00',
      lang: 'both',
    };
    await f.componentInstance.publish();
    f.detectChanges();
    const publish = calls.find((c) => c[1]);
    expect(publish?.[0]).toBe('/admin/api/v1/announcements');
    expect(publish?.[1].published).toBe(true);
    expect(publish?.[1].from.endsWith('Z')).toBe(true);
    expect(publish?.[1].target).toBe('pro');
    expect(f.nativeElement.textContent).toContain('Scheduled');
    f.componentInstance.openEdit(rows[0]);
    await f.componentInstance.saveDraft();
    const update = calls.filter((c) => c[1]).at(-1);
    expect(update?.[0]).toBe('/admin/api/v1/announcements/ANN-REAL/update');
    expect(update?.[1].version).toBe(1);
    expect(update?.[1].published).toBe(false);
  });
});
