/**
 * Worker-related enum DTOs for OpenAPI documentation.
 * Values match dashboard.types.ts exactly.
 */

/**
 * Worker type values distinguishing between build and review workers.
 */
export const enum WorkerType {
  Build = 'Build',
  Review = 'Review',
}

/**
 * Worker status values representing the execution state.
 */
export const enum WorkerStatus {
  running = 'running',
  completed = 'completed',
  failed = 'failed',
  killed = 'killed',
}

/**
 * Worker health status for monitoring stuck or degraded workers.
 */
export const enum WorkerHealth {
  healthy = 'healthy',
  warning = 'warning',
  stuck = 'stuck',
}

/**
 * Review finding severity levels.
 */
export const enum ReviewSeverity {
  critical = 'critical',
  serious = 'serious',
  moderate = 'moderate',
  minor = 'minor',
  info = 'info',
}

/**
 * Pipeline phase status values.
 */
export const enum PipelinePhaseStatus {
  pending = 'pending',
  active = 'active',
  complete = 'complete',
  failed = 'failed',
}
