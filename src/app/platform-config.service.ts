import { Injectable, inject, signal } from '@angular/core';
import { RUNTIME_CONFIG } from './runtime-config';
@Injectable({ providedIn: 'root' })
export class PlatformConfig {
  private readonly runtime = inject(RUNTIME_CONFIG, { optional: true });
  readonly branding = signal({
    platformName: 'Mujez',
    supportEmail: '',
    supportUrl: '',
    primaryColor: '#4945CC',
    defaultLang: 'en',
    defaultTimezone: 'Africa/Cairo',
  });
  constructor() {
    void this.load();
  }
  async load() {
    if (!this.runtime) return;
    try {
      const r = await fetch(this.runtime.apiUrl + '/admin/api/v1/branding', { cache: 'no-store' });
      if (r.ok) {
        const b = await r.json();
        this.branding.set(b);
        document.documentElement.style.setProperty('--platform-primary', b.primaryColor);
        document.title = b.platformName;
      }
    } catch {}
  }
}
