import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { WizardStep } from '../../../models/onboarding.model';

interface StepView {
  readonly index: number;
  readonly label: string;
  readonly state: 'done' | 'current' | '';
  readonly isDone: boolean;
}

@Component({
  selector: 'app-wizard-step-indicator',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="steps">
      @for (step of stepsView(); track step.index; let last = $last) {
        <div class="step-item">
          <div class="step-number" [ngClass]="step.state">
            @if (step.isDone) { ✓ } @else { {{ step.index }} }
          </div>
          <span class="step-label" [ngClass]="step.state">{{ step.label }}</span>
        </div>
        @if (!last) {
          <div class="step-line" [class.done]="step.isDone"></div>
        }
      }
    </div>
  `,
  styles: [`
    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 36px;
      gap: 0;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .step-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      border: 2px solid var(--border);
      color: var(--text-tertiary);
      flex-shrink: 0;

      &.done {
        background: var(--success);
        border-color: var(--success);
        color: #fff;
      }

      &.current {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    }

    .step-label {
      font-size: 12px;
      color: var(--text-tertiary);

      &.done { color: var(--success); }
      &.current { color: var(--accent); font-weight: 500; }
    }

    .step-line {
      width: 28px;
      height: 2px;
      background: var(--border);
      margin: 0 6px;

      &.done { background: var(--success); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WizardStepIndicatorComponent {
  public readonly steps = input.required<readonly WizardStep[]>();
  public readonly currentStep = input.required<number>();

  public readonly stepsView = computed<readonly StepView[]>(() => {
    const current = this.currentStep();
    return this.steps().map((s) => ({
      index: s.index,
      label: s.label,
      state: s.index < current ? 'done' as const : s.index === current ? 'current' as const : '' as const,
      isDone: s.index < current,
    }));
  });
}
