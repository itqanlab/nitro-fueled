# Task Description — TASK_2026_194

## Summary

Normalize session identifiers to the canonical `SESSION_YYYY-MM-DDTHH-MM-SS` format so legacy underscore-form session IDs continue to resolve correctly during MCP lookups and task claiming.

## Requirements

- All newly generated session IDs use the `T` separator.
- Legacy underscore-form session IDs are normalized at MCP tool boundaries before DB reads or writes.
- Task claims and worker/session lookups persist the canonical session ID even when the caller provides the legacy form.
- Session-generation guidance in orchestration docs matches the canonical format.

## Acceptance Criteria

- `create_session()` returns `SESSION_YYYY-MM-DDTHH-MM-SS`.
- `get_session()` resolves both `SESSION_...T...` and `SESSION_..._...` inputs.
- `claim_task()` and `get_next_wave()` persist canonical `session_claimed` values.
- Worker/session MCP lookups no longer fail for valid legacy session IDs.
- `packages/mcp-cortex` test suite and build pass.
