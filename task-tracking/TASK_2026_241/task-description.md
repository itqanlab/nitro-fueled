# Task Description — TASK_2026_241

## Problem Statement

The Supervisor currently trusts workers as the sole source of task state transitions. When a worker is killed (OOM, context limit, external signal) or exits without calling `update_task`/`release_task`, the task is left in a stale state indefinitely. In SESSION_2026-03-31T04-03-16, a GLM-5.1 implement worker for TASK_2026_214 exited as "completed" in the session workers list but failed to transition the task to IMPLEMENTED — causing the Supervisor to fire a redundant retry worker.

The root cause: Step 7 (Handle Completions) only reacts to explicit worker-emitted events. If a worker exits without emitting a state-change event, the Supervisor has no fallback mechanism to reconcile the expected vs. actual task state.

## Goal

Add supervisor-side reconciliation logic that triggers on any worker process exit, independently verifies the expected task state transition, and either advances the state or marks the task FAILED — never leaving it stale.

## In Scope

1. **parallel-mode.md** — Step 7 (Handle Completions): Add a reconciliation sub-step that runs after any worker exit is detected. When a worker exits without a state-change event, the supervisor queries the actual task state and compares it against the expected state for that worker type:
   - Prep Worker exited → task should be `PREPPED`. If still `IN_PROGRESS`/`CREATED`, emit a discrepancy event and mark `FAILED` (retry applies).
   - Build/Implement Worker exited → task should be `IMPLEMENTED`. If still `IN_PROGRESS`/`IMPLEMENTING`/`PREPPED`, emit a discrepancy event and advance to `IMPLEMENTED` if handoff artifacts are present, else mark `FAILED`.
   - Review/Fix Worker exited → task should be `COMPLETE`. If still `IN_REVIEW`, emit a discrepancy event and mark `FAILED` (human review needed).

2. **parallel-mode.md** — Step 7: Document the discrepancy event schema logged to the cortex event stream for observability.

3. **parallel-mode.md** — Step 7: Add the "no duplicate spawn" guard — after reconciliation, if the task was already advanced to its expected state (worker self-reported successfully), the Supervisor must NOT spawn another worker for the same task.

4. **SKILL.md** — "Key Principles" and "Step 7" summary: add a bullet (or update existing note) to reflect that the Supervisor is authoritative for task state on worker exit.

## Out of Scope

- Code changes to the nitro-cortex MCP server or DB schema
- Changes to the worker prompt templates or worker behavior
- The reconciliation logic does not attempt to parse or evaluate partial worker output; it only checks the DB task state field

## Acceptance Criteria

- [ ] Supervisor reconciles task state after worker exit regardless of whether the worker called `update_task`
- [ ] If task state has not advanced after worker exit, supervisor advances it or marks it FAILED — never leaves it stale
- [ ] Discrepancy between expected and actual task state after worker exit is logged as an event
- [ ] No duplicate implement/review workers spawned for the same task due to false retries from stale state
- [ ] Behavior documented in `parallel-mode.md` worker completion section

## Stakeholders

- Auto-Pilot Supervisor users (affected by stale task retries)
- Workers spawned by the Supervisor (no direct change needed)
