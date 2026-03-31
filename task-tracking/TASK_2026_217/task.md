# TASK_2026_217 — Model × Launcher Performance — Frontend Dashboard Page

## Metadata
| Field | Value |
|-------|-------|
| Type | FEATURE |
| Priority | P1-High |
| Complexity | Medium |
| Status | CREATED |
| Dependencies | TASK_2026_216 |
| Created | 2026-03-30 |

## Description
Split 2/2 from TASK_2026_199. Build frontend page at /analytics/model-performance. Model×Launcher heatmap matrix, per-model detail panel, per-launcher section, routing recommendation cards. Click cell for filtered task list.

## File Scope
- apps/dashboard/src/app/views/analytics/model-performance/ (new)
- apps/dashboard/src/app/app.routes.ts
- apps/dashboard/src/app/services/api.service.ts
- apps/dashboard/src/app/models/api.types.ts

## Parallelism
- Can run in parallel: No (depends on 216)
- Conflicts with: TASK_2026_216 (API types)
- Wave: after 216
