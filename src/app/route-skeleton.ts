import { Component, Injectable, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { signal } from '@angular/core';

/** True while a route change is in flight (guards + lazy chunk loading). */
@Injectable({ providedIn: 'root' })
export class NavigationState {
  readonly navigating = signal(false);
  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      )
        this.navigating.set(false);
    });
  }
}

@Component({
  selector: 'app-route-skeleton',
  template: `
    <div class="sk" aria-busy="true" aria-live="polite">
      <div class="sk__bar sk__title"></div>
      <div class="sk__row">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="sk__bar sk__card"></div>
        }
      </div>
      <div class="sk__bar sk__panel"></div>
      <div class="sk__bar sk__panel sk__panel--short"></div>
    </div>
  `,
  styles: `
    .sk { display: flex; flex-direction: column; gap: 14px; }
    .sk__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .sk__bar {
      border-radius: 10px;
      background: linear-gradient(90deg, rgba(128,128,128,.12) 25%, rgba(128,128,128,.24) 50%, rgba(128,128,128,.12) 75%);
      background-size: 200% 100%;
      animation: sk-shimmer 1.2s ease-in-out infinite;
    }
    .sk__title { height: 28px; width: 220px; }
    .sk__card { height: 92px; }
    .sk__panel { height: 260px; }
    .sk__panel--short { height: 140px; }
    @keyframes sk-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .sk__bar { animation: none; } }
  `,
})
export class RouteSkeleton {}
