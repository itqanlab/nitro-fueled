/**
 * Supervisor module public API.
 *
 * Re-exports all Wave 1 module types and functions plus the SupervisorEngine
 * class so callers can import from one place.
 */

export { SupervisorEngine } from './engine.js';
export type {
  SpawnParams,
  SpawnOutcome,
  SpawnFn,
  EngineConfig,
  CycleStats,
  // Prompt-builder exports
  PromptWorkerType,
  PromptContext,
  BuildPipelineConfig,
} from './engine.js';
export {
  getBuildPipelineConfig,
  buildOrchestrationInstructions,
  buildPhaseTelemetry,
  buildWorkerPrompt,
} from './engine.js';

export { resolveUnblockedTasks, markNewlyUnblocked, buildAdjacencyList, detectCycles } from './resolver.js';
export type { ResolverTask, ResolverTaskStatus, ResolverTaskPriority } from './resolver.js';

export { routeModel } from './router.js';
export type { TaskMeta, Provider, CompatRecord, ModelSelection, WorkerType as RouterWorkerType } from './router.js';

export { checkBudget, getCostBudget, shouldKill } from './budget.js';
export type { BudgetResult } from './budget.js';

export { checkWorkerHealth, checkHeartbeat, reconcileWorkerExit, recoverStaleSession } from './health.js';
export type { WorkerRecord, SessionRecord, Handoff, HealthResult, ReconcileResult, RecoveryPlan } from './types.js';
