import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-field">
      @if (label) {
        <label class="form-field-label">{{ label }}</label>
      }
      <ng-content></ng-content>
      @if (error) {
        <div class="form-field-error" role="alert">{{ error }}</div>
      }
      @if (hint && !error) {
        <div class="form-field-hint">{{ hint }}</div>
      }
    </div>
  `,
  styles: [`
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-field-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .form-field-error {
      font-size: 11px;
      color: var(--error);
    }
    .form-field-hint {
      font-size: 11px;
      color: var(--text-tertiary);
    }
  `],
})
export class FormFieldComponent {
  @Input() label = '';
  @Input() error = '';
  @Input() hint = '';
}
