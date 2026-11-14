import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Inventory } from './pages/company-shell/inventory/inventory';
import { CompanyUiState } from './pages/company-shell/company-ui-state';
import { COS, DEVS, UNITS } from './pages/company-shell/inventory/inventory-data';

async function render(view: string, id?: string, lang: 'en' | 'ar' = 'en') {
  await TestBed.configureTestingModule({
    imports: [Inventory],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { view }, paramMap: convertToParamMap(id ? { id } : {}) },
          paramMap: {
            subscribe: (o: any) => (
              o.next?.(convertToParamMap(id ? { id } : {})),
              { unsubscribe() {} }
            ),
          },
        },
      },
    ],
  }).compileComponents();
  TestBed.inject(CompanyUiState).lang.set(lang);
  const f = TestBed.createComponent(Inventory);
  f.detectChanges();
  return f;
}

describe('Inventory units (static design)', () => {
  it('lists every unit and filters by bedrooms', async () => {
    const f = await render('units');
    expect(f.nativeElement.querySelectorAll('.iv-ccard').length).toBe(UNITS.length);
    f.componentInstance.ub.set('1');
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.iv-ccard').length).toBe(
      UNITS.filter((u) => u.beds === 1).length,
    );
  });
  it('renders every unit profile in both languages', async () => {
    for (let i = 0; i < UNITS.length; i++) {
      for (const lang of ['en', 'ar'] as const) {
        TestBed.resetTestingModule();
        const f = await render('unit', String(i), lang);
        expect(f.nativeElement.querySelector('.iv-h1.big')?.textContent).toBeTruthy();
        expect(f.nativeElement.querySelectorAll('.iv-prow').length).toBeGreaterThan(0);
      }
    }
  });
  it('shows the units for sale on a compound profile', async () => {
    const f = await render('co', '0');
    expect(f.nativeElement.querySelectorAll('.iv-sec2 .iv-ccard').length).toBe(
      UNITS.filter((u) => u.c === 0).slice(0, 4).length,
    );
  });
});

describe('Inventory (static design)', () => {
  it('lists every developer', async () => {
    const f = await render('devs');
    expect(f.nativeElement.querySelectorAll('.iv-dcard').length).toBe(DEVS.length);
  });
  it('lists every compound and filters by search', async () => {
    const f = await render('cos');
    expect(f.nativeElement.querySelectorAll('.iv-ccard').length).toBe(COS.length);
    f.componentInstance.q.set('horizon bay');
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.iv-ccard').length).toBe(1);
  });
  it('renders a developer profile with its compounds', async () => {
    const f = await render('dev', '0');
    expect(f.nativeElement.textContent).toContain(DEVS[0].n[0]);
    expect(f.nativeElement.querySelectorAll('.iv-mini').length).toBe(
      COS.filter((c) => c.d === 0).length,
    );
  });
  it('renders every compound profile in both languages without errors', async () => {
    for (let i = 0; i < COS.length; i++) {
      for (const lang of ['en', 'ar'] as const) {
        TestBed.resetTestingModule();
        const f = await render('co', String(i), lang);
        expect(f.nativeElement.querySelector('.iv-h1.big')?.textContent).toContain(
          COS[i].n[lang === 'ar' ? 1 : 0],
        );
      }
    }
  });
  it('shows a not-found state for an unknown id', async () => {
    const f = await render('co', '999');
    expect(f.nativeElement.querySelector('.iv-empty')).not.toBeNull();
  });
});
