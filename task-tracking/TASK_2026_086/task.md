# Task: Scaffold NestJS app (apps/dashboard-api)

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | DEVOPS       |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Generate a new NestJS 11 app at `apps/dashboard-api` using the `@nx/nest` Nx generator. Configure `project.json` with build and serve targets. Set up the root `AppModule` and a `DashboardModule` skeleton (no business logic yet — placeholder service, controller, and gateway files with empty class bodies). Configure global CORS to allow Angular dev server and any localhost origin. Set the HTTP listener port to match the current `apps/dashboard-service` port so the CLI's dashboard command does not require changes. The server must start cleanly with `nx serve dashboard-api` and respond to a health check at `GET /health`.

## Dependencies

- TASK_2026_073 — provides the apps/ directory and Nx workspace structure

## Acceptance Criteria

- [ ] `apps/dashboard-api` exists with valid `project.json`, `package.json`, `tsconfig.json`
- [ ] `AppModule` and `DashboardModule` created with correct NestJS decorators
- [ ] CORS configured globally to allow localhost origins
- [ ] `nx serve dashboard-api` starts on the same port as current `apps/dashboard-service`
- [ ] `GET /health` returns 200 OK

## References

- apps/dashboard-service/src/cli-entry.ts (check port)

## File Scope

- apps/dashboard-api/project.json
- apps/dashboard-api/package.json
- apps/dashboard-api/package-lock.json
- apps/dashboard-api/tsconfig.json
- apps/dashboard-api/src/main.ts
- apps/dashboard-api/src/app/app.module.ts
- apps/dashboard-api/src/app/health.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.module.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.service.ts
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts
