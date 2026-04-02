# TASK_2026_215 — Auto-Pilot Custom Flow Routing

## Metadata
| Field | Value |
|-------|-------|
| Type | FEATURE |
| Priority | P1-High |
| Complexity | Simple |
| Status | CREATED |
| Dependencies | TASK_2026_214 |
| Created | 2026-03-30 |

## Description
Split 2/2 from TASK_2026_170. When auto-pilot spawns a worker for a task with a custom flow, follow the custom pipeline. Check task metadata for custom flow ID, load from cortex DB, use custom agent sequence. Fall back to built-in flow if none assigned. Log which flow was used.

## File Scope
- .claude/skills/auto-pilot/SKILL.md
- apps/dashboard-api/src/auto-pilot/

## Parallelism
- Can run in parallel: No (depends on 214)
- Conflicts with: none
- Wave: after 214 complete
