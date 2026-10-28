import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth.service';
import { Integrations } from './integrations/integrations';
import { SystemHealth } from './system-health/system-health';

describe('Operational dashboard API connections', () => {
  it('loads the registry and persists requested availability with the current version and reason', async () => {
    const calls: Array<[string, unknown]> = [];
    let enabled = false;
    const api = {
      request: async (path: string, body?: any) => {
        calls.push([path, body]);
        if (body) {
          enabled = body.enabled;
          return { status: 'saved', operational: false };
        }
        return [
          {
            key: 'whatsapp',
            nameEn: 'WhatsApp',
            nameAr: 'واتساب',
            category: 'comm',
            enabled,
            version: enabled ? 1 : 0,
            status: enabled ? 'unconfigured' : 'disabled',
            companies: 0,
            lastSync: null,
            errors24h: null,
            log: [],
          },
        ];
      },
    };
    await TestBed.configureTestingModule({
      imports: [Integrations],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(Integrations);
    await f.whenStable();
    f.detectChanges();
    const c = f.componentInstance;
    c.openView(c.items()[0]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Not configured');
    c.askToggle(c.items()[0]);
    c.toggleReason.set('Prepare staging connector');
    await c.confirmToggle();
    f.detectChanges();
    expect(calls[1]).toEqual([
      '/admin/api/v1/integrations/whatsapp/update',
      { version: 0, enabled: true, reason: 'Prepare staging connector' },
    ]);
    expect(c.items()[0].status).toBe('unconfigured');
    expect(f.nativeElement.textContent).toContain('Unconfigured');
  });
  it('shows measured health and marks previous values stale when refresh fails', async () => {
    let failed = false;
    const api = {
      request: async () => {
        if (failed) throw Error('Service unreachable');
        return {
          observedAt: '2026-10-28T20:00:00Z',
          database: { status: 'healthy', latencyMs: 2 },
          redis: { status: 'healthy', latencyMs: 1 },
          uptimeSeconds: 45,
          memoryMb: 96,
          connections: { total: 2, max: 20 },
          metrics: {
            startedAt: '2026-10-28T19:59:15Z',
            p50: 0,
            p95: 4,
            errorRate: 0,
            bars: [{ hour: '2026-10-28T20:00:00Z', observed: true, requests: 10, errors: 0 }],
          },
          alerts: [],
        };
      },
    };
    await TestBed.configureTestingModule({
      imports: [SystemHealth],
      providers: [{ provide: AuthService, useValue: api }],
    }).compileComponents();
    const f = TestBed.createComponent(SystemHealth);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('96 MB');
    expect(f.nativeElement.textContent).toContain('0%');
    expect(f.componentInstance.chartBars()[0].req).toBe(10);
    failed = true;
    await f.componentInstance.load();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Previous data is stale',
    );
  });
});
