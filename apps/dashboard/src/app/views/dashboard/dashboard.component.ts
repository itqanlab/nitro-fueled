import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { MockDataService } from '../../services/mock-data.service';
import type {
  CommandCenterData,
  TaskStatusBreakdown,
  TaskStatusKey,
  ActiveSession,
  ActiveTask,
} from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, StatusIndicatorComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly mockData = inject(MockDataService);

  // Precomputed status → CSS class map; evaluated once, not per render
  public readonly statusClassMap: Record<TaskStatusKey, string> = {
    CREATED: 'status-created',
    IN_PROGRESS: 'status-in-progress',
    IMPLEMENTED: 'status-implemented',
    IN_REVIEW: 'status-in-review',
    FIXING: 'status-fixing',
    COMPLETE: 'status-complete',
    FAILED: 'status-failed',
    BLOCKED: 'status-blocked',
    CANCELLED: 'status-cancelled',
  };

  private readonly commandCenterData = computed<CommandCenterData>(() =>
    this.mockData.getCommandCenterData(),
  );

  // Task status breakdown for stat cards
  public readonly taskBreakdown = computed<TaskStatusBreakdown>(() =>
    this.commandCenterData().taskBreakdown,
  );

  // Total tasks derived from breakdown fields (not a stored literal)
  public readonly totalTasks = computed(() => {
    const b = this.taskBreakdown();
    return b.CREATED + b.IN_PROGRESS + b.IMPLEMENTED + b.IN_REVIEW + b.FIXING + b.COMPLETE + b.FAILED + b.BLOCKED + b.CANCELLED;
  });

  // Token and cost summary
  public readonly tokenCost = computed(() => this.commandCenterData().tokenCost);
  public readonly totalTokens = computed(() => this.tokenCost().totalTokens);
  public readonly totalCost = computed(() => this.tokenCost().totalCost);
  public readonly recentSessions = computed(() => this.tokenCost().recentSessions);

  // Active sessions — count only 'running' (not paused)
  public readonly activeSessions = computed<readonly ActiveSession[]>(
    () => this.commandCenterData().activeSessions,
  );
  public readonly activeSessionCount = computed(
    () => this.activeSessions().filter(s => s.status === 'running').length,
  );

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
}
