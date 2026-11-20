import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Attendance } from './pages/company-shell/attendance/attendance';
import { AuthService, companyGuard } from './auth.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
const context = {
  self: { id: 'staff', status: 'active' },
  hasSelfRole: true,
  isManager: false,
  canCompany: false,
  canManage: false,
  today: '2026-11-20',
  serverNow: '2026-11-20T08:00:00Z',
  openRecord: null,
  dayRecord: null,
  shift: {
    name: 'Office',
    start: '2026-11-20T07:00:00Z',
    end: '2026-11-20T15:00:00Z',
    workDate: '2026-11-20',
  },
};
const report = {
  items: [
    {
      employeeId: 'staff',
      employee: 'Real Employee',
      employeeCode: 'EMP-0012',
      date: '2026-11-20',
      schedule: 'Office',
      status: 'late',
      checkIn: '2026-11-20T07:20:00Z',
      checkOut: null,
      workedMinutes: 0,
      lateMinutes: 5,
      missingCheckout: false,
    },
  ],
  total: 1,
  monthly: [
    {
      employeeId: 'staff',
      employee: 'Real Employee',
      present: 0,
      late: 1,
      absent: 0,
      leaveDays: 0,
      workedMinutes: 0,
      lateMinutes: 5,
      missingCheckout: 0,
    },
  ],
  summary: { present: 0, late: 1, absent: 0, leaveDays: 0, workedMinutes: 0, missingCheckout: 0 },
  calendarAvailable: true,
};
async function setup(mode = 'my') {
  const request = vi.fn(async (path: string, body?: any): Promise<any> => {
    if (body) return { id: 'saved' };
    if (path.endsWith('/context'))
      return {
        ...context,
        canCompany: mode === 'company' || mode === 'schedules',
        canManage: mode === 'company' || mode === 'schedules',
        isManager: mode === 'team',
      };
    if (path.includes('/report?')) return report;
    if (path.includes('/corrections?')) return { items: [], total: 0 };
    if (path.endsWith('/schedules'))
      return {
        items: [
          {
            id: 'schedule',
            name: 'Office',
            workdays: [0, 1, 2, 3, 4],
            startMinute: 540,
            endMinute: 1020,
            graceMinutes: 15,
            version: 2,
            archived: false,
          },
        ],
      };
    if (path.endsWith('/options'))
      return {
        employees: [{ id: 'staff', name: 'Real Employee', departmentId: 'department' }],
        departments: [{ id: 'department', name: 'Operations' }],
      };
    if (path.includes('/assignments?')) return { items: [], total: 0 };
    return {};
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { request } },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { attendanceView: mode } } } },
    ],
  });
  const f = TestBed.createComponent(Attendance);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
afterEach(() => TestBed.resetTestingModule());
describe('Attendance workspace', () => {
  it('renders persisted personal data and submits only a server-time punch action', async () => {
    const { f, c, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Real Employee');
    expect(f.nativeElement.textContent).toContain('5m');
    expect(request.mock.calls.some(([p]) => p.includes('view=my'))).toBe(true);
    await c.punch('in');
    const call = request.mock.calls.find(([p, b]) => p.endsWith('/punch') && b);
    expect(call?.[1]).toEqual({ requestId: expect.any(String), action: 'in' });
    expect(call?.[1]).not.toHaveProperty('employeeId');
    expect(c.time('2026-11-20T07:00:00Z')).toContain('09:00');
  });
  it('saves versioned templates and department assignments, keeping failed forms available', async () => {
    const { c, request } = await setup('schedules');
    c.editSchedule(c.schedules()[0]);
    c.form.name = 'Updated Office';
    await c.save();
    expect(
      request.mock.calls.find(([p, b]) => p.endsWith('/schedules/schedule') && b)?.[1],
    ).toMatchObject({
      version: 2,
      startMinute: 540,
      endMinute: 1020,
      graceMinutes: 15,
      workdays: [0, 1, 2, 3, 4],
    });
    c.assign();
    c.form = {
      scheduleId: 'schedule',
      target: 'department',
      targetId: 'department',
      effectiveFrom: '2026-11-21',
    };
    await c.save();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/assignments') && b)?.[1]).toMatchObject(
      { target: 'department', targetId: 'department', effectiveFrom: '2026-11-21' },
    );
    c.editSchedule();
    c.form.workdays = [1];
    request.mockRejectedValueOnce(new Error('Schedule changed'));
    await c.save();
    expect(c.dialog()).toBe('schedule');
    expect(c.formError()).toBe('Schedule changed');
  });
  it('uses Cairo local correction inputs and the server-provided review permissions', async () => {
    const { f, c, request } = await setup();
    c.correct(report.items[0]);
    expect(c.form.checkIn).toBe('2026-11-20T09:20');
    c.form.reason = 'Missed correct check in';
    c.form.checkOut = '2026-11-20T17:00';
    await c.save();
    expect(request.mock.calls.find(([p, b]) => p.endsWith('/corrections') && b)?.[1]).toMatchObject(
      {
        workDate: '2026-11-20',
        checkIn: '2026-11-20T09:20',
        checkOut: '2026-11-20T17:00',
        reason: 'Missed correct check in',
      },
    );
    c.activeTab.set('corrections');
    c.corrections.set({
      items: [
        {
          id: 'request',
          employee: 'Real Employee',
          date: '2026-11-20',
          status: 'pending',
          version: 3,
          canReview: false,
          canCancel: true,
        },
      ],
      total: 1,
    });
    f.detectChanges();
    expect(
      [...f.nativeElement.querySelectorAll('button')].some(
        (b: any) => b.textContent.trim() === 'Approve',
      ),
    ).toBe(false);
    c.review({ id: 'request', version: 3 }, 'reject');
    c.form.note = 'Times need verification';
    await c.save();
    expect(
      request.mock.calls.find(([p, b]) => p.endsWith('/corrections/request/action') && b)?.[1],
    ).toMatchObject({ version: 3, action: 'reject', note: 'Times need verification' });
  });
  it('does not retain private rows after access fails and never invents absences during a calendar outage', async () => {
    const { c, f, request } = await setup();
    c.report.set({ ...report, calendarAvailable: false, summary: { absent: 0 } });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('holiday calendar is temporarily unavailable');
    request.mockRejectedValueOnce(new Error('Access revoked'));
    await c.reload();
    expect(c.report().items).toEqual([]);
    expect(c.corrections().items).toEqual([]);
    expect(c.error()).toBe('Access revoked');
  });
});
describe('Attendance route gates', () => {
  it('checks module access and current reporting-manager authority', async () => {
    const user = signal<any>({
      pool: 'company_user',
      role: 'employee',
      roles: ['employee'],
      permissions: ['leave.self'],
      company: { hrEnabled: true },
    });
    const request = vi.fn(async () => ({ isManager: false }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, request, restore: async () => true } },
      ],
    });
    const check = (attendanceView: string, hrAccess = false) =>
      TestBed.runInInjectionContext(() =>
        companyGuard({ data: { attendanceView, hrAccess } } as any, {} as any),
      );
    expect(await check('my')).toBe(true);
    expect(await check('team')).toBeInstanceOf(UrlTree);
    expect(await check('company', true)).toBeInstanceOf(UrlTree);
    request.mockResolvedValueOnce({ isManager: true });
    expect(await check('team')).toBe(true);
    user.set({ ...user(), company: { hrEnabled: false } });
    const denied = await check('my');
    expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/company/employee');
  });
});
