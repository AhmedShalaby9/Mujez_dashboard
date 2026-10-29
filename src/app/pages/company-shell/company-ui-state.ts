import { Injectable, computed, signal } from '@angular/core';

export type Lang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class CompanyUiState {
  readonly lang = signal<Lang>('en');
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));

  toggleLang(): void {
    this.lang.set(this.lang() === 'en' ? 'ar' : 'en');
  }
}
