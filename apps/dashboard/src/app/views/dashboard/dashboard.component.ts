import { Component, inject } from '@angular/core';
import { MockDataService } from '../../services/mock-data.service';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { TaskCardComponent } from '../../shared/task-card/task-card.component';
import { Agent } from '../../models/agent.model';

interface QuickAction {
  readonly icon: string;
  readonly label: string;
  readonly color: string;
}

interface TeamGroup {
  readonly team: string;
  readonly members: readonly Agent[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, TaskCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly mockData = inject(MockDataService);

  public readonly project = this.mockData.getProjects()[0];
  public readonly activeTasks = this.mockData.getActiveTasks();
  public readonly completedTasks = this.mockData.getCompletedTasks();
  public readonly agents = this.mockData.getAgents();
  public readonly activity = this.mockData.getActivity();
  public readonly analytics = this.mockData.getAnalytics();

  public readonly budgetPercent =
    (this.analytics.budgetUsed / this.analytics.budgetTotal) * 100;

  public readonly quickActions: readonly QuickAction[] = [
    { icon: '+', label: 'New Task', color: 'blue' },
    { icon: '\u25B6', label: 'Run Command', color: 'green' },
    { icon: '\uD83D\uDD0D', label: 'Review Code', color: 'orange' },
    { icon: '\uD83D\uDCC4', label: 'Generate Docs', color: 'purple' },
    { icon: '\uD83D\uDCCA', label: 'View Client Report', color: 'red' },
    { icon: '\uD83D\uDD0E', label: 'Search Learnings', color: 'teal' },
  ];

  public readonly teamGroups: readonly TeamGroup[] = this.buildTeamGroups();

  private buildTeamGroups(): TeamGroup[] {
    const grouped = new Map<string, Agent[]>();
    for (const agent of this.agents) {
      const existing = grouped.get(agent.team);
      if (existing) {
        existing.push(agent);
      } else {
        grouped.set(agent.team, [agent]);
      }
    }
    return Array.from(grouped.entries()).map(([team, members]) => ({
      team,
      members,
    }));
  }
}
