import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';

export interface ButtonGroupOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-button-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="button-group" [ngClass]="'button-group--' + size" role="group">
      @for (option of options; track option.id) {
        <button
          type="button"
          class="button-group-item"
          [class.active]="option.id === selected"
          [attr.aria-pressed]="option.id === selected"
          (click)="selectionChange.emit(option.id)"
        >{{ option.label }}</button>
      }
    </div>
  `,
  styles: [`
    .button-group {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .button-group-item {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      border-right: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .button-group-item:last-child {
      border-right: none;
    }
    .button-group-item:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .button-group-item:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .button-group-item.active {
      background: var(--accent-bg);
      color: var(--accent);
    }
    .button-group--sm .button-group-item {
      padding: 3px 10px;
      font-size: 11px;
    }
  `],
})
export class ButtonGroupComponent {
  @Input({ required: true }) options!: ButtonGroupOption[];
  @Input({ required: true }) selected!: string;
  @Input() size: 'sm' | 'md' = 'md';
  @Output() readonly selectionChange = new EventEmitter<string>();
}
