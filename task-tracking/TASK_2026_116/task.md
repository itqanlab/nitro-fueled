# Task: Rename Commands to nitro-* Prefix — Source (.claude/commands/) — Part 1 of 2

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Testing    | skip        |

## Description

Rename all 17 command files in `.claude/commands/` to use the `nitro-*` prefix. Claude Code uses the filename as the slash command name, so `status.md` becomes `/nitro-status`. This is Part 1 of 2 — source directory only. Part 2 (TASK_2026_117) handles the scaffold sync.

Rename map:
- `auto-pilot.md` → `nitro-auto-pilot.md`
- `create-agent.md` → `nitro-create-agent.md`
- `create-skill.md` → `nitro-create-skill.md`
- `create-task.md` → `nitro-create-task.md`
- `create.md` → `nitro-create.md`
- `evaluate-agent.md` → `nitro-evaluate-agent.md`
- `initialize-workspace.md` → `nitro-initialize-workspace.md`
- `orchestrate-help.md` → `nitro-orchestrate-help.md`
- `orchestrate.md` → `nitro-orchestrate.md`
- `plan.md` → `nitro-plan.md`
- `project-status.md` → `nitro-project-status.md`
- `retrospective.md` → `nitro-retrospective.md`
- `review-code.md` → `nitro-review-code.md`
- `review-logic.md` → `nitro-review-logic.md`
- `review-security.md` → `nitro-review-security.md`
- `run.md` → `nitro-run.md`
- `status.md` → `nitro-status.md`

For each file: rename the file AND update any internal self-references (usage examples that reference the old command name). Also update CLAUDE.md and skill/reference files that mention old command names.

## Dependencies

- None

## Acceptance Criteria

- [ ] All 17 files in `.claude/commands/` renamed to `nitro-*` prefix
- [ ] Internal content in each file updated — no old command names remain in usage examples
- [ ] CLAUDE.md updated if it references any old command names
- [ ] `.claude/skills/` reference files updated for any old command name mentions

## References

- `.claude/commands/` — files to rename
- `CLAUDE.md` — may reference old command names
- `.claude/skills/orchestration/references/` — may reference commands

## File Scope

- `.claude/commands/*.md` (17 files renamed)
- `CLAUDE.md`
- `.claude/skills/orchestration/references/task-tracking.md`
- `.claude/skills/orchestration/references/checkpoints.md`

## Parallelism

✅ Can run in parallel with most tasks — scope is isolated to `.claude/commands/` and docs.

🚫 Do NOT run in parallel with TASK_2026_117 — Part 2 depends on Part 1 completing first.

Suggested wave: Wave 1.
