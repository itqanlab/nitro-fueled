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
  templateUrl: './knowledge-scope.component.html',
  styleUrl: './knowledge-scope.component.scss',
})
export class KnowledgeScopeComponent {
  protected readonly store = inject(AgentEditorStore);
  protected readonly badges: readonly ScopeBadge[] = SCOPE_BADGES;

  protected readonly activeScopes = computed<ReadonlySet<KnowledgeScope>>(
    () => new Set(this.store.metadata().knowledgeScope),
  );

  protected toggleScope(scope: KnowledgeScope): void {
    const current = this.store.metadata().knowledgeScope;
    const newScopes: readonly KnowledgeScope[] = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];
    this.store.updateMetadataField('knowledgeScope', newScopes);
  }
}
