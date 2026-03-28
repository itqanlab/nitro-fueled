import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (task.pipeline.length > 0) {
      <div class="pipeline">
        @for (step of task.pipeline; track step.stage; let last = $last) {
          <span class="pipeline-step" [ngClass]="step.status">
            @if (step.status === 'done') { &#10003; }
            @if (step.status === 'active') { &#x25CB; }
            {{ step.stage }}
          </span>
          @if (!last) {
            <span class="pipeline-arrow">&#x2192;</span>
          }
        }
      </div>
    }

    <div class="task-item">
      <div class="task-status-indicator" [ngClass]="task.status">
        @switch (task.status) {
          @case ('running') { &#x25B6; }
          @case ('paused') { &#x23F8; }
          @case ('completed') { &#x2713; }
        }
      </div>

      <div class="task-info">
        <div class="task-title">
          <span class="priority-dot" [ngClass]="task.priority"></span>
          {{ task.id }}: {{ task.title }}
          @if (task.status !== 'completed') {
            <span class="autorun-badge" [ngClass]="task.autoRun ? 'on' : 'off'">Auto</span>
          }
        </div>
        <div class="task-meta">
          <span class="task-strategy-badge" [ngClass]="task.type.toLowerCase()">{{ task.type }}</span>
          @if (task.status !== 'completed') {
            @if (task.agentLabel) {
              <span class="task-agent-badge">{{ task.agentLabel }}</span>
            }
            <span class="task-meta-item">&#x23F1; {{ task.elapsedMinutes }} min</span>
          } @else {
            <span class="task-meta-item">{{ task.tokensUsed }} tokens</span>
          }
          <span class="task-meta-item cost-text">{{ '$' + task.cost.toFixed(2) }}</span>
          @if (task.completedAgo) {
            <span class="task-meta-item">{{ task.completedAgo }}</span>
          }
        </div>
      </div>

      @if (task.status !== 'completed') {
        <div class="task-progress">
          <div class="task-progress-bar">
            <div
              class="task-progress-fill"
              [ngClass]="task.status"
              [style.width.%]="task.progressPercent"
            ></div>
          </div>
          <div class="task-progress-label">{{ task.progressPercent }}%</div>
        </div>
        <div class="task-actions">
          <button class="btn btn-sm btn-icon" [title]="task.status === 'running' ? 'Pause' : 'Resume'">
            @if (task.status === 'running') { &#x23F8; } @else { &#x25B6; }
          </button>
          <button class="btn btn-sm btn-icon" title="View">&#x2192;</button>
        </div>
      } @else {
        <div class="task-actions">
          <button class="btn btn-sm">View</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .pipeline {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: var(--bg-primary);
      border-radius: var(--radius);
      margin-bottom: 8px;
      overflow-x: auto;
    }
    .pipeline-step {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .pipeline-step.done { background: var(--success-bg); color: var(--success); }
    .pipeline-step.active { background: var(--accent-bg); color: var(--accent); }
    .pipeline-step.pending { background: var(--bg-tertiary); color: var(--text-tertiary); }
    .pipeline-arrow { color: var(--text-tertiary); font-size: 11px; }

    .task-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      margin-bottom: 8px;
      transition: all 0.15s;
      cursor: pointer;
    }
    .task-item:last-child { margin-bottom: 0; }
    .task-item:hover { border-color: var(--accent); background: var(--bg-tertiary); }

    .task-status-indicator {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .task-status-indicator.running {
      background: #111d2c;
      color: var(--running);
      animation: pulse 2s infinite;
    }
    .task-status-indicator.paused {
      background: var(--warning-bg);
      color: var(--paused);
    }
    .task-status-indicator.completed {
      background: var(--success-bg);
      color: var(--completed);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .task-info { flex: 1; min-width: 0; }
    .task-title {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .task-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 3px;
    }
    .task-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .cost-text { color: var(--warning); }
    .task-agent-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      background: var(--accent-bg);
      color: var(--accent);
    }
    .task-strategy-badge {
      display: inline-flex;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .task-strategy-badge.feature { background: var(--accent-bg); color: var(--accent); }
    .task-strategy-badge.bugfix { background: var(--error-bg); color: var(--error); }
    .task-strategy-badge.refactor { background: #1a1325; color: #9254de; }
    .task-strategy-badge.docs { background: var(--success-bg); color: var(--success); }

    .priority-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .priority-dot.high { background: var(--error); }
    .priority-dot.medium { background: var(--warning); }
    .priority-dot.low { background: var(--success); }

    .autorun-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .autorun-badge.on { background: var(--success-bg); color: var(--success); }
    .autorun-badge.off { background: var(--bg-tertiary); color: var(--text-tertiary); }

    .task-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .task-progress { width: 100px; flex-shrink: 0; }
    .task-progress-bar {
      height: 4px;
      background: var(--bg-hover);
      border-radius: 2px;
      overflow: hidden;
    }
    .task-progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s;
    }
    .task-progress-fill.running { background: var(--running); }
    .task-progress-fill.paused { background: var(--paused); }
    .task-progress-label {
      font-size: 11px;
      color: var(--text-tertiary);
      text-align: right;
      margin-top: 3px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-sm { padding: 3px 10px; font-size: 12px; }
    .btn-icon {
      width: 28px;
      height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
}
