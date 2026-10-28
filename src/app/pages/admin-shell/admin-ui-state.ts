import { PlatformConfig } from '../../platform-config.service';
import { Injectable, computed, signal, inject, effect } from '@angular/core';

export type Lang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class AdminUiState {
  private readonly config = inject(PlatformConfig);
  private chosen = false;
  readonly lang = signal<Lang>('en');
  constructor() {
    effect(() => {
      const lang = this.config.branding().defaultLang;
      if (!this.chosen) this.lang.set(lang === 'ar' ? 'ar' : 'en');
    });
  }
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));

  toggleLang(): void {
    this.chosen = true;
    this.lang.set(this.lang() === 'en' ? 'ar' : 'en');
  }
}
