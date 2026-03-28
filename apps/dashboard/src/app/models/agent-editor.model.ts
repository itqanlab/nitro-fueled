export type AgentCategory = 'Planning' | 'Coordination' | 'Development' | 'Quality' | 'Specialist';
export type AgentType = 'base_template' | 'stack_module';
export type KnowledgeScope = 'global' | 'project' | 'team';
export type EditorViewMode = 'split' | 'editor' | 'preview';

export interface McpToolAccess {
  readonly name: string;
  readonly enabled: boolean;
}

export interface CompatibilityEntry {
  readonly label: string;
  readonly version: string;
}

export interface AgentEditorData {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly category: AgentCategory;
  readonly tags: readonly string[];
  readonly type: AgentType;
  readonly usedIn: readonly string[];
  readonly mcpTools: readonly McpToolAccess[];
  readonly knowledgeScope: readonly KnowledgeScope[];
  readonly currentVersion: number;
  readonly changelog: string;
  readonly isBreakingChange: boolean;
  readonly compatibility: readonly CompatibilityEntry[];
  readonly content: string;
}

export interface CursorPosition {
  readonly line: number;
  readonly col: number;
  readonly totalLines: number;
}
