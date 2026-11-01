import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  route: string;
  createdAt: string;
  readAt: string | null;
}
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private auth = inject(AuthService);
  readonly items = signal<NotificationItem[]>([]);
  readonly unread = signal(0);
  readonly total = signal(0);
  readonly error = signal('');
  private page = 1;
  private generation = 0;
  private identity = '';
  private prefix() {
    return this.auth.user()?.pool === 'platform'
      ? '/admin/api/v1/notifications'
      : '/api/v1/notifications';
  }
  async refresh(more = false) {
    const generation = ++this.generation;
    const identity = this.auth.user()?.id + this.prefix();
    if (identity !== this.identity) {
      this.items.set([]);
      this.unread.set(0);
      this.identity = identity;
    }
    const page = more ? this.page + 1 : 1;
    try {
      const r = await this.auth.request(this.prefix() + '?page=' + page);
      if (generation !== this.generation) return;
      this.items.set(more ? [...this.items(), ...r.items] : r.items);
      this.unread.set(r.unread);
      this.total.set(r.total);
      this.page = page;
      this.error.set('');
    } catch (e) {
      if (generation === this.generation) this.error.set((e as Error).message);
    }
  }
  async mark(id: string, read = true) {
    await this.auth.request(
      this.prefix() + '/' + encodeURIComponent(id) + (read ? '/read' : '/unread'),
      {},
    );
    await this.refresh();
  }
  async markAll() {
    await this.auth.request(this.prefix() + '/read-all', {});
    await this.refresh();
  }
}
