import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <span class="badge" [ngClass]="[variant(), 'badge-' + size()]">
      {{ label() }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge-sm {
      padding: 1px 8px;
      font-size: 11px;
    }
    .badge-md {
      padding: 4px 12px;
      font-size: 12px;
    }
    .badge.success {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid rgba(73, 170, 25, 0.3);
    }
    .badge.warning {
      background: var(--warning-bg);
      color: var(--warning);
      border: 1px solid rgba(216, 150, 20, 0.3);
    }
    .badge.error {
      background: var(--error-bg);
      color: var(--error);
      border: 1px solid rgba(211, 32, 41, 0.3);
    }
    .badge.info {
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid rgba(23, 125, 220, 0.3);
    }
    .badge.neutral {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
  `],
})
export class BadgeComponent {
  public readonly label   = input.required<string>();
  public readonly variant = input<BadgeVariant>('neutral');
  public readonly size    = input<BadgeSize>('md');
}
