import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

type StatusType = 'running' | 'completed' | 'paused' | 'failed' | 'offline';
type StatusSize = 'sm' | 'md';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <span
      class="status-dot"
      [ngClass]="[status(), 'dot-' + size(), pulse() && status() === 'running' ? 'dot-pulse' : '']"
      [attr.aria-label]="status()"
    ></span>
  `,
  styles: [`
    .status-dot {
      display: inline-block;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-sm {
      width: 8px;
      height: 8px;
    }
    .dot-md {
      width: 12px;
      height: 12px;
    }
    .status-dot.running {
      background: var(--running);
    }
    .status-dot.completed {
      background: var(--completed);
    }
    .status-dot.paused {
      background: var(--paused);
    }
    .status-dot.failed {
      background: var(--failed);
    }
    .status-dot.offline {
      background: var(--text-tertiary);
    }
    .dot-pulse {
      animation: status-pulse 2s infinite;
    }
    @keyframes status-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `],
})
export class StatusIndicatorComponent {
  public readonly status = input.required<StatusType>();
  public readonly pulse  = input<boolean>(true);
  public readonly size   = input<StatusSize>('md');
}
