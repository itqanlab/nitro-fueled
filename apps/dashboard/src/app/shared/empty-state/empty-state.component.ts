import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  template: `
    <div class="empty-state">
      <span class="empty-icon">{{ icon }}</span>
      <p class="empty-message">{{ message }}</p>
      @if (actionLabel) {
        <button type="button" class="empty-action" (click)="actionEvent.emit()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: var(--text-secondary);
    }
    .empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .empty-message {
      font-size: 14px;
      margin: 0 0 16px;
      color: var(--text-tertiary);
    }
    .empty-action {
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
    }
    .empty-action:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
  `],
})
export class EmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) message!: string;
  @Input() actionLabel = '';
  @Output() actionEvent = new EventEmitter<void>();
}
