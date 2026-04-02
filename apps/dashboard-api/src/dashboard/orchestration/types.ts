/**
 * Local types for orchestration services
 * These should be moved to shared-types when the build configuration is fixed
 */

export interface FlowAgent {
  /** Agent name (e.g., 'nitro-project-manager', 'nitro-software-architect') */
  name: string;
  /** Human-readable agent title */
  title: string;
  /** Agent type/category */
  type: 'pm' | 'architect' | 'developer' | 'reviewer' | 'tester' | 'designer' | 'writer' | 'researcher' | 'devops';
  /** Brief description of agent's role */
  description: string;
  /** Expected outputs from this agent */
  outputs: string[];
  /** Success criteria for this agent */
  successCriteria: string[];
  /** Whether this phase is optional in the flow */
  optional?: boolean;
  /** Conditions for when this agent is invoked */
  conditions?: string[];
}

export interface FlowPhase {
  /** Sequential order of the phase */
  order: number;
  /** Agent responsible for this phase */
  agent: FlowAgent;
  /** Expected duration in hours */
  estimatedDuration: number;
  /** Deliverables produced in this phase */
  deliverables: string[];
  /** Success criteria for this phase */
  successCriteria: string[];
}

export interface FlowDefinition {
  /** Unique flow identifier */
  id: string;
  /** Human-readable flow name */
  name: string;
  /** Flow type/category */
  type: 'FEATURE' | 'BUGFIX' | 'REFACTORING' | 'DOCUMENTATION' | 'RESEARCH' | 'DEVOPS' | 'OPS' | 'CREATIVE' | 'CONTENT' | 'SOCIAL' | 'DESIGN';
  /** Brief description of when to use this flow */
  description: string;
  /** Priority level for this flow type */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Sequential phases in the flow */
  phases: FlowPhase[];
  /** Keywords that trigger this flow type */
  triggerKeywords: string[];
  /** Estimated total duration in hours */
  estimatedTotalDuration: number;
  /** Whether this flow supports custom variants */
  supportsCustomVariants: boolean;
  /** Related flows */
  relatedFlows?: string[];
  /** Metadata tags */
  tags?: string[];
}

export interface FlowWithMetadata extends FlowDefinition {
  /** Number of times this flow has been executed */
  executionCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average execution time in hours */
  averageExecutionTime: number;
  /** Last execution timestamp */
  lastExecution?: Date;
  /** Number of active instances */
  activeInstances: number;
  /** Custom variants created from this flow */
  customVariants?: string[];
}

export interface FlowMetrics {
  /** Total flows executed */
  totalExecuted: number;
  /** Total successful flows */
  totalSuccessful: number;
  /** Average success rate across all flows */
  averageSuccessRate: number;
  /** Most used flow type */
  mostUsedFlowType: string;
  /** Flow execution trends (last 30 days) */
  executionTrends: {
    date: string;
    count: number;
    success: number;
  }[];
}

export interface CreateFlowRequest {
  /** Source flow definition to clone from */
  sourceFlowId: string;
  /** Custom flow name */
  customName: string;
  /** Custom description */
  customDescription?: string;
  /** Phase modifications (optional) */
  phaseModifications?: {
    [phaseOrder: number]: {
      agent?: string;
      estimatedDuration?: number;
      optional?: boolean;
    };
  };
}

export interface CreateFlowResponse {
  /** ID of the created custom flow */
  flowId: string;
  /** Name of the created custom flow */
  flowName: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Status of creation */
  status: 'created' | 'error';
  /** Error message if creation failed */
  error?: string;
}

export interface FlowListQuery {
  /** Filter by flow type */
  type?: FlowDefinition['type'];
  /** Filter by custom vs built-in */
  isCustom?: boolean;
  /** Sort field */
  sortBy?: 'name' | 'executionCount' | 'successRate' | 'lastExecution';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

export interface FlowListResponse {
  /** Array of flow definitions */
  flows: FlowWithMetadata[];
  /** Total count matching query */
  total: number;
  /** Query parameters used */
  query: FlowListQuery;
}

export interface FlowValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Validation rule that was violated */
  rule: string;
}

export interface FlowValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Array of validation errors */
  errors: FlowValidationError[];
  /** Warnings (non-blocking issues) */
  warnings: string[];
}

// ── Custom Flow types ────────────────────────────────────────────────────────

export interface CustomFlowPhaseRecord {
  order: number;
  agentName: string;
  agentTitle: string;
  optional: boolean;
  estimatedDuration: number;
  deliverables: string[];
}

/** DB row shape for custom_flows table */
export interface CustomFlowRecord {
  id: string;
  name: string;
  description: string | null;
  source_flow_id: string | null;
  phases: CustomFlowPhaseRecord[];
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFlowDto {
  name: string;
  description?: string;
  sourceFlowId?: string;
  phases?: CustomFlowPhaseRecord[];
}

export interface UpdateCustomFlowDto {
  name?: string;
  description?: string;
  phases?: CustomFlowPhaseRecord[];
}

export interface TaskFlowOverrideRequest {
  flowId: string;
}