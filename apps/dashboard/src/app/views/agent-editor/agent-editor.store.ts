import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AgentEditorData,
  AgentCategory,
  AgentType,
  KnowledgeScope,
  EditorViewMode,
  McpToolAccess,
  CursorPosition,
} from '../../models/agent-editor.model';
import { MockDataService } from '../../services/mock-data.service';

interface AgentMetadata {
  readonly name: string;
  readonly displayName: string;
  readonly category: AgentCategory;
  readonly tags: readonly string[];
  readonly type: AgentType;
  readonly mcpTools: readonly McpToolAccess[];
  readonly knowledgeScope: readonly KnowledgeScope[];
  readonly changelog: string;
  readonly isBreakingChange: boolean;
}

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
  private readonly mockData = inject(MockDataService);

  public readonly agentList: readonly AgentEditorData[] =
    this.mockData.getAgentEditorList();

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
    const list = this.mockData.getAgentEditorList();
    if (list.length > 0) {
      this.selectAgent(list[0].id);
    }
  }

  public selectAgent(id: string): void {
    if (this.isDirty()) {
      this.saveDraft();
    }
    const agent = this.mockData.getAgentEditorData(id);
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
    this.originalContent.set(this.editorContent());
    this.originalMetadata.set(this.metadata());
    this.selectedAgent.set({ ...agent, currentVersion: agent.currentVersion + 1 });
  }
}
