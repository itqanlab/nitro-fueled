import { Component, computed, inject } from '@angular/core';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { MockDataService } from '../../services/mock-data.service';
import type {
  CommandCenterData,
  TaskStatusBreakdown,
  ActiveSession,
  ActiveTask,
} from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly mockData = inject(MockDataService);

  private readonly commandCenterData = computed<CommandCenterData>(() =>
    this.mockData.getCommandCenterData(),
  );

  // Task status breakdown for stat cards
  public readonly taskBreakdown = computed<TaskStatusBreakdown>(() =>
    this.commandCenterData().taskBreakdown,
  );

  // Total tasks prominently displayed
  public readonly totalTasks = computed(() => this.taskBreakdown().total);

  // Token and cost summary
  public readonly tokenCost = computed(() => this.commandCenterData().tokenCost);
  public readonly totalTokens = computed(() => this.tokenCost().totalTokens);
  public readonly totalCost = computed(() => this.tokenCost().totalCost);
  public readonly recentSessions = computed(() => this.tokenCost().recentSessions);

  // Active sessions
  public readonly activeSessions = computed<readonly ActiveSession[]>(
    () => this.commandCenterData().activeSessions,
  );
  public readonly activeSessionCount = computed(() => this.activeSessions().length);

  // Active tasks (IN_PROGRESS)
  public readonly activeTasks = computed<readonly ActiveTask[]>(
    () => this.commandCenterData().activeTasks,
  );
  public readonly activeTaskCount = computed(() => this.activeTasks().length);

  // Format tokens for display
  public readonly tokensDisplay = computed(() => {
    const tokens = this.totalTokens();
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  });

  // Status value classes for stat cards
  public readonly getStatusValueClass = (status: string): string => {
    switch (status) {
      case 'CREATED':
        return 'status-created';
      case 'IN_PROGRESS':
        return 'status-in-progress';
      case 'IMPLEMENTED':
        return 'status-implemented';
      case 'IN_REVIEW':
        return 'status-in-review';
      case 'COMPLETE':
        return 'status-complete';
      case 'FAILED':
        return 'status-failed';
      case 'BLOCKED':
        return 'status-blocked';
      default:
        return '';
    }
  };

  // Session status indicator class
  public readonly getSessionStatusClass = (status: string): string => {
    return status === 'running' ? 'status-running' : 'status-paused';
  };
}
