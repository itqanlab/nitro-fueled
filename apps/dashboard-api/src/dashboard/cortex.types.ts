/**
 * Type definitions for the cortex SQLite DB layer.
 * DB schema: tasks, sessions, workers, phases, reviews, fix_cycles, events, handoffs.
 */

// ============================================================
// Public-facing response types
// ============================================================

export interface CortexTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  complexity: string;
  dependencies: string[];
  created_at: string;
  updated_at: string;
}

export interface CortexTaskContext extends CortexTask {
  description: string;
  acceptance_criteria: string;
  file_scope: string[];
  model: string | null;
  preferred_provider: string | null;
  worker_mode: string | null;
  custom_flow_id?: string | null;
}

export interface CortexSession {
  id: string;
  source: string;
  started_at: string;
  ended_at: string | null;
  loop_status: string;
  tasks_terminal: number;
  supervisor_model: string;
  supervisor_launcher: string;
  mode: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  last_heartbeat: string | null;
  drain_requested: boolean;
}

export interface CortexSessionWorker {
  id: string;
  task_id: string;
  worker_type: string;
  label: string;
  status: string;
  model: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

export interface CortexSessionSummary extends CortexSession {
  workers: CortexSessionWorker[];
}

export interface CortexWorker {
  id: string;
  session_id: string;
  task_id: string;
  worker_type: string;
  label: string;
  status: string;
  model: string;
  provider: string;
  launcher: string;
  spawn_time: string;
  outcome: string | null;
  retry_number: number;
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

export interface CortexPhase {
  id: number;
  worker_run_id: string;
  task_id: string;
  phase: string;
  model: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  input_tokens: number;
  output_tokens: number;
  outcome: string | null;
}

export interface CortexReview {
  id: number;
  task_id: string;
  review_type: string;
  score: number;
  findings_count: number;
  critical_count: number;
  model_that_built: string;
  model_that_reviewed: string;
}

export interface CortexFixCycle {
  id: number;
  task_id: string;
  fixes_applied: number;
  fixes_skipped: number;
  required_manual: boolean;
  model_that_fixed: string;
}

export interface CortexEvent {
  id: number;
  session_id: string;
  task_id: string | null;
  source: string;
  event_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface CortexTaskTrace {
  task_id: string;
  workers: CortexWorker[];
  phases: CortexPhase[];
  reviews: CortexReview[];
  fix_cycles: CortexFixCycle[];
  events: CortexEvent[];
}

export interface CortexModelPerformance {
  model: string;
  task_type: string | null;
  complexity: string | null;
  phase_count: number;
  review_count: number;
  avg_duration_minutes: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_review_score: number | null;
  avg_cost_usd: number | null;
  failure_rate: number | null;
  last_run: string | null;
}

/** Quality of work produced by a model (grouped by model_that_built + task_type). */
export interface CortexBuilderQuality {
  model: string;
  task_type: string | null;
  review_count: number;
  avg_builder_score: number | null;
}

export interface CortexPhaseTiming {
  phase: string;
  count: number;
  avg_duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
}

// ============================================================
// Raw DB row shapes (better-sqlite3 return types)
// ============================================================

export interface RawTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  complexity: string;
  dependencies: string | null;
  description: string;
  acceptance_criteria: string;
  file_scope: string | null;
  created_at: string;
  updated_at: string;
  model: string | null;
  preferred_provider: string | null;
  worker_mode: string | null;
  custom_flow_id: string | null;
}

export interface RawSession {
  id: string;
  source: string;
  started_at: string;
  ended_at: string | null;
  config: string | null;
  loop_status: string;
  tasks_terminal: number;
  supervisor_model: string;
  supervisor_launcher: string;
  mode: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  last_heartbeat: string | null;
  drain_requested: number;
}

export interface RawWorker {
  id: string;
  session_id: string;
  task_id: string;
  worker_type: string;
  label: string;
  status: string;
  model: string;
  provider: string;
  launcher: string;
  spawn_time: string;
  tokens_json: string | null;
  cost_json: string | null;
  outcome: string | null;
  retry_number: number;
}

export interface RawPhase {
  id: number;
  worker_run_id: string;
  task_id: string;
  phase: string;
  model: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  input_tokens: number;
  output_tokens: number;
  outcome: string | null;
}

export interface RawReview {
  id: number;
  task_id: string;
  review_type: string;
  score: number;
  findings_count: number;
  critical_count: number;
  model_that_built: string;
  model_that_reviewed: string;
}

export interface RawFixCycle {
  id: number;
  task_id: string;
  fixes_applied: number;
  fixes_skipped: number;
  required_manual: number;
  model_that_fixed: string;
}

export interface RawEvent {
  id: number;
  session_id: string;
  task_id: string | null;
  source: string;
  event_type: string;
  data: string | null;
  created_at: string;
}

export interface ModelPerfRow {
  model: string;
  task_type: string | null;
  complexity: string | null;
  phase_count: number;
  review_count: number;
  avg_duration_minutes: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_review_score: number | null;
  avg_cost_usd: number | null;
  failure_rate: number | null;
  last_run: string | null;
}

export interface BuilderQualityRow {
  model: string;
  task_type: string | null;
  review_count: number;
  avg_builder_score: number | null;
}

export interface PhaseTimingRow {
  phase: string;
  count: number;
  avg_duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
}
