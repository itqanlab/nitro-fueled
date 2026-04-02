# Task: Add Missing Unit Tests for Tasks 148, 155, 159 Utility Functions

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P3-Low      |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | required    |

## Description

RETRO_2026-03-30_2 found that tasks 148 (Settings Shell), 155 (Task Queue Board), and 159 (New Task Page) all acknowledged missing unit tests for new utility functions as deferred findings.

Add unit tests for:
1. TASK_2026_148 — Settings component utility functions and mock data service
2. TASK_2026_155 — Task queue board filtering/sorting logic
3. TASK_2026_159 — Task creator form validation and submission logic

## Dependencies

- None

## Acceptance Criteria

- [ ] Unit tests added for TASK_2026_148 utility functions
- [ ] Unit tests added for TASK_2026_155 filtering/sorting logic
- [ ] Unit tests added for TASK_2026_159 form validation logic
- [ ] All new tests pass

## Parallelism

✅ Can run in parallel — test files only, no production code changes.

## References

- RETRO_2026-03-30_2 — acknowledged-but-unfixed findings
- apps/dashboard/src/app/pages/settings/
- apps/dashboard/src/app/pages/project/
- apps/dashboard/src/app/pages/new-task/

## File Scope

- apps/dashboard/src/app/pages/settings/**/*.spec.ts (new)
- apps/dashboard/src/app/pages/project/**/*.spec.ts (new)
- apps/dashboard/src/app/pages/new-task/**/*.spec.ts (new)
