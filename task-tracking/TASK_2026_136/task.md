# Task: Partial task.md reads — extract metadata only before spawn

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | REFACTORING          |
| Priority              | P2-Medium            |
| Complexity            | Simple               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Before spawning a worker, the supervisor reads the full task.md (~2-5KB) but only uses ~200 bytes of metadata (Type, Complexity, Model, Priority) for the spawn decision and worker prompt. The worker reads the full task.md again in its own session anyway.

Refactor the pre-spawn JIT quality gate to read only the metadata table (first ~20 lines of task.md) instead of the full file. The Description, Acceptance Criteria, References, and File Scope sections are not needed by the supervisor — workers handle those.

Additionally, cache the extracted metadata per task so that if the same task needs a Review Worker after Build Worker completes, the metadata is not re-read from disk.

## Dependencies

- TASK_2026_134 — SKILL.md must be split into references first

## Acceptance Criteria

- [ ] Pre-spawn reads only task.md metadata table (first ~20 lines), not the full file
- [ ] Extracted metadata cached per task ID for the session duration
- [ ] Review Worker spawn reuses cached metadata from Build Worker spawn (no re-read)
- [ ] JIT quality gate still validates Type, Priority, Complexity enums
- [ ] Worker prompt still includes task ID, type, complexity, model — no missing fields

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (or `references/parallel-mode.md` after 134)

## Parallelism

- Do NOT run in parallel with TASK_2026_133, TASK_2026_134, TASK_2026_135 (same file scope)
- Can run in parallel with all other CREATED tasks
