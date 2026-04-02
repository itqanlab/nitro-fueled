import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AgentEditorData,
  AgentCategory,
  AgentType,
  KnowledgeScope,
  EditorViewMode,
  McpToolAccess,
  CursorPosition,
  AgentMetadata,
} from '../../models/agent-editor.model';
import { ApiService } from '../../services/api.service';

function extractMetadata(agent: AgentEditorData): AgentMetadata {
  return {
    name: agent.name,
    displayName: agent.displayName,
    category: agent.category,
    tags: agent.tags,
    type: agent.type,
    mcpTools: agent.mcpTools,
    knowledgeScope: agent.knowledgeScope,
    changelog: agent.changelog,
    isBreakingChange: agent.isBreakingChange,
  };
}

@Injectable({ providedIn: 'root' })
export class AgentEditorStore {
  private readonly api = inject(ApiService);

  public readonly agentList = signal<readonly AgentEditorData[]>([]);
  public readonly isLoading = signal<boolean>(false);

  public readonly selectedAgent = signal<AgentEditorData | null>(null);
  public readonly editorContent = signal<string>('');
  public readonly cursorPosition = signal<CursorPosition>({
    line: 1,
    col: 1,
    totalLines: 0,
  });
  public readonly viewMode = signal<EditorViewMode>('split');
  public readonly metadata = signal<AgentMetadata>({
    name: '',
    displayName: '',
    category: 'Coordination',
    tags: [],
    type: 'base_template',
    mcpTools: [],
    knowledgeScope: [],
    changelog: '',
    isBreakingChange: false,
  });

  private readonly originalContent = signal<string>('');
  private readonly originalMetadata = signal<AgentMetadata>({
    name: '',
    displayName: '',
    category: 'Coordination',
    tags: [],
    type: 'base_template',
    mcpTools: [],
    knowledgeScope: [],
    changelog: '',
    isBreakingChange: false,
  });

  public readonly isDirty = computed<boolean>(() => {
    const currentContent = this.editorContent();
    const currentMeta = this.metadata();
    const origContent = this.originalContent();
    const origMeta = this.originalMetadata();

    if (currentContent !== origContent) return true;
    return JSON.stringify(currentMeta) !== JSON.stringify(origMeta);
  });

  constructor() {
    this.loadAgents();
  }

  public loadAgents(): void {
    this.isLoading.set(true);
    this.api.getAgents().subscribe({
      next: (agents) => {
        this.agentList.set(agents);
        this.isLoading.set(false);
        if (agents.length > 0 && this.selectedAgent() === null) {
          this.selectAgent(agents[0].id);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  public selectAgent(id: string): void {
    if (this.isDirty()) {
      this.saveDraft();
    }
    const agent = this.agentList().find((a) => a.id === id);
    if (!agent) return;

    const meta = extractMetadata(agent);
    this.selectedAgent.set(agent);
    this.editorContent.set(agent.content);
    this.originalContent.set(agent.content);
    this.metadata.set(meta);
    this.originalMetadata.set(meta);
    this.cursorPosition.set({ line: 1, col: 1, totalLines: agent.content.split('\n').length });
  }

  public updateMetadataField<K extends keyof AgentMetadata>(
    field: K,
    value: AgentMetadata[K],
  ): void {
    this.metadata.update((current) => ({ ...current, [field]: value }));
  }

  public updateContent(content: string): void {
    this.editorContent.set(content);
  }

  public setCursorPosition(pos: CursorPosition): void {
    this.cursorPosition.set(pos);
  }

  public setViewMode(mode: EditorViewMode): void {
    this.viewMode.set(mode);
  }

  public saveDraft(): void {
    const agent = this.selectedAgent();
    if (!agent) return;
    this.originalContent.set(this.editorContent());
    this.originalMetadata.set(this.metadata());
  }

  public saveVersion(): void {
    const agent = this.selectedAgent();
    if (!agent) return;

    const updatedFields: Partial<Omit<AgentEditorData, 'id'>> = {
      ...this.metadata(),
      content: this.editorContent(),
      currentVersion: (agent.currentVersion ?? 0) + 1,
      usedIn: agent.usedIn,
      compatibility: agent.compatibility,
    };

    this.api.updateAgent(agent.id, updatedFields).subscribe({
      next: (updated) => {
        this.agentList.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
        this.selectedAgent.set(updated);
        this.originalContent.set(updated.content);
        this.originalMetadata.set(extractMetadata(updated));
      },
    });
  }

  public createAgent(data: Omit<AgentEditorData, 'id'>): void {
    this.api.createAgent(data).subscribe({
      next: (created) => {
        this.agentList.update((list) => [...list, created]);
        this.selectAgent(created.id);
      },
    });
  }

  public deleteAgent(id: string): void {
    this.api.deleteAgent(id).subscribe({
      next: () => {
        const remaining = this.agentList().filter((a) => a.id !== id);
        this.agentList.set(remaining);
        if (this.selectedAgent()?.id === id) {
          if (remaining.length > 0) {
            this.selectAgent(remaining[0].id);
          } else {
            this.selectedAgent.set(null);
          }
        }
      },
    });
  }
}
