import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../auth.service';
import { PlatformConfig } from '../../platform-config.service';
import { AuditLogs } from './audit-logs/audit-logs';
import { Settings } from './settings/settings';

describe('Audit and settings screens', () => {
  it('uses server filters and cursors, and fetches actual before/after details', async () => {
    const calls: string[] = [];
    const event = {
      id: '00000000-0000-4000-8000-000000000001',
      time: '2026-10-28T20:00:00Z',
      actor: 'Actual Root',
      actionEn: 'settings.updated',
      actionAr: 'settings.updated',
      resource: 'platform_settings',
      severity: 'high',
      isWorkspace: false,
      result: 'success',
      ip: null,
    };
    const api = {
      request: async (path: string) => {
        calls.push(path);
        if (!path.includes('?'))
          return { ...event, before: { platformName: 'Old' }, after: { platformName: 'New' } };
        return {
          items: [event],
          kpis: { total: 2, high: 2, workspace: 0 },
          nextCursor: calls.length === 1 ? 'cursor-value' : null,
          until: '2026-10-28T20:01:00Z',
        };
      },
    };
    await TestBed.configureTestingModule({
      imports: [AuditLogs],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(AuditLogs);
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.kpis().total).toBe(2);
    await c.load(true);
    expect(calls[1]).toContain('cursor=cursor-value');
    await c.openView(event as any);
    expect(c.before(c.viewing()!)).toContain('Old');
    expect(c.after(c.viewing()!)).toContain('New');
  });
  it('loads persisted settings, sends real reauthentication, and preserves unsaved values after conflict', async () => {
    let submitted: any;
    const value = {
      platformName: 'Actual name',
      supportEmail: '',
      defaultLang: 'en',
      defaultTimezone: 'Africa/Cairo',
      trialDays: 14,
      defaultPlan: 'starter',
      defaultCurrency: 'EGP',
      invoiceFormat: 'INV-{UUID}',
      paymentTerms: 0,
      taxRate: 0,
      taxProfile: 'manual',
      requireMfa: false,
      sessionLength: 480,
      managementMaxMinutes: 0,
      ipAllowlist: '',
      lockoutAttempts: 10,
      notifyPaymentFailed: false,
      notifyTrialEnding: false,
      notifyTicketAssigned: false,
      notifyIncident: false,
      supportUrl: '',
      primaryColor: '#4945CC',
    };
    const api = {
      user: signal({ role: 'super_admin' }),
      request: async (path: string, body?: unknown) => {
        if (body) {
          submitted = body;
          throw Error('Settings changed. Reload before saving');
        }
        return { value, version: 5 };
      },
    };
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: AuthService, useValue: api },
        {
          provide: PlatformConfig,
          useValue: { branding: signal({ defaultLang: 'en' }), load: async () => {} },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Settings);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    expect(c.state.platformName).toBe('Actual name');
    c.state.platformName = 'Unsaved name';
    c.saveCode.set('actual-password');
    c.reason.set('Verify settings persistence');
    await c.confirmSave();
    expect(submitted.version).toBe(5);
    expect(submitted.password).toBe('actual-password');
    expect(c.state.platformName).toBe('Unsaved name');
    expect(c.error()).toContain('Reload');
  });
});
