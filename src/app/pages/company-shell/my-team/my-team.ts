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
    if (this.assigning()) return;
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
    if (this.assigning()) return;
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
    if (!lead || !this.ownerId || this.assigning() || !this.performance()?.canAssign) return;
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
    if (this.assigning()) return;
    this.selected.set(null);
    await this.reload();
  }
}
