# Task: Normalize Session ID Format — Consistent T-Separator Everywhere

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

Two session ID formats coexist:
- File-based: `SESSION_2026-03-30_05-41-42` (underscores between date and time)
- DB-based: `SESSION_2026-03-30T09-43-01` (T-separator between date and time)

This causes `get_session` to return `session_not_found` for file-based session IDs, and orphaned claims that can never be matched to their session.

Fix:
1. Pick one canonical format (T-separator, matching ISO 8601 style)
2. Update all session ID generation points to use the canonical format
3. Add a normalization function that converts underscore-format to T-format for backward compatibility
4. Apply normalization in `get_session`, `claim_task`, and `release_task` lookups

## Dependencies

- None

## Acceptance Criteria

- [ ] All new sessions use T-separator format
- [ ] `get_session` accepts both formats (normalizes on lookup)
- [ ] `claim_task` session references use normalized format
- [ ] No `session_not_found` errors for valid sessions with different format

## Parallelism

✅ Can run in parallel — session ID generation and lookup only.

## References

- Auto-pilot trace: SESSION_2026-03-30_05-41-42 not found in DB
- Cortex MCP: `packages/mcp-cortex/src/`
- Session file paths: `task-tracking/sessions/`

## File Scope

- packages/mcp-cortex/src/tools/sessions.ts
- .claude/skills/auto-pilot/SKILL.md (session creation)
