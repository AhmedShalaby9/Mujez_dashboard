import { Component, Injectable, effect, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { AuthService } from './auth.service';

/**
 * True while a route change is in flight (guards + lazy chunks) and until the
 * page's initial data requests have finished, so the shell can show a shimmer.
 */
@Injectable({ providedIn: 'root' })
export class NavigationState {
  private readonly auth = inject(AuthService);
  private readonly routing = signal(false);
  private readonly dataLoading = signal(false);
  private safety?: ReturnType<typeof setTimeout>;
  readonly navigating = () => this.routing() || this.dataLoading();

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.routing.set(true);
      } else if (e instanceof NavigationEnd) {
        this.routing.set(false);
        // Page constructors fire their requests on activation; check right after.
        setTimeout(() => {
          if (this.auth.pending() > 0) {
            this.dataLoading.set(true);
            clearTimeout(this.safety);
            this.safety = setTimeout(() => this.dataLoading.set(false), 10000);
          }
        });
      } else if (e instanceof NavigationCancel || e instanceof NavigationError) {
        this.routing.set(false);
      }
    });
    effect(() => {
      if (this.auth.pending() === 0 && this.dataLoading()) {
        clearTimeout(this.safety);
        this.dataLoading.set(false);
      }
    });
  }
}

@Component({
  selector: 'app-route-skeleton',
  imports: [NgxSkeletonLoaderModule],
  template: `
    <div class="sk" aria-busy="true" aria-live="polite">
      <ngx-skeleton-loader
        [theme]="{ width: '220px', height: '28px', margin: 0 }"
        animation="progress"
      />
      <div class="sk__row">
        @for (i of [1, 2, 3, 4]; track i) {
          <ngx-skeleton-loader
            [theme]="{ height: '92px', margin: 0, 'border-radius': '10px' }"
            animation="progress"
          />
        }
      </div>
      <ngx-skeleton-loader
        [theme]="{ height: '260px', margin: 0, 'border-radius': '10px' }"
        animation="progress"
      />
      <ngx-skeleton-loader
        [theme]="{ height: '140px', margin: 0, 'border-radius': '10px' }"
        animation="progress"
      />
    </div>
  `,
  styles: `
    .sk {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sk__row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }
  `,
})
export class RouteSkeleton {}
