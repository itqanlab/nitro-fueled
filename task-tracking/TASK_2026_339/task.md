# Task: CLI `serve` Command


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add a new Oclif command at `apps/cli/src/commands/serve.ts` that starts the dashboard-api as a persistent foreground process. Accepts --port (default 3001) and --open flags. Handles SIGINT for graceful shutdown.

## Dependencies

- TASK_2026_339 — NestJS SupervisorService

## Acceptance Criteria

- [ ] `npx nitro serve` starts and keeps the server running
- [ ] --port and --open flags work correctly
- [ ] SIGINT triggers graceful shutdown

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/serve.ts (new)


## Parallelism

Wave 3 — sequential after SupervisorService.
