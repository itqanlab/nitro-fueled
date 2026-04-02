# Task: Replace Stale session-orchestrator References in Scaffold with nitro-cortex

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

The MCP server was renamed from `session-orchestrator` to `nitro-cortex` in TASK_2026_142, but the scaffold files that ship to target projects via `npx @itqanlab/nitro-fueled init` still contain ~15 stale references to the old name. This means freshly initialized projects get broken MCP tool calls (`mcp__session-orchestrator__*`) that will fail at runtime.

Replace all `session-orchestrator` → `nitro-cortex` and all `mcp__session-orchestrator__*` → `mcp__nitro-cortex__*` in scaffold files. The backward-compat fallback in `apps/cli/src/utils/mcp-config.ts` is intentional and should remain.

## Dependencies

- None

## Acceptance Criteria

- [ ] Zero occurrences of `session-orchestrator` in `apps/cli/scaffold/` (excluding backward-compat fallback in CLI source)
- [ ] All `mcp__session-orchestrator__*` tool references replaced with `mcp__nitro-cortex__*`
- [ ] Backward-compat fallback in `apps/cli/src/utils/mcp-config.ts` preserved
- [ ] Scaffold files pass a grep check for zero stale references

## References

- TASK_2026_142 — original rename task
- Review lesson: `.claude/review-lessons/backend.md` — "Complete server renames across all user-facing strings"

## File Scope

- .claude/commands/nitro-auto-pilot.md
- CLAUDE.md
- apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md
- apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md
- apps/cli/scaffold/.claude/skills/auto-pilot/references/worker-prompts.md
- apps/cli/scaffold/.claude/skills/orchestration/references/agent-calibration.md
- docs/mcp-nitro-cortex-design.md

## Parallelism

✅ Can run in parallel — scaffold-only changes, no overlap with live source tasks
