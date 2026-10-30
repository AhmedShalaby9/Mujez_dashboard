import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { Contracts } from './pages/company-shell/contracts/contracts';
import { Documents } from './pages/company-shell/documents/documents';
import { CompanyFinanceApi } from './company-finance-api.service';
import { AuthService } from './auth.service';
const contract: any = {
  id: 'c1',
  reference: 'CT-REAL',
  title: { en: 'Saved agreement', ar: 'اتفاق محفوظ' },
  type: 'broker_agreement',
  status: 'draft',
  storedStatus: 'draft',
  leadId: 'l1',
  contact: { en: 'Actual buyer', ar: 'عميل' },
  unitId: null,
  unit: null,
  valueMinor: '900719925474099300',
  keyDate: '2027-01-01',
  owner: { id: 'owner', name: 'Actual owner' },
  version: 2,
  signers: [{ name: { en: 'Actual buyer', ar: 'عميل' }, role: { en: 'Client', ar: 'عميل' } }],
  requirements: [
    {
      id: 'req1',
      kind: 'contract',
      label: 'Signed contract',
      required: true,
      satisfied: false,
      documentId: null,
    },
  ],
};
const doc: any = {
  id: 'd1',
  file: 'actual.pdf',
  title: 'Uploaded evidence',
  kind: 'contract',
  leadId: 'l1',
  lead: contract.contact,
  contractId: 'c1',
  contractReference: 'CT-REAL',
  uploadedBy: { id: 'owner', name: 'Actual owner' },
  at: '2026-10-30T10:00:00Z',
  expires: null,
  sizeBytes: 123,
  version: 0,
  sample: false,
};
function mockApi() {
  const calls: any[] = [];
  return {
    calls,
    get: async (path: string, q: any) => {
      calls.push({ path, q });
      if (path === 'contracts/c1') return contract;
      if (path === 'documents') return { items: [doc], total: 1, storageBytes: '123' };
      if (path === 'contracts') return { items: [contract], total: 1 };
      if (path === 'leads')
        return { items: [{ id: 'l1', reference: 'L1', name: contract.contact }], total: 1 };
      if (path === 'units') return { items: [], total: 0 };
      if (path === 'reservations') return { items: [], total: 0 };
      throw Error(path);
    },
    write: async (path: string, b: any) => {
      calls.push({ path, b });
      return contract;
    },
    upload: async (form: FormData) => {
      calls.push({ form });
      return doc;
    },
    downloadUrl: (id: string) => 'https://api.example.test/api/v1/documents/' + id + '/download',
    money: (v: string) =>
      'EGP ' + (BigInt(v) / 100n).toString() + '.' + (BigInt(v) % 100n).toString().padStart(2, '0'),
  };
}
async function setup(
  type: any,
  api: any,
  permissions = [
    'contracts.read',
    'contracts.manage',
    'documents.read',
    'documents.manage',
    'leads.read',
    'units.read',
    'reservations.read',
  ],
): Promise<any> {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: AuthService, useValue: { user: signal({ id: 'owner', permissions }) } },
      { provide: CompanyFinanceApi, useValue: api },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(type);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}
describe('Company finance screens', () => {
  it('renders saved contracts and exact amounts; filters use backend requests', async () => {
    const api = mockApi(),
      f = await setup(Contracts, api);
    expect(f.nativeElement.textContent).toContain('CT-REAL');
    expect(f.nativeElement.textContent).toContain('9007199254740993.00');
    expect(f.nativeElement.textContent).not.toContain('MJ-0418');
    f.componentInstance.filter('signed');
    await f.whenStable();
    expect(api.calls.at(-1).q.status).toBe('signed');
  });
  it('shows evidence as unsatisfied until a real document is attached and persisted', async () => {
    const api = mockApi(),
      f = await setup(Contracts, api),
      c = f.componentInstance;
    await c.open('c1');
    c.attach(contract.requirements[0]);
    await f.whenStable();
    c.docId = 'd1';
    await c.applyAction();
    const call = api.calls.find((x) => x.b);
    expect(call.path).toBe('contracts/c1/requirements/req1/attach');
    expect(call.b.documentId).toBe('d1');
    expect(call.b.version).toBe(2);
    expect(contract.requirements[0].satisfied).toBe(false);
  });
  it('saves real draft fields and planned parties without simulating external signatures', async () => {
    const api = mockApi(),
      f = await setup(Contracts, api),
      c = f.componentInstance;
    c.newContract();
    await f.whenStable();
    c.form = {
      ...c.form,
      type: 'broker_agreement',
      leadId: 'l1',
      title: 'New agreement',
      value: '1234.56',
      keyDate: '2027-01-01',
      signers: [{ name: 'Actual buyer', role: 'Client' }],
    };
    await c.save();
    const b = api.calls.find((x) => x.b).b;
    expect(b.valueMinor).toBe('123456');
    expect(b.leadId).toBe('l1');
    expect(b.signers[0].signed).toBeUndefined();
    expect(b.requirements[0].kind).toBe('contract');
  });
  it('renders actual upload metadata and authenticated download links with real retained storage', async () => {
    const api = mockApi(),
      f = await setup(Documents, api);
    expect(f.nativeElement.textContent).toContain('Uploaded evidence');
    expect(f.nativeElement.textContent).toContain('Actual owner');
    expect(f.nativeElement.textContent).toContain('123');
    expect(f.nativeElement.querySelector('a[href$="/download"]').getAttribute('href')).toContain(
      '/documents/d1/download',
    );
  });
  it('submits actual file bytes and link metadata as multipart rather than a preview file name', async () => {
    const api = mockApi(),
      f = await setup(Documents, api),
      c = f.componentInstance;
    c.openUpload();
    await f.whenStable();
    const file = new File(['%PDF-1.4\nFixture only'], 'actual.pdf', { type: 'application/pdf' });
    c.newFile.set(file);
    c.newKind.set('contract');
    c.newSubject.set('Actual evidence');
    c.contractId = 'c1';
    c.leadId = 'l1';
    await c.submitUpload();
    const form = api.calls.find((x) => x.form).form;
    expect(form.get('file').name).toBe('actual.pdf');
    expect(form.get('file').size).toBe(file.size);
    expect(form.get('contractId')).toBe('c1');
    expect(form.get('requestId')).toBeTruthy();
  });
  it('keeps failures visible and prevents preview/write fallback for read-only owners', async () => {
    const api = mockApi();
    api.get = async () => {
      throw Error('Subscription unavailable');
    };
    const f = await setup(Contracts, api, ['contracts.read']);
    expect(f.nativeElement.textContent).toContain('Subscription unavailable');
    expect(f.nativeElement.textContent).not.toContain('New contract');
    expect(f.componentInstance.contracts().length).toBe(0);
  });
});
