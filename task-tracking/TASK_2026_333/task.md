# Task: CLI Mode — Wire SupervisorEngine into `run` Command


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

Update the existing CLI `run` command to use the new code-based SupervisorEngine instead of spawning an AI supervisor session.

## What to build
- Update `apps/cli/src/commands/run.ts` to import and instantiate SupervisorEngine
- `npx nitro run --batch` mode: create session in cortex DB, start engine, process queue, exit when empty
- `npx nitro run TASK_YYYY_NNN` mode: create session, engine processes single task + its review, exit
- Terminal output: colored progress using ora/chalk — show spawned workers, completions, costs, final summary
- Engine events → terminal output (subscribe to engine EventEmitter)
- Graceful SIGINT/SIGTERM handling: call engine.stop(), wait for orphan guard, then exit
- Session summary on exit: tasks completed, total cost, total duration, workers spawned

## References
- Current run command: `apps/cli/src/commands/run.ts`
- SupervisorEngine: `packages/mcp-cortex/src/supervisor/engine.ts`
- Current CLI patterns: check other commands in `apps/cli/src/commands/` for UX conventions

## Dependencies

- TASK_2026_334 — SupervisorEngine Class (provides the engine to wire)

## Acceptance Criteria

- [ ] `npx nitro run --batch` processes the full task queue and exits when empty
- [ ] `npx nitro run TASK_YYYY_NNN` processes a single task and its review then exits
- [ ] Terminal shows colored progress output (worker spawned, completed, cost)
- [ ] SIGINT triggers graceful shutdown with orphan guard
- [ ] Exit summary shows tasks completed, total cost, duration

## References

- task-tracking/task-template.md

## File Scope

- apps/cli/src/commands/run.ts (modify)
- apps/cli/src/utils/engine-output.ts (new — terminal output formatter)


## Parallelism

Wave 3 — can run in parallel with TASK_2026_336. Different apps, no shared files.
