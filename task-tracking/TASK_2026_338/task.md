# Task: SupervisorEngine — Core Event Loop & Worker Orchestration


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

Build the SupervisorEngine class at `packages/mcp-cortex/src/supervisor/engine.ts`. This class wires the 4 Wave 1 modules (resolver, router, budget, health) into a deterministic event loop that replaces the AI-based supervisor.

The engine runs a setInterval loop (configurable, default 15s). Each cycle calls the Wave 1 module functions in sequence: resolve unblocked tasks, select candidates, route models, spawn workers, check health, enforce budgets, reconcile completions, update states. Emits events via EventEmitter. Includes startup recovery and pre-exit orphan guard.

All complex logic is delegated to the Wave 1 modules. This class is orchestration glue.

## Dependencies

- TASK_2026_335 — Dependency Resolver Module
- TASK_2026_330 — Model Router Module
- TASK_2026_331 — Cost Budget Module
- TASK_2026_332 — Health Monitor Module

## Acceptance Criteria

- [ ] Engine loop processes tasks through the full state machine on configurable interval
- [ ] Workers spawned with correct model/provider, respecting concurrency limit
- [ ] Completed/failed workers trigger correct task state transitions
- [ ] Pre-exit orphan guard and startup recovery work correctly

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/engine.ts (new)
- packages/mcp-cortex/src/supervisor/engine.spec.ts (new)
- packages/mcp-cortex/src/supervisor/index.ts (new)


## Parallelism

Wave 2 — depends on all 4 Wave 1 tasks.
