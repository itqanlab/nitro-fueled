import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';
import { CompatibilityEntry } from '../../../models/agent-editor.model';

@Component({
  selector: 'app-compatibility-list',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compatibility().length > 0) {
      <div class="compat-section">
        <div class="compat-label">Compatibility</div>
        <ul class="compat-list" role="list" aria-label="Compatibility requirements">
          @for (entry of compatibility(); track entry.label) {
            <li class="compat-row">
              <span class="compat-entry-label">{{ entry.label }}</span>
              <span class="compat-version" [attr.aria-label]="'version ' + entry.version">
                {{ entry.version }}
              </span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    .compat-section { margin-top: 16px; }

    .compat-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      margin-bottom: 8px;
    }

    .compat-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .compat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .compat-entry-label {
      font-size: 13px;
      color: var(--text-primary);
    }

    .compat-version {
      font-family: monospace;
      font-size: 12px;
      color: var(--text-secondary);
      flex-shrink: 0;
      margin-left: 8px;
    }
  `],
})
export class CompatibilityListComponent {
  protected readonly store = inject(AgentEditorStore);

  protected readonly compatibility = computed<readonly CompatibilityEntry[]>(
    () => this.store.selectedAgent()?.compatibility ?? [],
  );
}
