# Task: Remove legacy dashboard apps (dashboard-service + dashboard-web)

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

`apps/dashboard-service/` (old Node.js service) and `apps/dashboard-web/` (old React/Vite client) are legacy apps from before the Angular 19 + NestJS migration (TASK_2026_076-092). They are no longer used — the current stack is `apps/dashboard/` (Angular) + `apps/dashboard-api/` (NestJS).

Remove both legacy apps:
- Delete `apps/dashboard-service/` entirely
- Delete `apps/dashboard-web/` entirely
- Remove their entries from `nx.json` / workspace config if referenced
- Remove any cross-references from other apps (imports, configs)
- Verify `npx nx graph` still works after removal

## Dependencies

- None (these apps are already unused)

## Acceptance Criteria

- [ ] `apps/dashboard-service/` deleted
- [ ] `apps/dashboard-web/` deleted
- [ ] No broken references in workspace config (nx.json, tsconfig paths)
- [ ] `npx nx graph` runs without errors
- [ ] No imports referencing deleted apps in remaining codebase

## References

- Angular dashboard: `apps/dashboard/`
- NestJS API: `apps/dashboard-api/`
- Nx workspace: `nx.json`

## File Scope

- `apps/dashboard-service/` (delete)
- `apps/dashboard-web/` (delete)
- `nx.json` (if references exist)
- `tsconfig.base.json` (if paths exist)

## Parallelism

- Can run in parallel with all other CREATED tasks (no file scope overlap with active work)
