import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';
import { AgentEditorData } from '../../../models/agent-editor.model';

const MAX_VISIBLE_AGENTS = 10;

interface LibraryNavItem {
  readonly label: string;
  readonly isActive: boolean;
}

@Component({
  selector: 'app-agent-list-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './agent-list-sidebar.component.html',
  styleUrl: './agent-list-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentListSidebarComponent {
  protected readonly store = inject(AgentEditorStore);

  protected readonly navItems: readonly LibraryNavItem[] = [
    { label: 'Agents', isActive: true },
    { label: 'Skills', isActive: false },
    { label: 'Commands', isActive: false },
    { label: 'Prompts', isActive: false },
    { label: 'Workflows', isActive: false },
  ];

  protected readonly visibleAgents = computed<readonly AgentEditorData[]>(() =>
    this.store.agentList.slice(0, MAX_VISIBLE_AGENTS),
  );

  protected readonly hiddenCount = computed<number>(() =>
    Math.max(0, this.store.agentList.length - MAX_VISIBLE_AGENTS),
  );

  protected readonly selectedAgentId = computed<string | null>(
    () => this.store.selectedAgent()?.id ?? null,
  );

  protected readonly selectedAgentVersion = computed<number | null>(
    () => this.store.selectedAgent()?.currentVersion ?? null,
  );

  protected selectAgent(id: string): void {
    this.store.selectAgent(id);
  }
}
