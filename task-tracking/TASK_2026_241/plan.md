# Implementation Plan — TASK_2026_241

## Approach

Doc-only changes to two files in the auto-pilot skill. No code changes. No MCP server changes. The fix adds a supervisor-side reconciliation protocol to `parallel-mode.md` (the authoritative Step 7 reference) and updates `SKILL.md` to reflect that the Supervisor is authoritative for task state on worker exit.

## Architecture Decision

**Option A (chosen)**: Supervisor-side reconciliation on worker exit, documented as part of Step 7 in `parallel-mode.md`.

**Why A over alternatives**:
- Workers already report state through `update_task` + event emission. The Supervisor already calls `get_pending_events()` + `list_workers()` in Step 6/7. We simply add a fallback branch: *if* a worker shows as exited/stopped but no state-change event was received for that task, perform a `get_task_context(task_id)` check and reconcile.
- This is a pure documentation change that specifies the expected behavior in the existing Step 7 protocol. No new tools, no schema changes.
- Keeps the architecture as designed: Supervisor is the single reconciler, workers are untrusted.

**Option B (rejected)**: Add a heartbeat-based TTL to worker exits. More complex, requires schema changes to track "expected completion state" per worker, and adds latency. Out of scope for a doc fix.

## Files to Change

| File | Action | Change Summary |
|------|--------|----------------|
| `.claude/skills/auto-pilot/references/parallel-mode.md` | Modify | Add reconciliation sub-protocol to Step 7: worker-exit detection, expected-state mapping table, discrepancy event schema, advance/mark-FAILED rules, duplicate-spawn guard |
| `.claude/skills/auto-pilot/SKILL.md` | Modify | Update Step 7 summary in Core Loop section + add bullet in Key Principles: "Supervisor is authoritative for task state on worker exit" |

## Step 7 Reconciliation Protocol (to be added to parallel-mode.md)

The reconciliation logic runs as a sub-step inside Step 7 each time a worker is detected as exited without a matching state-change event in `get_pending_events()`.

### Trigger Condition

A reconciliation check is triggered when ALL of the following are true:
1. A worker appears as `stopped` or `exited` (not `running`) in `list_workers()`.
2. No `TASK_STATE_CHANGE` event was received for the corresponding `task_id` in the current `get_pending_events()` response.
3. The worker's `task_id` is still in an active (non-terminal) state in `get_tasks()`.

### Expected-State Mapping

| Worker Type | Pre-exit State(s) | Expected State After Exit |
|-------------|-------------------|--------------------------|
| Prep Worker | `IN_PROGRESS`, `CREATED` | `PREPPED` |
| Build Worker (single mode) | `IN_PROGRESS`, `CREATED` | `IMPLEMENTED` |
| Implement Worker (split mode) | `IMPLEMENTING`, `PREPPED`, `IN_PROGRESS` | `IMPLEMENTED` |
| Review/Fix Worker | `IN_REVIEW`, `IMPLEMENTED` | `COMPLETE` |

### Reconciliation Steps

1. Call `get_task_context(task_id)` to get the current actual state.
2. Compare actual state to expected state from the table above.
3. **If actual state == expected state**: Worker self-reported successfully before exiting. No action needed. Emit an info-level event: `RECONCILE_OK`.
4. **If actual state != expected state** (state did not advance):
   a. Emit a `RECONCILE_DISCREPANCY` event to the cortex event stream with:
      - `worker_id`: the exited worker's ID
      - `task_id`: the task being reconciled
      - `worker_type`: Prep / Build / Implement / Review
      - `actual_state`: the DB state at time of check
      - `expected_state`: what the supervisor expected
      - `action`: `mark_failed` or `advance` (see rules below)
   b. **For Prep Workers**: mark task `FAILED`. Retry per retry limit. Prep output is incomplete.
   c. **For Build/Implement Workers**: check for presence of `handoff.md` in the task folder.
      - If `handoff.md` exists: advance task to `IMPLEMENTED` (worker likely committed code but missed the status update). Log note in event: `auto-advanced: handoff artifact present`.
      - If `handoff.md` is absent: mark task `FAILED`. Retry.
   d. **For Review/Fix Workers**: mark task `FAILED`. Spawn a new Review+Fix Worker on the next tick (counts as retry).
5. Update task state via `update_task(task_id, fields=JSON.stringify({status: "FAILED"}))` or `update_task(task_id, fields=JSON.stringify({status: "IMPLEMENTED"}))` as determined in step 4b/4c/4d.
6. Release the claim: `release_task(task_id, SESSION_ID)`.
7. On the next loop tick, the task will be re-evaluated: FAILED tasks are retried up to the retry limit; IMPLEMENTED tasks become `READY_FOR_REVIEW`.

### Duplicate Spawn Guard

Before spawning any worker in Step 5:
1. Check `list_workers()` for any worker with `task_id == <candidate task_id>` and `status == running`.
2. If such a worker exists, skip this task for the current tick (do not spawn a duplicate).
3. Log a `SKIP_DUPLICATE_SPAWN` info event and continue to the next candidate.

This guard prevents the false-retry pattern observed in SESSION_2026-03-31T04-03-16.

## Discrepancy Event Schema

```json
{
  "event_type": "RECONCILE_DISCREPANCY",
  "worker_id": "<worker_id>",
  "task_id": "<TASK_YYYY_NNN>",
  "worker_type": "prep|build|implement|review",
  "actual_state": "<DB state at check time>",
  "expected_state": "<state per expected-state mapping>",
  "action": "mark_failed|auto_advance",
  "advance_reason": "handoff_artifact_present|null"
}
```

## Key Principles Update (SKILL.md)

Add to Key Principles:
> **14. Supervisor is authoritative for task state on worker exit** — after detecting a worker process exit without a matching state-change event, the Supervisor reconciles the expected vs. actual task state and acts (advance or mark FAILED). Workers are untrusted for state transitions; the Supervisor is the single source of truth.

## Batch Structure

Single batch — both files are doc-only edits with no cross-file dependency. The implement worker reads `parallel-mode.md` and `SKILL.md`, inserts the documented protocol, and exits.

## Risk Assessment

- **Low risk**: No code changes, no MCP server changes, no schema changes.
- **Doc consistency**: The new Step 7 protocol references `handoff.md` as an artifact check — this is already documented in the orchestration skill as a mandatory Build Worker artifact, so the reference is valid.
- **Edge case**: The `handoff.md`-based auto-advance is a heuristic. If a worker wrote partial code and `handoff.md` but didn't finish, the Review Worker will catch it. Acceptable — it's better than leaving the task stale.
