# Task: Tick Scheduler Service -- Spawn Claude Code Processes per Tick


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P0-Critical |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Create a TickSchedulerService in the dashboard-api auto-pilot module that manages per-session tick intervals. The service spawns a fresh Claude Code CLI process per tick using the session's configured supervisor_model.

Key behaviors:
- startTicks(sessionId, config) begins a per-session setInterval that spawns Claude Code processes
- Each tick spawns: claude --model <supervisor_model> --print -p '<tick-mode prompt with session context>'
- Waits for process exit with timeout (2 min default)
- Parses JSON summary from stdout
- Logs tick result to cortex DB as TICK_COMPLETED or TICK_FAILED event
- Only one tick runs at a time per session (skip if previous tick still running)
- stopTicks/pauseTicks/resumeTicks for lifecycle control
- Configurable tick interval per session (default 120s)

This is the server-side counterpart to the tick-mode prompt (TASK_2026_245). The scheduler is the persistent orchestrator running in NestJS; each tick is a stateless Claude Code process.

## Dependencies

- TASK_2026_245 -- provides the tick-mode auto-pilot prompt that each tick process executes

## Acceptance Criteria

- [ ] TickSchedulerService is an @Injectable NestJS service in the auto-pilot module
- [ ] startTicks(sessionId, config) begins a per-session interval spawning Claude Code processes
- [ ] Each tick spawns claude --model <model> --print with the tick-mode prompt
- [ ] Tick process stdout JSON summary is parsed and logged as TICK_COMPLETED event
- [ ] Tick crashes/timeouts handled gracefully with TICK_FAILED event logging

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/tick-scheduler.service.ts (new)
- apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts (register service)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (TickConfig type)


## Parallelism

Depends on TASK_2026_245. Can run in parallel with frontend tasks. Wave 3.
