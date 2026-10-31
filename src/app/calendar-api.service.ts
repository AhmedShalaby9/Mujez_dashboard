import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export const EVENT_TYPES = ['viewing', 'call', 'meeting', 'inspection', 'signing'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export interface CalendarEvent {
  id: string;
  reference: string;
  type: EventType;
  title: { en: string; ar: string };
  startsAt: string;
  endsAt: string;
  place: string;
  contact: { id: string; reference: string; name: { en: string; ar: string } } | null;
  lead: { id: string; reference: string; name: { en: string; ar: string } } | null;
  owner: { id: string; name: string } | null;
  notes: string;
  status: 'scheduled' | 'done' | 'canceled';
  outcome: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  sample: boolean;
}
@Injectable({ providedIn: 'root' })
export class CalendarApi {
  readonly sales = inject(SalesApi);
  list(q: Record<string, string>) {
    return this.sales.get('events', q);
  }
  options() {
    return this.sales.get('events/options');
  }
  get(id: string) {
    return this.sales.get('events/' + id);
  }
  write(path: string, body: Record<string, unknown>) {
    return this.sales.write('events' + path, body);
  }
}
