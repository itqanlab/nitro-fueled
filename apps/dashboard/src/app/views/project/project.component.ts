import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MOCK_QUEUE_TASKS } from '../../services/project.constants';
import { SessionsPanelComponent } from './sessions-panel/sessions-panel.component';
import type { QueueTask, QueueTaskPriority, QueueTaskStatus, QueueViewMode } from '../../models/project-queue.model';

type StatusFilter = QueueTaskStatus | 'ALL';
const KANBAN_COLUMNS: readonly QueueTaskStatus[] = ['CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED'];

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [NgClass, SessionsPanelComponent],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent {
  private readonly apiService = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private pollSubscription: Subscription | null = null;
  private startSubscription: Subscription | null = null;

  public readonly allTasks: readonly QueueTask[] = MOCK_QUEUE_TASKS;
  public readonly viewMode = signal<QueueViewMode>('list');
  public readonly statusFilter = signal<StatusFilter>('ALL');
  public readonly searchQuery = signal('');
  public readonly autoPilotState = signal<'idle' | 'starting' | 'running'>('idle');
  public readonly autoPilotSessionId = signal<string | null>(null);
  public readonly autoPilotError = signal<string | null>(null);
  public readonly filteredTasks = computed(() => {
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();
    return this.allTasks.filter(task => {
      const matchesStatus = status === 'ALL' || task.status === status;
      const matchesQuery = query === '' || task.id.toLowerCase().includes(query) || task.title.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  });
  public readonly runningCount = computed(() => this.allTasks.filter(task => task.status === 'IN_PROGRESS').length);
  public readonly kanbanColumns = computed(() => KANBAN_COLUMNS.map(status => ({ status, tasks: this.filteredTasks().filter(task => task.status === status) })));
  public readonly isAutoPilotBusy = computed(() => this.autoPilotState() !== 'idle');
  public readonly filterOptions: readonly { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'CREATED', label: 'Created' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IMPLEMENTED', label: 'Implemented' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'FIXING', label: 'Fixing' },
    { value: 'COMPLETE', label: 'Complete' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  public readonly statusClassMap: Record<QueueTaskStatus, string> = {
    CREATED: 'status-created', IN_PROGRESS: 'status-in-progress', IMPLEMENTED: 'status-implemented', IN_REVIEW: 'status-in-review',
    FIXING: 'status-fixing', COMPLETE: 'status-complete', FAILED: 'status-failed', BLOCKED: 'status-blocked', CANCELLED: 'status-cancelled',
  };
  public readonly priorityClassMap: Record<QueueTaskPriority, string> = {
    'P0-Critical': 'priority-critical', 'P1-High': 'priority-high', 'P2-Medium': 'priority-medium', 'P3-Low': 'priority-low',
  };
  public readonly statusLabelMap: Record<QueueTaskStatus, string> = {
    CREATED: 'Created', IN_PROGRESS: 'In Progress', IMPLEMENTED: 'Implemented', IN_REVIEW: 'In Review',
    FIXING: 'Fixing', COMPLETE: 'Complete', FAILED: 'Failed', BLOCKED: 'Blocked', CANCELLED: 'Cancelled',
  };

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.startSubscription?.unsubscribe();
      this.stopPolling();
    });
  }

  public setViewMode(mode: QueueViewMode): void { this.viewMode.set(mode); }
  public setStatusFilter(value: StatusFilter): void { this.statusFilter.set(value); }

  public onSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchQuery.set(event.target.value);
    }
  }

  public onTaskClick(task: QueueTask): void {
    if (task.status === 'IN_PROGRESS' && task.sessionId) {
      void this.router.navigate(['/session', task.sessionId]);
    }
  }

  public onStartAutoPilot(): void {
    if (this.isAutoPilotBusy()) {
      return;
    }
    this.autoPilotError.set(null);
    this.autoPilotState.set('starting');
    this.startSubscription?.unsubscribe();
    this.startSubscription = this.apiService.startAutoPilot().subscribe({
      next: ({ sessionId }) => {
        this.autoPilotSessionId.set(sessionId);
        this.startPolling(sessionId);
      },
      error: () => {
        this.autoPilotState.set('idle');
        this.autoPilotSessionId.set(null);
        this.autoPilotError.set('Unable to start Auto-Pilot right now.');
      },
    });
  }

  private startPolling(sessionId: string): void {
    this.stopPolling();
    this.pollSubscription = timer(0, 1500).pipe(switchMap(() => this.apiService.getAutoPilotStatus(sessionId))).subscribe({
      next: ({ status }) => {
        this.autoPilotState.set(status === 'running' ? 'running' : 'starting');
        if (status === 'running') {
          this.stopPolling();
        }
      },
      error: () => {
        this.autoPilotState.set('idle');
        this.autoPilotSessionId.set(null);
        this.autoPilotError.set('Auto-Pilot status polling failed.');
        this.stopPolling();
      },
    });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
