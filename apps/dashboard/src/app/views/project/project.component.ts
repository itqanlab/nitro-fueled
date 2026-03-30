import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { MOCK_QUEUE_TASKS } from '../../services/project.constants';
import type {
  QueueTask,
  QueueTaskPriority,
  QueueTaskStatus,
  QueueViewMode,
} from '../../models/project-queue.model';

/** All possible status filter values including the "show all" sentinel. */
type StatusFilter = QueueTaskStatus | 'ALL';

/** Column definitions for Kanban view — statuses rendered as columns. */
const KANBAN_COLUMNS: readonly QueueTaskStatus[] = [
  'CREATED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'IN_REVIEW',
  'COMPLETE',
  'FAILED',
  'BLOCKED',
];

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [NgClass],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent {
  private readonly router = inject(Router);

  // --- Raw data ---
  public readonly allTasks: readonly QueueTask[] = MOCK_QUEUE_TASKS;

  // --- UI state ---
  public readonly viewMode = signal<QueueViewMode>('list');
  public readonly statusFilter = signal<StatusFilter>('ALL');
  public readonly searchQuery = signal<string>('');
  public readonly isAutoPilotRunning = signal<boolean>(false);

  // --- Derived state ---
  public readonly filteredTasks = computed<readonly QueueTask[]>(() => {
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.allTasks.filter(task => {
      const matchesStatus = status === 'ALL' || task.status === status;
      const matchesQuery =
        query === '' ||
        task.id.toLowerCase().includes(query) ||
        task.title.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  });

  public readonly runningCount = computed(
    () => this.allTasks.filter(t => t.status === 'IN_PROGRESS').length,
  );

  public readonly kanbanColumns = computed(() =>
    KANBAN_COLUMNS.map(status => ({
      status,
      tasks: this.filteredTasks().filter(t => t.status === status),
    })),
  );

  // --- Status filter options ---
  public readonly filterOptions: readonly { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'CREATED', label: 'Created' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IMPLEMENTED', label: 'Implemented' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'COMPLETE', label: 'Complete' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'BLOCKED', label: 'Blocked' },
  ];

  // --- CSS class maps (precomputed, not per-render method calls) ---
  public readonly statusClassMap: Record<QueueTaskStatus, string> = {
    CREATED: 'status-created',
    IN_PROGRESS: 'status-in-progress',
    IMPLEMENTED: 'status-implemented',
    IN_REVIEW: 'status-in-review',
    COMPLETE: 'status-complete',
    FAILED: 'status-failed',
    BLOCKED: 'status-blocked',
    CANCELLED: 'status-cancelled',
  };

  public readonly priorityClassMap: Record<QueueTaskPriority, string> = {
    'P0-Critical': 'priority-critical',
    'P1-High': 'priority-high',
    'P2-Medium': 'priority-medium',
    'P3-Low': 'priority-low',
  };

  // Precomputed display labels — avoids .replace() calls in templates
  public readonly statusLabelMap: Record<QueueTaskStatus, string> = {
    CREATED: 'Created',
    IN_PROGRESS: 'In Progress',
    IMPLEMENTED: 'Implemented',
    IN_REVIEW: 'In Review',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
    BLOCKED: 'Blocked',
    CANCELLED: 'Cancelled',
  };

  // --- Actions ---
  public setViewMode(mode: QueueViewMode): void {
    this.viewMode.set(mode);
  }

  public setStatusFilter(value: StatusFilter): void {
    this.statusFilter.set(value);
  }

  public onSearchInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.searchQuery.set(event.target.value);
  }

  public onTaskClick(task: QueueTask): void {
    if (task.status === 'IN_PROGRESS' && task.sessionId) {
      this.router.navigate(['/session', task.sessionId]).catch(() => {
        // /session/:id route lands in TASK_2026_157; navigation is a no-op until then
      });
      return;
    }
    // Task detail view for non-running tasks deferred to TASK_2026_157
  }

  public onStartAutoPilot(): void {
    // Wired to action in TASK_2026_156 — placeholder handler
    this.isAutoPilotRunning.set(true);
  }
}
