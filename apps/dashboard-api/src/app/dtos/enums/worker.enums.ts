/**
 * Worker-related enum DTOs for OpenAPI documentation.
 * Values match dashboard.types.ts exactly.
 * Note: Using regular enums (not const) for Swagger decorator compatibility.
 */

/**
 * Worker type values distinguishing between build and review workers.
 */
export enum WorkerType {
  Build = 'Build',
  Review = 'Review',
}

/**
 * Worker status values representing the execution state.
 */
export enum WorkerStatus {
  running = 'running',
  completed = 'completed',
  failed = 'failed',
  killed = 'killed',
}

/**
 * Worker health status for monitoring stuck or degraded workers.
 */
export enum WorkerHealth {
  healthy = 'healthy',
  warning = 'warning',
  stuck = 'stuck',
}

/**
 * Review finding severity levels.
 */
export enum ReviewSeverity {
  critical = 'critical',
  serious = 'serious',
  moderate = 'moderate',
  minor = 'minor',
  info = 'info',
}

/**
 * Pipeline phase status values.
 */
export enum PipelinePhaseStatus {
  pending = 'pending',
  active = 'active',
  complete = 'complete',
  failed = 'failed',
}
