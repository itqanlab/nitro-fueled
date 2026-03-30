# Task: Scaffold Sync Audit — Verify All Scaffold Files Match Source

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

RETRO_2026-03-30_2 found that scaffold files shipped to new projects via `npx @itqanlab/nitro-fueled init` contain stale references that break new installations. TASK_2026_137 specifically found `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` referencing deleted artifacts, permanently breaking all new projects' review phase.

Perform a full audit:
1. Diff every file in `apps/cli/scaffold/.claude/` against its source counterpart in `.claude/`
2. Identify any stale references (old tool names, deleted artifacts, renamed files)
3. Fix all mismatches so scaffold is in sync with source

## Dependencies

- None

## Acceptance Criteria

- [ ] Every file in `apps/cli/scaffold/.claude/` matches its source in `.claude/` (accounting for intentional genericization)
- [ ] Zero stale `session-orchestrator` references in scaffold (TASK_2026_181 overlap check)
- [ ] Zero references to deleted/renamed artifacts
- [ ] Scaffold passes a grep check for known stale patterns

## Parallelism

✅ Can run in parallel — scaffold files only, no overlap with other CREATED tasks.

## References

- RETRO_2026-03-30_2 — auto-applied lesson in backend.md
- TASK_2026_137 — original finding
- TASK_2026_181 — stale session-orchestrator references (may overlap)

## File Scope

- apps/cli/scaffold/.claude/skills/
- apps/cli/scaffold/.claude/commands/
- apps/cli/scaffold/.claude/agents/
- apps/cli/scaffold/.claude/review-lessons/
- apps/cli/scaffold/.claude/anti-patterns.md
