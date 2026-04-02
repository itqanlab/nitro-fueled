import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { SkillUsageBubbleComponent } from './skill-usage-bubble/skill-usage-bubble.component';
import { ApiService } from '../../services/api.service';
import type {
  TaskStatusBreakdown,
  TaskStatusKey,
  ActiveSession,
  ActiveTask,
  SessionCost,
} from '../../models/dashboard.model';
import type { DashboardStats } from '../../models/api.types';

const EMPTY_BREAKDOWN: TaskStatusBreakdown = {
  CREATED: 0, IN_PROGRESS: 0, IMPLEMENTED: 0, IN_REVIEW: 0,
  FIXING: 0, COMPLETE: 0, FAILED: 0, BLOCKED: 0, CANCELLED: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, StatusIndicatorComponent, EmptyStateComponent, SkillUsageBubbleComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly api = inject(ApiService);

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

  private readonly stats = toSignal(
    this.api.getStats().pipe(catchError(() => of(null as DashboardStats | null))),
    { initialValue: null as DashboardStats | null },
  );

  public readonly taskBreakdown = computed<TaskStatusBreakdown>(() => {
    const s = this.stats();
    if (!s) return EMPTY_BREAKDOWN;
    return {
      CREATED: s.byStatus['CREATED'] ?? 0,
      IN_PROGRESS: s.byStatus['IN_PROGRESS'] ?? 0,
      IMPLEMENTED: s.byStatus['IMPLEMENTED'] ?? 0,
      IN_REVIEW: s.byStatus['IN_REVIEW'] ?? 0,
      FIXING: s.byStatus['FIXING'] ?? 0,
      COMPLETE: s.byStatus['COMPLETE'] ?? 0,
      FAILED: s.byStatus['FAILED'] ?? 0,
      BLOCKED: s.byStatus['BLOCKED'] ?? 0,
      CANCELLED: s.byStatus['CANCELLED'] ?? 0,
    };
  });

  public readonly totalTasks = computed(() => {
    const s = this.stats();
    return s?.totalTasks ?? 0;
  });

  public readonly totalTokens = computed(() => this.stats()?.totalTokens ?? 0);
  public readonly totalCost = computed(() => this.stats()?.totalCost ?? 0);
  public readonly completionRate = computed(() => this.stats()?.completionRate ?? 0);
  public readonly activeWorkers = computed(() => this.stats()?.activeWorkers ?? 0);

  public readonly tokensDisplay = computed(() => {
    const tokens = this.totalTokens();
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  });

  // Kept for template compatibility — empty until session hydration is wired
  public readonly activeSessions = computed<readonly ActiveSession[]>(() => []);
  public readonly activeSessionCount = computed(() => 0);
  public readonly activeTasks = computed<readonly ActiveTask[]>(() => []);
  public readonly activeTaskCount = computed(() => 0);

  public readonly recentSessions = computed<readonly SessionCost[]>(() => {
    const s = this.stats();
    if (!s?.recentSessions) return [];
    return s.recentSessions.map((rs) => ({
      sessionId: rs.sessionId,
      date: rs.date.slice(0, 10),
      tokens: rs.tokens,
      cost: rs.cost,
    }));
  });
}
