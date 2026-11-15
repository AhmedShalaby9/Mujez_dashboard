import { Component, signal } from '@angular/core';
import { TeamAiInsights } from '../my-team/ai-insights/team-ai-insights';
@Component({
  selector: 'app-company-ai-analytics',
  imports: [TeamAiInsights],
  template: `<div class="pg">
    <app-team-ai-insights scope="company" [days]="days()" (daysChange)="days.set(+$event)" />
  </div>`,
  styleUrls: ['../../admin-shell/admin-ui.scss', '../company-ui.scss'],
})
export class CompanyAiAnalytics {
  readonly days = signal(30);
}
