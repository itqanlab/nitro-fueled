import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

type ProgressVariant = 'accent' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="progress-bar">
      <div class="progress-fill" [ngClass]="variant" [style.width.%]="value"></div>
      @if (showLabel) {
        <div class="progress-label">
          @if (label) { {{ label }} } @else { {{ value }}% }
        </div>
      }
    </div>
  `,
  styles: [`
    .progress-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-fill {
      height: 6px;
      border-radius: 3px;
      transition: width 0.3s;
    }
    .progress-fill.accent {
      background: var(--accent);
    }
    .progress-fill.success {
      background: var(--success);
    }
    .progress-fill.warning {
      background: var(--warning);
    }
    .progress-fill.error {
      background: var(--error);
    }
    .progress-label {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 40px;
    }
  `],
})
export class ProgressBarComponent {
  @Input({ required: true }) value!: number;
  @Input() label?: string;
  @Input() variant: ProgressVariant = 'accent';
  @Input() showLabel = true;
}
