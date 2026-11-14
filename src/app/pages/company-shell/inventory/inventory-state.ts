import { Injectable, signal } from '@angular/core';

export interface AlertPrefs {
  units: boolean;
  price: boolean;
  launch: boolean;
  news: boolean;
}

/** In-memory (per session) follow / alert state for the static inventory demo. */
@Injectable({ providedIn: 'root' })
export class InventoryState {
  /** keys: `d<index>` for developers, `c<index>` for compounds */
  readonly followed = signal<Record<string, boolean>>({});
  readonly muted = signal<Record<number, boolean>>({});
  readonly alerts = signal<Record<number, AlertPrefs>>({});

  toggleFollow(key: string): boolean {
    const on = !this.followed()[key];
    this.followed.update((f) => ({ ...f, [key]: on }));
    return on;
  }

  toggleMute(i: number): boolean {
    const on = !this.muted()[i];
    this.muted.update((m) => ({ ...m, [i]: on }));
    return on;
  }

  prefs(i: number): AlertPrefs {
    return this.alerts()[i] ?? { units: true, price: true, launch: true, news: false };
  }

  togglePref(i: number, k: keyof AlertPrefs) {
    const p = this.prefs(i);
    this.alerts.update((a) => ({ ...a, [i]: { ...p, [k]: !p[k] } }));
  }
}
