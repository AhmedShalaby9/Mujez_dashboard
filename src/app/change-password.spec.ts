import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService, companyGuard, passwordChangeGuard } from './auth.service';
import { ChangePassword } from './change-password';
describe('Owner first login', () => {
  const owner = {
    pool: 'company_admin',
    role: 'company_owner',
    mustChangePassword: true,
    permissions: ['workspace.view'],
  };
  it('redirects a temporary-password owner even when workspace permission is present', async () => {
    const user = signal(owner);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user, restore: async () => true, homePath: () => '/company/dashboard' },
        },
      ],
    });
    const r = await TestBed.runInInjectionContext(() =>
      companyGuard({ data: {} } as any, {} as any),
    );
    expect(TestBed.inject(Router).serializeUrl(r as any)).toBe('/change-password');
    expect(
      await TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, {} as any)),
    ).toBe(true);
    user.set({ ...owner, mustChangePassword: false });
    const next = await TestBed.runInInjectionContext(() =>
      passwordChangeGuard({} as any, {} as any),
    );
    expect(TestBed.inject(Router).serializeUrl(next as any)).toBe('/company/dashboard');
  });
  it('validates confirmation, retains the form on failure and clears passwords after success', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Current password is incorrect'))
      .mockResolvedValue({ status: 'password_changed' });
    const restore = vi.fn(async () => true);
    await TestBed.configureTestingModule({
      imports: [ChangePassword],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { request, restore, homePath: () => '/company/dashboard' },
        },
      ],
    }).compileComponents();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(ChangePassword),
      c = f.componentInstance;
    c.current = 'temporary';
    c.next = 'a-new-password';
    c.confirm = 'mismatch';
    await c.save();
    expect(request).not.toHaveBeenCalled();
    c.confirm = c.next;
    await c.save();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Current password is incorrect');
    expect(c.current).toBe('temporary');
    expect(c.busy()).toBe(false);
    await c.save();
    expect(request).toHaveBeenLastCalledWith('/api/v1/auth/change-password', {
      currentPassword: 'temporary',
      newPassword: 'a-new-password',
    });
    expect(c.current + c.next + c.confirm).toBe('');
    expect(restore).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/company/dashboard');
  });
});
