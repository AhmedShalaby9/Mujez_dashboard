import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompanyUiState } from '../company-ui-state';
import { AuthService } from '../../../auth.service';
import { TasksApi, TASK_GROUPS, type CompanyTask } from '../../../tasks-api.service';
@Component({
  selector: 'app-tasks',
  imports: [FormsModule, RouterLink],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class Tasks {
  private readonly ui = inject(CompanyUiState);
  readonly auth = inject(AuthService);
  readonly api = inject(TasksApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly lang = this.ui.lang;
  readonly ar = computed(() => this.lang() === 'ar');
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  readonly canManage = computed(
    () => this.auth.user()?.permissions.includes('tasks.manage') ?? false,
  );
  readonly canReadLeads = computed(
    () => this.auth.user()?.permissions.includes('leads.read') ?? false,
  );
  readonly tasks = signal<CompanyTask[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly today = signal('');
  readonly asOf = signal('');
  readonly summary = signal<Record<string, number>>({});
  readonly groups = TASK_GROUPS;
  readonly groupFilter = signal('all');
  readonly statusFilter = signal('open');
  readonly ownerFilter = signal('');
  readonly leadFilter = signal('');
  readonly contextLead = signal<{
    id: string;
    name: { en: string; ar: string };
    reference?: string;
  } | null>(null);
  readonly search = signal('');
  readonly quickAdd = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly dialog = signal(false);
  readonly editing = signal<CompanyTask | null>(null);
  readonly assignees = signal<Array<{ id: string; name: string }>>([]);
  readonly leadOptions = signal<
    Array<{ id: string; name: { en: string; ar: string }; reference: string }>
  >([]);
  readonly leadTotal = signal(0);
  readonly leadPage = signal(1);
  readonly leadSearch = signal('');
  readonly leadsLoading = signal(false);
  readonly selected = signal<CompanyTask | null>(null);
  readonly history = signal<any[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly cancelReason = signal('');
  draft = {
    title: '',
    titleAr: '',
    description: '',
    leadId: '',
    assigneeId: '',
    dueDate: '',
    priority: 'med',
  };
  readonly grouped = computed(() =>
    this.groups
      .map((group) => ({ group, items: this.tasks().filter((task) => task.group === group) }))
      .filter((g) => g.items.length),
  );
  private serial = 0;
  private detailSerial = 0;
  private optionsSerial = 0;
  private routeSerial = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private formId = crypto.randomUUID();
  private quickId = crypto.randomUUID();
  constructor() {
    void this.loadOptions();
    const subscription = this.route.queryParamMap.subscribe(async (params) => {
      const serial = ++this.routeSerial;
      const id = params.get('leadId') ?? '';
      this.leadFilter.set(id);
      this.contextLead.set(null);
      if (id && this.canReadLeads()) {
        try {
          const l = await this.api.sales.get('leads/' + id);
          if (serial === this.routeSerial)
            this.contextLead.set({ id: l.id, name: l.name, reference: l.reference });
        } catch (e) {
          if (serial === this.routeSerial) this.error.set((e as Error).message);
        }
      }
      await this.reload();
      if (
        serial === this.routeSerial &&
        params.get('new') === '1' &&
        this.canManage() &&
        this.today()
      )
        await this.openForm();
    });
    this.destroy.onDestroy(() => {
      subscription.unsubscribe();
      this.serial++;
      this.detailSerial++;
      this.optionsSerial++;
      this.routeSerial++;
      clearTimeout(this.timer);
    });
  }
  groupName(g: string) {
    return (
      {
        overdue:
          this.statusFilter() === 'open'
            ? this.t('Overdue', 'متأخرة')
            : this.t('Past due dates', 'تواريخ سابقة'),
        today: this.t('Today', 'اليوم'),
        tomorrow: this.t('Tomorrow', 'غدًا'),
        week: this.t('Next 7 days', 'خلال 7 أيام'),
        later: this.t('Later', 'لاحقًا'),
      } as Record<string, string>
    )[g];
  }
  priority(p: string) {
    return (
      {
        high: this.t('High', 'عالية'),
        med: this.t('Medium', 'متوسطة'),
        low: this.t('Low', 'منخفضة'),
      } as Record<string, string>
    )[p];
  }
  status(s: string) {
    return (
      {
        open: this.t('Open', 'مفتوحة'),
        done: this.t('Completed', 'مكتملة'),
        cancelled: this.t('Cancelled', 'ملغاة'),
      } as Record<string, string>
    )[s];
  }
  date(s: string) {
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG-u-nu-latn' : 'en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
    }).format(new Date(s.length === 10 ? s + 'T12:00:00Z' : s));
  }
  async loadOptions() {
    try {
      const r = await this.api.sales.get('tasks/options');
      this.assignees.set(r.assignees);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async reload(page = 1) {
    const serial = ++this.serial;
    this.loading.set(true);
    this.error.set('');
    try {
      const q: Record<string, string> = {
        page: String(page),
        limit: '50',
        status: this.statusFilter(),
      };
      if (this.groupFilter() !== 'all') q['group'] = this.groupFilter();
      if (this.ownerFilter()) q['assigneeId'] = this.ownerFilter();
      if (this.leadFilter()) q['leadId'] = this.leadFilter();
      if (this.search().trim()) q['q'] = this.search().trim();
      const r = await this.api.list(q);
      if (serial === this.serial) {
        this.tasks.set(r.items);
        this.total.set(r.total);
        this.summary.set(r.summary);
        this.today.set(r.today);
        this.asOf.set(r.asOf);
        this.page.set(page);
      }
    } catch (e) {
      if (serial === this.serial) this.error.set((e as Error).message);
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  searchChanged(s: string) {
    this.search.set(s);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), 250);
  }
  clearLead() {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }
  quickChanged(s: string) {
    this.quickAdd.set(s);
    this.quickId = crypto.randomUUID();
  }
  async addQuick() {
    if (!this.quickAdd().trim() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.write('', {
        requestId: this.quickId,
        title: this.quickAdd().trim(),
        priority: 'med',
        ...(this.leadFilter() ? { leadId: this.leadFilter() } : {}),
      });
      this.quickAdd.set('');
      this.quickId = crypto.randomUUID();
      await this.reload();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async openForm(task?: CompanyTask) {
    this.editing.set(task ?? null);
    this.formError.set('');
    this.formId = crypto.randomUUID();
    this.draft = task
      ? {
          title: task.title.en,
          titleAr: task.title.ar,
          description: task.description,
          leadId: task.lead?.id ?? '',
          assigneeId: task.assignee?.id ?? '',
          dueDate: task.dueDate,
          priority: task.priority,
        }
      : {
          title: '',
          titleAr: '',
          description: '',
          leadId: this.leadFilter(),
          assigneeId: this.auth.user()?.id ?? '',
          dueDate: this.today(),
          priority: 'med',
        };
    this.dialog.set(true);
    this.leadSearch.set('');
    if (this.canReadLeads()) await this.loadLeads();
  }
  async loadLeads(page = 1) {
    const serial = ++this.optionsSerial;
    this.leadsLoading.set(true);
    try {
      const r = await this.api.sales.get('tasks/lead-options', {
        page: String(page),
        limit: '100',
        ...(this.leadSearch().trim() ? { q: this.leadSearch().trim() } : {}),
      });
      if (serial === this.optionsSerial) {
        const list = page === 1 ? r.items : [...this.leadOptions(), ...r.items];
        const current = this.editing()?.lead ?? this.contextLead();
        if (current && !list.some((l: any) => l.id === current.id)) list.unshift(current);
        this.leadOptions.set(list);
        this.leadTotal.set(r.total);
        this.leadPage.set(page);
      }
    } catch (e) {
      if (serial === this.optionsSerial) this.formError.set((e as Error).message);
    } finally {
      if (serial === this.optionsSerial) this.leadsLoading.set(false);
    }
  }
  async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const current = this.editing();
      const result = await this.api.write(current ? '/' + current.id + '/update' : '', {
        requestId: this.formId,
        title: this.draft.title.trim(),
        ...(this.draft.titleAr.trim() ? { titleAr: this.draft.titleAr.trim() } : {}),
        description: this.draft.description.trim(),
        leadId: this.draft.leadId || null,
        assigneeId: this.draft.assigneeId || null,
        dueDate: this.draft.dueDate,
        priority: this.draft.priority,
        ...(current ? { version: current.version } : {}),
      });
      this.dialog.set(false);
      await this.reload(this.page());
      await this.open(result.id);
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  async open(id: string) {
    const serial = ++this.detailSerial;
    this.selected.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.cancelReason.set('');
    try {
      const [task, activity] = await Promise.all([this.api.get(id), this.api.activity(id)]);
      if (serial === this.detailSerial) {
        this.selected.set(task);
        this.history.set(activity.items);
        this.historyTotal.set(activity.total);
        this.historyPage.set(1);
      }
    } catch (e) {
      if (serial === this.detailSerial) this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }
  close() {
    this.detailSerial++;
    this.selected.set(null);
    this.detailError.set('');
    this.detailLoading.set(false);
  }
  async moreHistory() {
    const task = this.selected();
    if (!task || this.detailLoading()) return;
    const serial = this.detailSerial;
    this.detailLoading.set(true);
    try {
      const page = this.historyPage() + 1;
      const r = await this.api.activity(task.id, page);
      if (serial === this.detailSerial) {
        this.history.update((a) => [...a, ...r.items]);
        this.historyPage.set(page);
        this.historyTotal.set(r.total);
      }
    } catch (e) {
      this.detailError.set((e as Error).message);
    } finally {
      if (serial === this.detailSerial) this.detailLoading.set(false);
    }
  }
  async action(task: CompanyTask, action: 'complete' | 'reopen' | 'cancel') {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.detailError.set('');
    try {
      await this.api.write('/' + task.id + '/status', {
        version: task.version,
        action,
        ...(action === 'cancel' ? { reason: this.cancelReason().trim() } : {}),
      });
      await this.reload(this.page());
      if (this.selected()?.id === task.id) await this.open(task.id);
    } catch (e) {
      this.error.set((e as Error).message);
      this.detailError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
  activityName(a: string) {
    return (
      (
        {
          'task.created': this.t('Task created', 'تم إنشاء المهمة'),
          'task.updated': this.t('Task updated', 'تم تعديل المهمة'),
          'task.completed': this.t('Task completed', 'تم إنجاز المهمة'),
          'task.reopened': this.t('Task reopened', 'تمت إعادة الفتح'),
          'task.cancelled': this.t('Task cancelled', 'تم إلغاء المهمة'),
          'task.seeded': this.t('Initial sample task', 'مهمة تجريبية أولية'),
        } as Record<string, string>
      )[a] ?? a
    );
  }
}
