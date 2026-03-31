# Task: Rename Unprefixed .claude/ Dirs and Files to nitro-* (Structural Rename)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Part 1 of 2 — Rename all unprefixed nitro-fueled directories and files in .claude/ to use the nitro-* prefix. Structural renames only — no reference updates in this task. Renames: .claude/skills/orchestration/ → .claude/skills/nitro-orchestration/, .claude/skills/auto-pilot/ → .claude/skills/nitro-auto-pilot/, .claude/skills/technical-content-writer/ → .claude/skills/nitro-technical-content-writer/, .claude/skills/ui-ux-designer/ → .claude/skills/nitro-ui-ux-designer/, .claude/review-lessons/ → .claude/nitro-review-lessons/, .claude/anti-patterns.md → .claude/nitro-anti-patterns.md, .claude/anti-patterns-master.md → .claude/nitro-anti-patterns-master.md. Mirror all renames in apps/cli/scaffold/. Update manifest tracking paths to match new names. Reference updates across agents, commands, and skill files are handled in Part 2 (TASK_2026_280).

## Dependencies

- None

## Acceptance Criteria

- [ ] All 7 unprefixed paths renamed to nitro-* in .claude/
- [ ] Scaffold source mirrors all renames
- [ ] Manifest path keys updated to new names
- [ ] Git history shows renames (not delete+add) where possible

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/ (7 renames)
- .claude/anti-patterns.md
- .claude/anti-patterns-master.md
- .claude/review-lessons/
- apps/cli/scaffold/ (mirror renames)


## Parallelism

⚠️ MUST RUN ALONE — renames cross-cutting directories used by agents, commands, and skills. Do not run concurrently with any task touching .claude/ files.
