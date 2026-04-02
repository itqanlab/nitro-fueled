import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';

type ProgressVariant = 'accent' | 'success' | 'warning' | 'error';
type TaskStatus = 'running' | 'paused' | 'completed';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="progress-bar">
      <div class="progress-fill" [ngClass]="variant" [style.width.%]="boundedValue"></div>
      @if (showLabel) {
        <div class="progress-label">
          @if (label) { {{ sanitizedLabel }} } @else { {{ boundedValue }}% }
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
export class ProgressBarComponent implements OnDestroy {
  private _value = 0;
  private _label?: string;

  @Input({ required: true }) set value(val: number) {
    this._value = Math.max(0, Math.min(100, val));
  }
  
  get value(): number {
    return this._value;
  }

  get boundedValue(): number {
    return this._value;
  }

  @Input() set label(val: string) {
    this._label = val ? String(val).trim() : undefined;
  }

  get label(): string | undefined {
    return this._label;
  }

  get sanitizedLabel(): string {
    return this._label || '';
  }

  private _variant: ProgressVariant = 'accent';

  @Input() set variant(val: ProgressVariant | TaskStatus) {
    this._variant = this.mapVariant(val);
  }

  get variant(): ProgressVariant {
    return this._variant;
  }

  private mapVariant(status: ProgressVariant | TaskStatus): ProgressVariant {
    if (status === 'running' || status === 'paused' || status === 'completed') {
      const variantMap: Record<TaskStatus, ProgressVariant> = {
        'running': 'accent',
        'paused': 'warning', 
        'completed': 'success'
      };
      return variantMap[status];
    }
    return status;
  }

  @Input() showLabel = true;

  ngOnDestroy(): void {
    this._value = 0;
    this._label = undefined;
    this._variant = 'accent';
  }
}
