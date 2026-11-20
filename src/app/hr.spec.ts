import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hr } from './pages/company-shell/hr/hr';
import { AuthService } from './auth.service';
import { RUNTIME_CONFIG } from './runtime-config';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
const options = {
  employees: [{ id: 'person', name: 'Operations Employee', status: 'active' }],
  departments: [{ id: 'department', name: 'Operations', archived: false }],
  users: [],
};
async function setup(view = 'employees', queryEmployee = '') {
  const request = vi.fn(async (path: string, _body?: unknown): Promise<any> =>
    path.includes('/options')
      ? options
      : path.includes('/overview')
        ? { employees: 1, active: 1, onboarding: 0, overdue: 0 }
        : {
            items: [
              {
                id: 'person',
                name: 'Operations Employee',
                employeeCode: 'HR-1',
                jobTitle: 'Coordinator',
                status: 'active',
                employmentType: 'full_time',
                userId: null,
                version: 2,
                openTasks: 4,
                kind: 'contract',
                sizeBytes: 12,
                title: 'Contract',
                employee: 'Operations Employee',
                fileName: 'contract.txt',
              },
            ],
            total: 1,
          },
  );
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { request } },
      { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { hrView: view }, queryParamMap: { get: () => queryEmployee || null } },
        },
      },
    ],
  });
  const f = TestBed.createComponent(Hr);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
afterEach(() => TestBed.resetTestingModule());
describe('HR workspace', () => {
  it('renders real staff with missing login setup and requests only HR data', async () => {
    const { f, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Operations Employee');
    expect(f.nativeElement.textContent).toContain('Email required');
    expect(request.mock.calls.map((c) => c[0])).toContain('/api/v1/hr/options');
    expect(request.mock.calls.every((c) => c[1] === undefined)).toBe(true);
  });
  it('creates an HR record with optional CRM fields null and preserves failed forms', async () => {
    const { c, request } = await setup();
    c.show();
    c.form.name = 'New Employee';
    await c.save();
    const call = request.mock.calls.find((c) => c[0] === '/api/v1/hr/employees');
    expect(call?.[1]).toMatchObject({
      name: 'New Employee',
      userId: null,
      managerId: null,
      email: null,
      joiningDate: null,
    });
    expect(call?.[1]).not.toHaveProperty('employeeCode');
    expect(c.open()).toBe(false);
    c.show();
    request.mockRejectedValueOnce(new Error('Employee code already used'));
    await c.save();
    expect(c.open()).toBe(true);
    expect(c.formError()).toContain('already used');
  });
  it('removes employee onboarding and defaults new staff to active', async () => {
    const { c, f } = await setup('employees');
    expect(f.nativeElement.textContent).not.toContain('Onboarding');
    expect(f.nativeElement.querySelector('a[href="/company/hr/onboarding"]')).toBeNull();
    c.show();
    expect(c.form.status).toBe('active');
  });
  it('uploads private files as multipart and validates missing file before network', async () => {
    const { c, request } = await setup('documents');
    c.show();
    c.form = { employeeId: 'person', title: 'Contract', kind: 'contract', expiresDate: '' };
    await c.save();
    expect(c.formError()).toContain('Choose a document');
    c.file = new File(['private file'], 'contract.txt', { type: 'text/plain' });
    await c.save();
    const call = request.mock.calls.find((c) => c[0] === '/api/v1/hr/documents');
    expect(call?.[1]).toBeInstanceOf(FormData);
    expect((call?.[1] as FormData).get('employeeId')).toBe('person');
  });
});
