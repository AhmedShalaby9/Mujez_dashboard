import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, afterEach, describe, it, expect } from 'vitest';
import { AuthService } from '../../../auth.service';
import { Cities } from './cities';
const row = { id: 'city', nameEn: 'Cairo', nameAr: 'القاهرة', version: 3, archived: false };
afterEach(() => TestBed.resetTestingModule());
async function setup(manage = true) {
  const request = vi.fn(async (_path: string, body?: any): Promise<any> =>
    body ? { ...row, ...body } : { items: [row] },
  );
  TestBed.configureTestingModule({
    imports: [Cities],
    providers: [
      {
        provide: AuthService,
        useValue: {
          user: signal({ permissions: manage ? ['co.view', 'co.create'] : ['co.view'] }),
          request,
        },
      },
    ],
  });
  const f = TestBed.createComponent(Cities);
  await f.whenStable();
  f.detectChanges();
  return { f, c: f.componentInstance, request };
}
describe('Platform cities', () => {
  it('shows real bilingual cities and submits versioned edits and reversible deletion', async () => {
    const { c, f, request } = await setup();
    expect(f.nativeElement.textContent).toContain('Cairo');
    c.edit(row);
    c.nameEn = 'New name';
    await c.save();
    expect(request).toHaveBeenCalledWith('/admin/api/v1/cities/city', {
      nameEn: 'New name',
      nameAr: 'القاهرة',
      version: 3,
    });
    await c.archive(row);
    expect(request).toHaveBeenCalledWith('/admin/api/v1/cities/city/archive', {
      version: 3,
      archived: true,
    });
  });
  it('preserves a city draft on failure and hides editing from read-only staff', async () => {
    const { c, request } = await setup(false);
    expect(c.canManage()).toBe(false);
    await c.archive(row);
    expect(request).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    const next = await setup();
    next.c.edit();
    next.c.nameEn = 'Keep';
    next.c.nameAr = 'احتفظ';
    next.request.mockRejectedValueOnce(Error('Duplicate city'));
    await next.c.save();
    expect(next.c.open()).toBe(true);
    expect(next.c.nameEn).toBe('Keep');
    expect(next.c.error()).toContain('Duplicate');
  });
});
