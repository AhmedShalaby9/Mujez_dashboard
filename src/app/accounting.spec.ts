import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Accounting } from './pages/company-shell/accounting/accounting';
import {
  AuthService,
  hasAccountingAccess,
  hasAccountingSelf,
  hasPayrollAccess,
  companyHomePath,
  companyGuard,
} from './auth.service';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { RUNTIME_CONFIG } from './runtime-config';
const ctx = {
  configured: true,
  today: '2026-11-20',
  canWrite: true,
  canPost: true,
  canApprove: true,
  canSettings: true,
};
const options = {
  settings: { fiscal_month: 1, vat_bps: 1400, version: 1 },
  accounts: [
    { id: 'cash', name: 'Main cash', code: '1100', kind: 'asset', active: true },
    { id: 'equity', name: 'Opening equity', code: '3100', kind: 'equity', active: true },
  ],
  parties: [],
  dimensions: [],
  treasuries: [],
  employees: [],
  users: [],
};
async function setup(mode = 'journals') {
  const request = vi.fn(async (path: string, body?: any): Promise<any> => {
    if (body) return { id: 'saved' };
    if (path.endsWith('/context') || path.endsWith('/payroll-context')) return ctx;
    if (path.endsWith('/options') || path.endsWith('/payroll-options')) return options;
    if (path.includes('reconciliation-lines'))
      return {
        prior: { statement_minor: '10000' },
        bookBalanceMinor: '10500',
        items: [{ id: 'line', debit_minor: '500', credit_minor: '0' }],
      };
    if (path.includes('/reports?'))
      return {
        items: [
          {
            id: 'cash',
            code: '1100',
            name: 'Main cash',
            balance_minor: '10000',
            closingDebitMinor: '10000',
            closingCreditMinor: '0',
          },
        ],
        summary: { differenceMinor: '0' },
      };
    if (path.endsWith('hr-advances')) return { items: [], payments: [] };
    return { items: [], total: 0, summary: {} };
  });
  const user = signal<any>({
    pool: 'company_admin',
    role: 'company_owner',
    permissions: ['workspace.view'],
    company: { hrEnabled: false },
  });
  TestBed.configureTestingModule({
    imports: [Accounting],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { accountingView: mode } } } },
      { provide: AuthService, useValue: { request, user, restore: async () => true } },
      { provide: CompanyUiState, useValue: { lang: signal('en') } },
      { provide: RUNTIME_CONFIG, useValue: { apiUrl: 'https://api.example.test' } },
    ],
  });
  const fixture = TestBed.createComponent(Accounting);
  await fixture.componentInstance.load();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, request, user };
}
afterEach(() => TestBed.resetTestingModule());
describe('Company accounting', () => {
  it('works independently of HR and gives finance staff a finance home without company-wide CRM access', () => {
    const u: any = {
      pool: 'company_user',
      role: 'accountant',
      roles: ['accountant', 'employee'],
      permissions: ['finance.read', 'finance.write', 'finance.post', 'leave.self'],
      company: { hrEnabled: false },
    };
    expect(hasAccountingAccess(u)).toBe(true);
    expect(hasAccountingAccess(u, 'finance.settings')).toBe(false);
    expect(companyHomePath(u)).toBe('/company/finance');
    expect(hasAccountingAccess({ ...u, roles: ['agent', 'employee'] })).toBe(false);
    expect(hasAccountingAccess({ ...u, workspace: {} })).toBe(false);
  });
  it('hides accounting, payroll and personal finance when the module is disabled, preserving CRM navigation', () => {
    const owner: any = {
      pool: 'company_admin',
      role: 'company_owner',
      permissions: ['workspace.view', 'commissions.read'],
      company: { financeEnabled: false, hrEnabled: true },
    };
    expect(hasAccountingAccess(owner)).toBe(false);
    expect(companyHomePath(owner)).toBe('/company/dashboard');
    const employee: any = {
      ...owner,
      pool: 'company_user',
      role: 'payroll_officer',
      roles: ['payroll_officer', 'employee'],
      permissions: ['payroll.read', 'leave.self'],
    };
    expect(hasPayrollAccess(employee)).toBe(false);
    expect(companyHomePath(employee)).toBe('/company/employee');
    const sales: any = {
      ...employee,
      role: 'agent',
      roles: ['agent', 'employee'],
      permissions: ['leads.read', 'commissions.read'],
    };
    expect(hasAccountingSelf(sales)).toBe(false);
    expect(companyHomePath(sales)).toBe('/company/dashboard');
    expect(hasAccountingSelf({ ...sales, company: { financeEnabled: true } })).toBe(true);
  });
  it('saves compact balanced journal inputs as exact minor-unit strings and leaves posting separate', async () => {
    const { c, request } = await setup();
    c.edit();
    c.form.memo = 'Opening balances';
    c.form.date = '2026-11-20';
    c.lines = [
      { accountId: 'cash', debit: '10k', credit: '' },
      { accountId: 'equity', credit: '10k', debit: '' },
    ];
    await c.save();
    const body = request.mock.calls.find(([p, b]) => p.endsWith('/journals') && b)?.[1];
    expect(body.lines[0]).toMatchObject({
      accountId: 'cash',
      debitMinor: '1000000',
      creditMinor: '0',
    });
    expect(body).not.toHaveProperty('status');
    expect(c.dialog()).toBe('');
  });
  it('requires current agreement version when booking and submits bands without floating-point amounts', async () => {
    const { c, request } = await setup('commissions');
    c.agreements.set([{ id: 'agreement', version: 4, active: true, name: 'Real agreement' }]);
    await c.act('book', {
      id: 'deal',
      version: 3,
      owner_id: 'agent',
      property_value_minor: '100000000',
    });
    c.form.agreementId = 'agreement';
    c.form.agentId = 'agent';
    await c.save();
    expect(
      request.mock.calls.find(([p, b]) => p.endsWith('/deals/deal/book') && b)?.[1],
    ).toMatchObject({ version: 3, agreementVersion: 4, agreementId: 'agreement' });
  });
  it('renders report columns for the selected report and preserves entered values on a failed posting', async () => {
    const { c, request } = await setup('reports');
    c.reportKind = 'profit_loss';
    expect(c.columns().some((x) => x.key === 'amountMinor')).toBe(true);
    c.reportKind = 'collections';
    expect(c.columns().some((x) => x.key === 'sales_agent')).toBe(true);
    c.selected.set({ id: 'entry', version: 7 });
    c.action = 'post';
    c.dialog.set('action');
    c.tab.set('journals');
    request.mockImplementationOnce(async () => {
      throw Error('Financial period is closed');
    });
    await c.save();
    expect(c.formError()).toBe('Financial period is closed');
    expect(c.dialog()).toBe('action');
  });
  it('shows exact selected bank movement plus the previous statement balance', async () => {
    const { c } = await setup('treasury');
    c.edit(undefined, 'reconcile');
    c.form.treasuryId = 'bank';
    c.form.date = '2026-11-20';
    await c.loadBankLines();
    c.toggleLine('line', true);
    expect(c.selectedBankAmount()).toBe('EGP 105');
  });
  it('clears private finance data on denied refresh and rejects unauthorized direct routes', async () => {
    const { c, request, user } = await setup();
    c.data.set({ items: [{ id: 'private' }], summary: {}, total: 1 });
    request.mockImplementationOnce(async () => {
      throw Error('Access revoked');
    });
    await c.load();
    expect(c.data().items).toEqual([]);
    user.set({
      pool: 'company_user',
      role: 'hr_officer',
      roles: ['hr_officer', 'employee'],
      permissions: ['hr.read'],
      company: { hrEnabled: true },
    });
    const denied = await TestBed.runInInjectionContext(() =>
      companyGuard({ data: { accountingView: 'overview' } } as any, {} as any),
    );
    expect(denied).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/company/hr/employees');
  });
});

