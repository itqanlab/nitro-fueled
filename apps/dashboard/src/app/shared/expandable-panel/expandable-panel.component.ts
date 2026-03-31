import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-expandable-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="expandable-panel" [class.is-expanded]="expanded">
      <button
        type="button"
        class="expandable-panel-header"
        [attr.aria-expanded]="expanded"
        (click)="toggle.emit(!expanded)"
      >
        @if (icon) {
          <span class="expandable-panel-icon" aria-hidden="true">{{ icon }}</span>
        }
        <span class="expandable-panel-title">{{ title }}</span>
        <span class="expandable-panel-chevron" aria-hidden="true">&#x25B6;</span>
      </button>
      @if (expanded) {
        <div class="expandable-panel-body">
          <ng-content></ng-content>
        </div>
      }
    </div>
  `,
  styles: [`
    .expandable-panel {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .expandable-panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      background: var(--bg-secondary);
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      text-align: left;
      transition: background 0.15s;
    }
    .expandable-panel-header:hover {
      background: var(--bg-tertiary);
    }
    .expandable-panel-header:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .expandable-panel-icon {
      font-size: 14px;
    }
    .expandable-panel-title {
      flex: 1;
    }
    .expandable-panel-chevron {
      font-size: 10px;
      transition: transform 0.2s ease;
    }
    .is-expanded .expandable-panel-chevron {
      transform: rotate(90deg);
    }
    .expandable-panel-body {
      border-top: 1px solid var(--border);
      padding: 14px;
      background: var(--bg-primary, var(--bg-secondary));
    }
  `],
})
export class ExpandablePanelComponent {
  @Input({ required: true }) title!: string;
  @Input() expanded = false;
  @Input() icon = '';
  @Output() readonly toggle = new EventEmitter<boolean>();
}
