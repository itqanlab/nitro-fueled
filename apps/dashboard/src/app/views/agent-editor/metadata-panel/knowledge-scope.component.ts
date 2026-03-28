import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';
import { KnowledgeScope } from '../../../models/agent-editor.model';

interface ScopeBadge {
  readonly value: KnowledgeScope;
  readonly label: string;
}

const SCOPE_BADGES: readonly ScopeBadge[] = [
  { value: 'global', label: 'Global' },
  { value: 'project', label: 'Project' },
  { value: 'team', label: 'Team' },
];

@Component({
  selector: 'app-knowledge-scope',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scope-section">
      <div class="scope-label">Knowledge Scope</div>
      <div class="scope-badges" role="group" aria-label="Knowledge scope selection">
        @for (badge of badges; track badge.value) {
          <button
            type="button"
            class="scope-badge"
            [class.active]="isActive(badge.value)"
            role="switch"
            [attr.aria-checked]="isActive(badge.value)"
            [attr.aria-label]="badge.label + ' scope ' + (isActive(badge.value) ? 'enabled' : 'disabled')"
            (click)="toggleScope(badge.value)"
          >
            {{ badge.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .scope-section { margin-top: 16px; }

    .scope-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      margin-bottom: 8px;
    }

    .scope-badges {
      display: flex;
      flex-direction: row;
      gap: 6px;
      flex-wrap: wrap;
    }

    .scope-badge {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-tertiary);
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }

    .scope-badge:focus-visible {
      outline: 2px solid var(--border-focus);
      outline-offset: 2px;
    }

    .scope-badge.active {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent);
    }
  `],
})
export class KnowledgeScopeComponent {
  protected readonly store = inject(AgentEditorStore);
  protected readonly badges: readonly ScopeBadge[] = SCOPE_BADGES;

  protected readonly activeScopes = computed<readonly KnowledgeScope[]>(
    () => this.store.metadata().knowledgeScope,
  );

  protected isActive(scope: KnowledgeScope): boolean {
    return this.activeScopes().includes(scope);
  }

  protected toggleScope(scope: KnowledgeScope): void {
    const current = this.activeScopes();
    const newScopes: readonly KnowledgeScope[] = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];
    this.store.updateMetadataField('knowledgeScope', newScopes);
  }
}
