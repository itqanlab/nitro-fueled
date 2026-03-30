# Task: Benchmark Suite — Generic Reusable Evaluation Tasks

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| preferred_tier        | balanced    |
| Model                 | default     |
| Testing               | skip        |
| Poll Interval         | default     |
| Health Check Interval | default     |
| Max Retries           | default     |

## Description

Create the `benchmark-suite/` directory structure with generic, project-agnostic evaluation tasks across difficulty tiers (easy, medium, hard) and task types (feature, bugfix, refactoring). Each benchmark task includes a description, a requirements checklist (used by reviewers to score output), and optional setup files.

This is Part 1 of 4 of the Model Evaluation Pipeline feature. The benchmark suite is the foundation — it defines what models are tested against.

### What to Build

1. **Directory structure**: `benchmark-suite/tasks/` with subdirectories per benchmark task, plus `benchmark-suite/config.md`
2. **5-6 benchmark tasks** covering the matrix:
   - Easy: single-file bugfix, add utility function
   - Medium: multi-file feature, refactor extract module
   - Hard: cross-cutting change
3. **Each task contains**:
   - `task.md` — description and requirements checklist (checkboxes reviewers score against)
   - `setup/` — optional seed files for the worktree (if the task needs existing code to modify)
4. **`config.md`** — lists which tasks to include in a run, difficulty weights, and extensibility notes for future project-specific tasks

### Design Constraints

- Tasks MUST be project-agnostic — they should work in any JavaScript/TypeScript repo
- Requirements checklists must be specific enough for automated reviewer scoring (not vague like "code should be clean")
- Structure should be extensible for future project-specific benchmark tasks (design the extension point, don't implement it)

## Dependencies

- None

## Acceptance Criteria

- [ ] `benchmark-suite/` directory exists with config.md and 5+ task subdirectories
- [ ] Each task has task.md with description and requirements checklist
- [ ] Tasks span easy/medium/hard tiers and feature/bugfix/refactoring types
- [ ] Tasks are project-agnostic (no project-specific imports or assumptions)
- [ ] config.md documents the structure and extension point for project-specific tasks

## References

- This task is Part 1 of 4 — Model Evaluation Pipeline for Auto-Pilot
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Task template: `task-tracking/task-template.md`

## File Scope

- benchmark-suite/config.md
- benchmark-suite/tasks/easy-01-single-file-bugfix/task.md
- benchmark-suite/tasks/easy-02-add-utility-function/task.md
- benchmark-suite/tasks/medium-01-multi-file-feature/task.md
- benchmark-suite/tasks/medium-02-refactor-extract-module/task.md
- benchmark-suite/tasks/hard-01-cross-cutting-change/task.md

## Parallelism

✅ Can run in parallel — no file scope overlap with any existing CREATED tasks. This task creates new files in a new directory.
