# TASK_2026_214 — Orchestration Flow Editor — CRUD & Persistence

## Metadata
| Field | Value |
|-------|-------|
| Type | FEATURE |
| Priority | P1-High |
| Complexity | Medium |
| Status | CREATED |
| Dependencies | TASK_2026_167 |
| Created | 2026-03-30 |

## Description
Split 1/2 from TASK_2026_170. Build flow editing and persistence layer on top of read-only visualization from 167. Flow Editor UI (add/remove/reorder steps), Custom Flow Creation, Flow Persistence (cortex DB CRUD), Per-Task Flow Override. Does NOT include auto-pilot integration.

## File Scope
- apps/dashboard/src/app/pages/orchestration/
- apps/dashboard-api/src/dashboard/ (flow CRUD endpoints)
- apps/dashboard/src/app/models/api.types.ts

## Parallelism
- Can run in parallel: No (depends on 167)
- Conflicts with: TASK_2026_167 (same files)
- Wave: after 167 complete
