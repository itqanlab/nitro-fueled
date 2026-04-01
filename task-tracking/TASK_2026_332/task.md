# Task: Health Monitor & Reconciliation Module


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Build a TypeScript module at `packages/mcp-cortex/src/supervisor/health.ts` that handles worker health monitoring, stuck detection, worker-exit reconciliation, and startup recovery.

## What to build

### Health Monitoring
- `checkWorkerHealth(worker: WorkerRecord, strikeMap: Map<string, number>): HealthResult` — check worker activity (last output timestamp), increment strike counter on inactivity, return kill signal on second consecutive strike
- `checkHeartbeat(worker: WorkerRecord, timeoutMs: number): boolean` — returns false if heartbeat older than timeout (default 5 minutes)

### Worker-Exit Reconciliation
- `reconcileWorkerExit(worker: WorkerRecord, handoff: Handoff | null): ReconcileResult` — when a worker exits, determine actual state:
  - Build/Implement worker with handoff containing 'Changes Made' → IMPLEMENTED
  - Prep worker with handoff → PREPPED
  - Review worker completed → COMPLETE
  - No handoff → FAILED (reset to previous state for retry)

### Startup Recovery
- `recoverStaleSession(session: SessionRecord, workers: WorkerRecord[]): RecoveryPlan` — on engine startup, detect orphaned workers (stale heartbeat or dead PID), return list of workers to kill and tasks to release
- This covers the TASK_2026_257 (Server Restart Recovery) requirement

## References
- Current AI logic: `.claude/skills/nitro-auto-pilot/references/parallel-mode.md` Steps 6-7
- Worker activity: `packages/mcp-cortex/src/tools/workers.ts` (get_worker_activity)
- Handoffs: `packages/mcp-cortex/src/tools/handoffs.ts` (read_handoff)

## Dependencies

- TASK_2026_331

## Acceptance Criteria

- [ ] Two-strike stuck detection: first strike warns, second consecutive strike returns kill signal
- [ ] Heartbeat timeout correctly detects stale workers (>5min default)
- [ ] Worker-exit reconciliation maps handoff presence to correct task state transition
- [ ] Startup recovery detects orphaned workers and produces a recovery plan
- [ ] Unit tests cover: healthy worker, first strike, second strike, stale heartbeat, reconcile with/without handoff, startup recovery

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/health.ts (new)
- packages/mcp-cortex/src/supervisor/health.spec.ts (new)
- packages/mcp-cortex/src/supervisor/types.ts (new — shared types for all modules)


## Parallelism

Wave 1 — can run in parallel with TASK_2026_330, 331, 332. No shared files except types.ts (create if first, import if exists).
