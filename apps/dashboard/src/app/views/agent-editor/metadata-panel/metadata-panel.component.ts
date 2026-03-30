import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentEditorStore } from '../agent-editor.store';
import { AgentCategory, AgentType } from '../../../models/agent-editor.model';
import { McpToolAccessComponent } from './mcp-tool-access.component';
import { KnowledgeScopeComponent } from './knowledge-scope.component';
import { CompatibilityListComponent } from './compatibility-list.component';

interface CategoryOption {
  readonly value: AgentCategory;
  readonly label: string;
}

interface TypeOption {
  readonly value: AgentType;
  readonly label: string;
}

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 'Planning', label: 'Planning' },
  { value: 'Coordination', label: 'Coordination' },
  { value: 'Development', label: 'Development' },
  { value: 'Quality', label: 'Quality' },
  { value: 'Specialist', label: 'Specialist' },
];

const TYPE_OPTIONS: readonly TypeOption[] = [
  { value: 'base_template', label: 'Base Template' },
  { value: 'stack_module', label: 'Stack Module' },
];

@Component({
  selector: 'app-metadata-panel',
  standalone: true,
  imports: [
    FormsModule,
    McpToolAccessComponent,
    KnowledgeScopeComponent,
    CompatibilityListComponent,
  ],
  templateUrl: './metadata-panel.component.html',
  styleUrl: './metadata-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataPanelComponent {
  protected readonly store = inject(AgentEditorStore);
  protected readonly categoryOptions: readonly CategoryOption[] = CATEGORY_OPTIONS;
  protected readonly typeOptions: readonly TypeOption[] = TYPE_OPTIONS;

  protected readonly agentName = computed<string>(
    () => this.store.selectedAgent()?.name ?? '',
  );

  protected readonly currentVersion = computed<number>(
    () => this.store.selectedAgent()?.currentVersion ?? 1,
  );

  protected readonly usedIn = computed<string>(
    () => this.store.selectedAgent()?.usedIn.join(', ') ?? '',
  );

  protected readonly tags = computed<readonly string[]>(
    () => this.store.metadata().tags,
  );

  protected readonly isBreakingChange = computed<boolean>(
    () => this.store.metadata().isBreakingChange,
  );

  protected onNameChange(value: string): void {
    this.store.updateMetadataField('name', value);
  }

  protected onDisplayNameChange(value: string): void {
    this.store.updateMetadataField('displayName', value);
  }

  protected onCategoryChange(value: AgentCategory): void {
    this.store.updateMetadataField('category', value);
  }

  protected onTypeChange(value: AgentType): void {
    this.store.updateMetadataField('type', value);
  }

  protected onChangelogChange(value: string): void {
    this.store.updateMetadataField('changelog', value);
  }

  protected onBreakingChangeToggle(): void {
    const current = this.store.metadata().isBreakingChange;
    this.store.updateMetadataField('isBreakingChange', !current);
  }

  protected removeTag(tag: string): void {
    const updated = this.tags().filter((t) => t !== tag);
    this.store.updateMetadataField('tags', updated);
  }

  protected onTagKeydown(event: KeyboardEvent, inputEl: HTMLInputElement): void {
    if (event.key !== 'Enter' || !inputEl.value.trim()) return;
    const newTag = inputEl.value.trim();
    if (!this.tags().includes(newTag)) {
      this.store.updateMetadataField('tags', [...this.tags(), newTag]);
    }
    inputEl.value = '';
    event.preventDefault();
  }
}