describe('Finance workflow extensions', () => {
  it('keeps payroll staff out of general accounting and routes them to payroll', () => {
    const officer: any = {
      pool: 'company_user',
      role: 'payroll_officer',
      roles: ['payroll_officer', 'employee'],
      permissions: ['payroll.read', 'payroll.manage', 'leave.self'],
      company: { hrEnabled: true },
    };
    expect(hasPayrollAccess(officer)).toBe(true);
    expect(hasAccountingAccess(officer)).toBe(false);
    expect(companyHomePath(officer)).toBe('/company/payroll');
    expect(hasPayrollAccess({ ...officer, workspace: {} })).toBe(false);
  });
  it('sends a scoped commission policy with exact fixed amounts and effective dates', async () => {
    const { c, request } = await setup('commissions');
    await c.choose('commission-policies');
    c.edit();
    c.form = {
      name: 'Agent policy',
      roleKey: 'agent',
      userId: 'agent-id',
      policyTeamId: '',
      mode: 'fixed',
      fixedMinor: '10k',
      from: '2026-11-01',
      to: '',
      active: true,
    };
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/accounting/commission-policies',
      expect.objectContaining({
        userId: 'agent-id',
        teamId: null,
        fixedMinor: '1000000',
        from: '2026-11-01',
        to: null,
      }),
    );
  });
  it('starts CRM automation disabled and submits explicit installment settings', async () => {
    const { c, request } = await setup('commissions');
    await c.choose('automation-rules');
    c.edit();
    expect(c.form.active).toBe(false);
    Object.assign(c.form, {
      name: 'Sale rule',
      contractType: 'sale',
      agreementId: 'agreement',
      createInstallments: true,
      installments: 12,
      intervalMonths: 1,
      firstDueDays: 30,
      collectionOwner: 'developer',
      active: true,
    });
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/accounting/automation-rules',
      expect.objectContaining({
        active: true,
        createInstallments: true,
        installments: 12,
        collectionOwner: 'developer',
      }),
    );
  });
  it('prepares payroll only for explicitly selected employees and preserves salary amounts', async () => {
    const { c, request } = await setup('payroll');
    c.edit();
    c.toggleEmployee('employee', true);
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/accounting/payroll-runs',
      expect.objectContaining({ employeeIds: ['employee'], month: '2026-11', date: '2026-11-20' }),
    );
    await c.choose('salary-profiles');
    c.edit();
    Object.assign(c.form, {
      employeeId: 'employee',
      baseMinor: '10k',
      allowanceMinor: '2k',
      deductionMinor: '500',
      deductionNote: 'Approved',
      advanceCapPercent: '25',
    });
    await c.save();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/accounting/salary-profiles',
      expect.objectContaining({
        baseMinor: '1000000',
        allowanceMinor: '200000',
        deductionMinor: '50000',
        advanceCapBps: 2500,
      }),
    );
  });
});

describe('Single office accounting', () => {
  it('does not require or display branch fields for journals, reports or targets', async () => {
    const { c, fixture } = await setup('reports');
    expect(fixture.nativeElement.textContent).not.toContain('All branches');
    c.edit(undefined, 'journal');
    expect(c.fields().some((f) => f.key === 'branchId')).toBe(false);
    c.edit(undefined, 'target');
    expect(c.fields().some((f) => f.key === 'branchId')).toBe(false);
    c.edit(undefined, 'dimension');
    const choices = c.fields().find((f) => f.key === 'kind')?.options ?? [];
    expect(choices.some((x) => x.value === 'branch')).toBe(false);
    expect(choices.some((x) => x.value === 'cost_centre')).toBe(true);
  });
});
