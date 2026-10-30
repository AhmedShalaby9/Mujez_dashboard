import { Injectable, inject } from '@angular/core';
import { SalesApi } from './sales-api.service';
export const TASK_GROUPS = ['overdue', 'today', 'tomorrow', 'week', 'later'] as const;
export interface CompanyTask {
  id: string;
  reference: string;
  title: { en: string; ar: string };
  description: string;
  lead: {
    id: string;
    reference: string;
    name: { en: string; ar: string };
    archivedAt: string | null;
  } | null;
  assignee: { id: string; name: string } | null;
  dueDate: string;
  group: (typeof TASK_GROUPS)[number];
  overdue: boolean;
  priority: 'high' | 'med' | 'low';
  status: 'open' | 'done' | 'cancelled';
  version: number;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  sample: boolean;
}
@Injectable({ providedIn: 'root' })
export class TasksApi {
  readonly sales = inject(SalesApi);
  list(q: Record<string, string>) {
    return this.sales.get('tasks', q);
  }
  get(id: string) {
    return this.sales.get('tasks/' + id);
  }
  activity(id: string, page = 1) {
    return this.sales.get('tasks/' + id + '/activities', { page: String(page) });
  }
  write(path: string, body: Record<string, unknown>) {
    return this.sales.write('tasks' + path, body);
  }
}
