import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TeamApi,
  type SalesTeam,
  type TeamWorkLead,
  type TeamWorkTask,
  type TeamPerformance,
} from '../../../team-api.service';
import { salesMoney, STAGE_NAMES } from '../../../sales-api.service';
import { CompanyUiState } from '../company-ui-state';
@Component({
  selector: 'app-my-team',
  imports: [FormsModule],
  templateUrl: './my-team.html',
  styleUrls: [
    '../../admin-shell/admin-ui.scss',
    '../../admin-shell/admin-table.scss',
    '../company-ui.scss',
    '../team/team.scss',
    './my-team.scss',
  ],
})
export class MyTeam {
  readonly ui = inject(CompanyUiState);
  readonly ar = computed(() => this.ui.lang() === 'ar');
  private readonly api = inject(TeamApi);
  readonly teams = signal<SalesTeam[]>([]);
  readonly performance = signal<TeamPerformance | null>(null);
  readonly loading = signal(false);
  readonly listLoading = signal(false);
  readonly error = signal('');
  readonly toast = signal('');
  readonly tab = signal<'performance' | 'leads' | 'tasks'>('performance');
  readonly days = signal(30);
  readonly leads = signal<TeamWorkLead[]>([]);
  readonly tasks = signal<TeamWorkTask[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 25;
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  readonly targets = computed(() => this.performance()?.items.filter((m) => m.canAssign) ?? []);
  readonly selected = signal<TeamWorkLead | null>(null);
  readonly assigning = signal(false);
  readonly taskSaving = signal(false);
  readonly busy = computed(() => this.assigning() || this.taskSaving());
  readonly taskMode = signal<'create' | 'assign' | 'status' | null>(null);
  readonly taskRow = signal<TeamWorkTask | null>(null);
  readonly taskError = signal('');
  readonly taskLeadOptions = signal<TeamWorkLead[]>([]);
  readonly taskLeadLoading = signal(false);
  readonly taskLeadTotal = signal(0);
  readonly chosenTaskLead = signal<TeamWorkLead | null>(null);
  taskTitle = '';
  taskDescription = '';
  taskAssignee = '';
  taskDue = '';
  taskPriority = 'med';
  taskReason = '';
  taskLeadQuery = '';
  taskAction: 'complete' | 'reopen' | 'cancel' = 'complete';
  private taskRequestId = '';
  private taskSignature = '';
  private leadGeneration = 0;
  ownerId = '';
  private requestId = '';
  private generation = 0;
  memberId = '';
  search = '';
  state = '';
  private appliedSearch = '';
  t(en: string, ar: string) {
    return this.ar() ? ar : en;
  }
  local(value: { en: string; ar: string }) {
    return value[this.ui.lang()] || value.en;
  }
  money = salesMoney;
  stage(value: string) {
    return (STAGE_NAMES[this.ui.lang()] as Record<string, string>)[value] ?? value;
  }
  status(value: string) {
    return (
      (
        {
          active: this.t('Active', 'نشط'),
          invited: this.t('Invited', 'مدعو'),
          disabled: this.t('Disabled', 'معطّل'),
          locked: this.t('Locked', 'مقفل'),
          open: this.t('Open', 'مفتوحة'),
          done: this.t('Done', 'مكتملة'),
          cancelled: this.t('Cancelled', 'ملغاة'),
        } as Record<string, string>
      )[value] ?? value
    );
  }
  constructor() {
    void this.reload();
  }
  async reload() {
    if (this.busy()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.teams.set((await this.api.myTeam()).items);
      this.performance.set(this.teams().length ? await this.api.performance(this.days()) : null);
      if (this.memberId && !this.performance()?.items.some((m) => m.id === this.memberId))
        this.memberId = '';
      if (this.tab() !== 'performance' && this.teams().length) await this.loadList();
    } catch (e) {
      if ([401, 403, 404].includes((e as { status?: number }).status ?? 0)) {
        this.teams.set([]);
        this.performance.set(null);
        this.leads.set([]);
        this.tasks.set([]);
      }
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  changeDays(value: string) {
    this.days.set(Number(value));
    void this.reload();
  }
  changeTab(value: 'performance' | 'leads' | 'tasks') {
    if (this.busy()) return;
    this.tab.set(value);
    this.state = '';
    this.page.set(1);
    this.error.set('');
    this.toast.set('');
    this.generation++;
    if (value !== 'performance') void this.loadList();
  }
  filter() {
    this.appliedSearch = this.search.trim();
    this.page.set(1);
    void this.loadList();
  }
  paginate(delta: number) {
    const page = this.page() + delta;
    if (page < 1 || page > this.pages() || this.listLoading()) return;
    this.page.set(page);
    void this.loadList();
  }
  async loadList() {
    const tab = this.tab();
    if (tab === 'performance') return;
    const n = ++this.generation;
    this.listLoading.set(true);
    this.error.set('');
    const query: Record<string, string> = { page: String(this.page()), limit: String(this.limit) };
    if (this.memberId) query['memberId'] = this.memberId;
    if (this.appliedSearch) query['q'] = this.appliedSearch;
    if (this.state) query[tab === 'leads' ? 'stage' : 'status'] = this.state;
    try {
      const result =
        tab === 'leads' ? await this.api.workLeads(query) : await this.api.workTasks(query);
      if (n !== this.generation) return;
      this.total.set(result.total);
      if (this.page() > Math.max(1, Math.ceil(result.total / this.limit))) {
        this.page.set(Math.max(1, Math.ceil(result.total / this.limit)));
        void this.loadList();
        return;
      }
      if (tab === 'leads') this.leads.set(result.items as TeamWorkLead[]);
      else this.tasks.set(result.items as TeamWorkTask[]);
    } catch (e) {
      if (n === this.generation) this.error.set((e as Error).message);
    } finally {
      if (n === this.generation) this.listLoading.set(false);
    }
  }
  openAssign(lead: TeamWorkLead) {
    if (this.busy()) return;
    this.selected.set(lead);
    this.ownerId = '';
    this.requestId = crypto.randomUUID();
    this.error.set('');
    this.toast.set('');
  }
  targetChanged(value: string) {
    this.ownerId = value;
    this.requestId = crypto.randomUUID();
  }
  async assign() {
    const lead = this.selected();
    if (!lead || !this.ownerId || this.busy() || !this.performance()?.canAssign) return;
    this.assigning.set(true);
    this.error.set('');
    try {
      await this.api.assignLead(lead.id, {
        requestId: this.requestId,
        ownerId: this.ownerId,
        version: lead.version,
      });
      this.selected.set(null);
      this.assigning.set(false);
      await this.reload();
      this.toast.set(
        this.t(
          'Lead assigned. Existing tasks keep their assignees.',
          'تم تعيين العميل. تحتفظ المهام الحالية بالمسؤولين عنها.',
        ),
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.assigning.set(false);
    }
  }
  async refreshAssignment() {
    if (this.busy()) return;
    this.selected.set(null);
    await this.reload();
  }
  openTask(
    mode: 'create' | 'assign' | 'status',
    task?: TeamWorkTask,
    action: 'complete' | 'reopen' | 'cancel' = 'complete',
  ) {
    if (this.busy() || !this.performance()?.canManageTasks) return;
    this.taskMode.set(mode);
    this.taskRow.set(task ?? null);
    this.taskError.set('');
    this.toast.set('');
    this.taskTitle = '';
    this.taskDescription = '';
    this.taskAssignee = '';
    this.taskDue = this.performance()?.to ?? '';
    this.taskPriority = 'med';
    this.taskReason = '';
    this.taskAction = action;
    this.taskRequestId = crypto.randomUUID();
    this.taskSignature = '';
    this.taskLeadQuery = '';
    this.chosenTaskLead.set(null);
    this.taskLeadOptions.set([]);
    this.taskLeadTotal.set(0);
    if (mode === 'create') void this.searchTaskLeads();
  }
  closeTask() {
    if (this.busy()) return;
    this.taskMode.set(null);
    this.leadGeneration++;
    this.taskLeadLoading.set(false);
  }
  async searchTaskLeads() {
    const n = ++this.leadGeneration;
    this.taskLeadLoading.set(true);
    try {
      const q: Record<string, string> = { page: '1', limit: '25' };
      if (this.taskLeadQuery.trim()) q['q'] = this.taskLeadQuery.trim();
      const r = await this.api.workLeads(q);
      if (n === this.leadGeneration) {
        this.taskLeadOptions.set(r.items);
        this.taskLeadTotal.set(r.total);
      }
    } catch (e) {
      if (n === this.leadGeneration) this.taskError.set((e as Error).message);
    } finally {
      if (n === this.leadGeneration) this.taskLeadLoading.set(false);
    }
  }
  chooseTaskLead(id: string) {
    this.chosenTaskLead.set(this.taskLeadOptions().find((l) => l.id === id) ?? null);
  }
  taskActionName() {
    return this.taskAction === 'complete'
      ? this.t('Complete task', 'إكمال المهمة')
      : this.taskAction === 'cancel'
        ? this.t('Cancel task', 'إلغاء المهمة')
        : this.t('Reopen task', 'إعادة فتح المهمة');
  }
  async saveTask() {
    const mode = this.taskMode(),
      row = this.taskRow();
    if (!mode || this.busy() || !this.performance()?.canManageTasks) return;
    const data: any =
      mode === 'create'
        ? {
            title: this.taskTitle.trim(),
            description: this.taskDescription.trim(),
            assigneeId: this.taskAssignee,
            dueDate: this.taskDue,
            priority: this.taskPriority,
            leadId: this.chosenTaskLead()?.id ?? null,
          }
        : mode === 'assign'
          ? { version: row!.version, assigneeId: this.taskAssignee }
          : {
              version: row!.version,
              action: this.taskAction,
              ...(this.taskReason.trim() ? { reason: this.taskReason.trim() } : {}),
            };
    if (
      (mode === 'create' && (data.title.length < 2 || !data.assigneeId || !data.dueDate)) ||
      (mode === 'assign' && !data.assigneeId) ||
      (mode === 'status' && this.taskAction === 'cancel' && this.taskReason.trim().length < 10)
    ) {
      this.taskError.set(
        mode === 'status' && this.taskAction === 'cancel'
          ? this.t(
              'Cancellation needs a reason of at least 10 characters.',
              'يتطلب الإلغاء سببًا من ١٠ أحرف على الأقل.',
            )
          : this.t('Complete the required task fields.', 'أكمل بيانات المهمة المطلوبة.'),
      );
      return;
    }
    const signature = JSON.stringify([mode, row?.id, data]);
    if (signature !== this.taskSignature) {
      this.taskSignature = signature;
      this.taskRequestId = crypto.randomUUID();
    }
    const body = { ...data, requestId: this.taskRequestId };
    this.taskSaving.set(true);
    this.taskError.set('');
    try {
      const result =
        mode === 'create'
          ? await this.api.createTask(body)
          : mode === 'assign'
            ? await this.api.assignTask(row!.id, body)
            : await this.api.taskStatus(row!.id, body);
      this.taskMode.set(null);
      this.taskSaving.set(false);
      this.leadGeneration++;
      if (mode === 'create') {
        this.tab.set('tasks');
        this.memberId = '';
        this.state = '';
        this.search = result.reference;
        this.appliedSearch = result.reference;
        this.page.set(1);
      }
      await this.reload();
      this.toast.set(
        mode === 'create'
          ? this.t('Task created and assigned.', 'تم إنشاء المهمة وتعيينها.')
          : mode === 'assign'
            ? this.t('Task assigned.', 'تم تعيين المهمة.')
            : this.t('Task status updated.', 'تم تحديث حالة المهمة.'),
      );
    } catch (e) {
      this.taskError.set((e as Error).message);
    } finally {
      this.taskSaving.set(false);
    }
  }
  async refreshTask() {
    if (this.busy()) return;
    this.closeTask();
    await this.reload();
  }
}
