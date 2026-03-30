# Plan — TASK_2026_165

## Approach

Update the auto-pilot documentation/spec files that define supervisor startup and scheduling so the DB session becomes authoritative and cross-session worker counts are isolated per session.

## Implementation Steps

1. Update source auto-pilot references and command docs to create the DB session first, use the returned `SESSION_ID`, and switch resume examples to the DB session format.
2. Update parallel-mode guidance to count only workers for the current session and document `claim_task(task_id, SESSION_ID)` as the cross-session guard.
3. Mirror the same behavior into the scaffold `.claude` files shipped by the CLI.
4. Record the completed work in `tasks.md`, `handoff.md`, and the task file scope.

## Validation

1. Review the edited docs for consistent session ID format and session creation order.
2. Verify the task artifacts list all completed work and changed files.
