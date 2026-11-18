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
  it('renders real staff without CRM access and requests only HR data', async () => {
    const { f, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Operations Employee');
    expect(f.nativeElement.textContent).toContain('No CRM account');
    expect(request.mock.calls.map((c) => c[0])).toContain('/api/v1/hr/options');
    expect(request.mock.calls.every((c) => c[1] === undefined)).toBe(true);
  });
  it('creates an HR record with optional CRM fields null and preserves failed forms', async () => {
    const { c, request } = await setup();
    c.show();
    c.form.employeeCode = 'HR-2';
    c.form.name = 'New Employee';
    await c.save();
    const call = request.mock.calls.find((c) => c[0] === '/api/v1/hr/employees');
    expect(call?.[1]).toMatchObject({
      employeeCode: 'HR-2',
      name: 'New Employee',
      userId: null,
      managerId: null,
      email: null,
      joiningDate: null,
    });
    expect(c.open()).toBe(false);
    c.show();
    request.mockRejectedValueOnce(new Error('Employee code already used'));
    await c.save();
    expect(c.open()).toBe(true);
    expect(c.formError()).toContain('already used');
  });
  it('sends employee checklist filters and task version for updates', async () => {
    const { c, request } = await setup('onboarding', 'person');
    expect(request.mock.calls[0][0]).toContain('employeeId=person');
    c.show({ id: 'task', employeeId: 'person', title: 'Orientation', status: 'open', version: 4 });
    c.form.status = 'done';
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/hr/onboarding/task',
      expect.objectContaining({
        employeeId: 'person',
        version: 4,
        status: 'done',
        assigneeId: null,
        dueDate: null,
      }),
    );
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
