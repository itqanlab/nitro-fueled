# Handoff — TASK_2026_194

## Files Changed
- `packages/mcp-cortex/src/tools/session-id.ts` (new, shared canonical/legacy session ID helpers)
- `packages/mcp-cortex/src/tools/sessions.ts` (modified, normalized session lookups and generation)
- `packages/mcp-cortex/src/tools/tasks.ts` (modified, normalized claim paths)
- `packages/mcp-cortex/src/tools/wave.ts` (modified, normalized batch claim path)
- `packages/mcp-cortex/src/tools/workers.ts` (modified, normalized worker session lookups)
- `packages/mcp-cortex/src/tools/events.ts` (modified, normalized event session filters/writes)
- `packages/mcp-cortex/src/tools/telemetry.ts` (modified, normalized session summary lookup)
- `packages/mcp-cortex/src/tools/sessions.spec.ts` (modified, added legacy lookup coverage)
- `packages/mcp-cortex/src/tools/tasks.spec.ts` (new, added legacy claim coverage)
- `packages/mcp-cortex/src/tools/workers.spec.ts` (modified, added legacy worker lookup coverage)
- `.claude/skills/orchestration/SKILL.md` (modified, canonical orchestration session format)
- `apps/cli/scaffold/.claude/skills/orchestration/SKILL.md` (modified, scaffold sync for canonical format)

## Commits
- Pending implementation commit for TASK_2026_194

## Decisions
- Kept normalization at MCP tool boundaries so legacy callers continue to work without rewriting existing session directories or DB rows.
- Reused one shared helper for generation and normalization to keep the canonical format definition in a single place.
- Updated orchestration session-generation guidance because file-backed worker sessions were the remaining source of underscore IDs.

## Known Risks
- Existing historical session directories and documentation examples still use underscore IDs; this change preserves lookup compatibility but does not rename old artifacts.
