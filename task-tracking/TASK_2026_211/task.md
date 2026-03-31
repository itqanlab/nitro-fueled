# TASK_2026_211 — Fix Dashboard Frontend Compile Errors

## Metadata
| Field | Value |
|-------|-------|
| Type | BUGFIX |
| Priority | P1-High |
| Complexity | Simple |
| Status | CREATED |
| Dependencies | none |
| Created | 2026-03-30 |

## Description
Fix pre-existing Angular dashboard compile errors that block `npx nx build dashboard`. Both TASK_2026_169 and TASK_2026_184 acknowledged this during review. Run build, capture errors, fix each one, verify clean build.

## File Scope
- apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts (restored)
- apps/dashboard/src/app/views/session-comparison/session-comparison.component.html (restored)
- apps/dashboard/src/app/views/orchestration/orchestration.component.ts (fixed)
- apps/dashboard/src/app/views/orchestration/orchestration.component.html (restored + fixed)
- apps/dashboard/src/app/views/task-detail/task-detail.component.html (fixed)
- apps/dashboard/src/app/views/project/project.component.html (fixed)

## Parallelism
- Can run in parallel: Yes
- Conflicts with: any task modifying dashboard components
- Wave: priority (unblocks verification)
