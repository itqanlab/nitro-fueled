# TASK_2026_218 — Session Run Configuration Panel

## Metadata
| Field | Value |
|-------|-------|
| Type | FEATURE |
| Priority | P1-High |
| Complexity | Simple |
| Status | CREATED |
| Dependencies | TASK_2026_210 |
| Created | 2026-03-30 |

## Description
Split 1/2 from TASK_2026_200. Add 'Advanced Options' collapsible section to session creation UI from TASK_2026_210: Max Retries (0-5), Max Compactions (0-10), Poll Interval (10s-5m), Concurrency (1-10), Dry Run toggle. Persist last-used values to localStorage. Show config summary in session header.

## File Scope
- apps/dashboard/src/app/views/project/project.component.ts
- apps/dashboard/src/app/views/project/project.component.html

## Parallelism
- Can run in parallel: No (depends on 210)
- Conflicts with: TASK_2026_210, TASK_2026_219
- Wave: after 210
