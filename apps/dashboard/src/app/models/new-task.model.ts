export type StrategyType =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'docs'
  | 'research'
  | 'devops'
  | 'creative'
  | 'custom';

export interface StrategyCard {
  readonly type: StrategyType;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
}

export type WorkflowStepKind = 'checkpoint' | 'agent';

export interface WorkflowStep {
  readonly icon: string;
  readonly label: string;
  readonly kind: WorkflowStepKind;
}

export interface AgentRoleOverride {
  readonly role: string;
  readonly badgeLabel: string;
  readonly badgeColor: 'blue' | 'purple' | 'orange' | 'green';
  readonly agentName: string;
  readonly projectDefault: string;
}

export interface ProviderGroup {
  readonly provider: string;
  readonly models: readonly string[];
}
