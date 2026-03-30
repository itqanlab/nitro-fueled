export type ProviderType = 'CLI' | 'API' | 'OAuth';

export type OverrideLevel = 'GLOBAL DEFAULT' | 'ROLE OVERRIDE';

export type RoleCategory = 'Engine Core' | 'Leadership' | 'Development' | 'Quality' | 'DevOps';

export type PresetBadgeType = 'cli' | 'budget' | 'balanced' | 'quality' | 'speed';

export interface ModelOption {
  readonly label: string;
  readonly value: string;
}

export interface ModelOptgroup {
  readonly groupLabel: string;
  readonly options: readonly ModelOption[];
}

export interface AgentAssignment {
  readonly role: string;
  readonly category: RoleCategory;
  readonly icon: string;
  readonly iconClass: string;
  readonly providerType: ProviderType;
  readonly modelOptgroups: readonly ModelOptgroup[];
  readonly selectedModel: string;
  readonly overrideLevel: OverrideLevel;
  readonly overrideNote: string;
  readonly fallbackChain: readonly string[];
  readonly costPerTask: number;
  readonly hasOverride: boolean;
}

export interface SubAgentAssignment {
  readonly name: string;
  readonly parent: string;
  readonly iconColor: string;
  readonly icon: string;
  readonly providerType: ProviderType;
  readonly assignedModel: string;
}

export interface QuickPreset {
  readonly name: string;
  readonly description: string;
  readonly costLabel: string;
  readonly badgeType: PresetBadgeType;
}

export interface ScopeTab {
  readonly label: string;
  readonly count: number | null;
  readonly active: boolean;
}

export interface HierarchyLevel {
  readonly label: string;
  readonly cssClass: string;
}

export interface ModelAssignmentsData {
  readonly scopeTabs: readonly ScopeTab[];
  readonly hierarchyLevels: readonly HierarchyLevel[];
  readonly assignments: readonly AgentAssignment[];
  readonly subAgents: readonly SubAgentAssignment[];
  readonly presets: readonly QuickPreset[];
  readonly totalCostPerTask: number;
  readonly budgetUsed: number;
  readonly budgetTotal: number;
}
