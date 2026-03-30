# Task Description — TASK_2026_165

## Summary

Fix the auto-pilot multi-session specification so the supervisor registers itself in the nitro-cortex DB before spawning workers, uses the DB-issued session ID as the canonical session identifier, and scopes concurrency accounting to the current session.

## Requirements

1. Auto-pilot startup must call `create_session()` and treat the returned `session_id` as the only canonical supervisor session ID.
2. Session artifacts on disk (`task-tracking/sessions/{SESSION_ID}/`, `state.md`, `log.md`, and `active-sessions.md`) must use that DB-issued session ID.
3. The parallel loop must count only this session's active workers when calculating available concurrency slots.
4. The spec must document `claim_task(task_id, session_id)` as the cross-session deduplication guard when multiple supervisors run concurrently.
5. The shipped scaffold copies must stay aligned with the source `.claude` behavior for the same flow.

## Acceptance Criteria

- Auto-pilot pre-flight/session lifecycle docs call `create_session()` before session directory creation.
- Continue/resume docs and command examples accept the DB-backed `SESSION_YYYY-MM-DDTHH-MM-SS` format for supervisor sessions.
- Parallel-mode docs use session-filtered worker counting and session-scoped `claim_task()` semantics.
- Source `.claude` files and scaffold copies are updated together.
