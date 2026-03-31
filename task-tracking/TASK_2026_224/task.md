# Task: Server Supervisor Service

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | split       |

## Description

Build the core NestJS Supervisor Service that replaces the Claude Code session-based auto-pilot for server mode. This is the server-side orchestration loop — zero AI tokens, pure code.

**The service manages:**

1. **Task Queue** — reads unblocked tasks from Cortex DB, resolves dependency graph, orders by priority
2. **Worker Spawning** — calls launcher adapters (starting with Claude Code adapter from TASK_2026_221) to spawn workers for queued tasks
3. **Health Monitoring** — polls worker health at configurable intervals, detects stuck/failed workers, triggers retries
4. **Result Collection** — collects worker output when finished, updates task state in DB, triggers next workflow phase
5. **Concurrency Control** — respects max concurrent workers setting, manages worker slots

**The service does NOT:**
- Make AI-driven decisions (routing intelligence comes later)
- Manage the API layer (separate task)
- Replace session-mode auto-pilot (that stays as-is)

**Key design:**
- Injectable NestJS service with start/stop/pause methods
- Configurable: concurrency, poll interval, retry limit, launcher preference
- Event-driven: emits events for all state changes (for WebSocket broadcast later)
- Persistent: survives server restart by reading state from DB on boot

## Dependencies

- TASK_2026_221 — Claude Code Launcher Adapter
- TASK_2026_222 — Extended Cortex DB Schema

## Acceptance Criteria

- [ ] SupervisorService class with start(), stop(), pause(), resume() methods
- [ ] Task queue reads from DB, resolves dependencies, respects priority ordering
- [ ] Workers spawned via launcher adapter interface
- [ ] Health monitoring loop detects stuck/failed workers
- [ ] Concurrency limit enforced
- [ ] State persisted in DB — survives restart

## References

- Current auto-pilot logic: `.claude/skills/auto-pilot/SKILL.md`
- Launcher interface: TASK_2026_220
- Claude adapter: TASK_2026_221

## File Scope

- `apps/dashboard-api/src/supervisor/supervisor.service.ts` (new)
- `apps/dashboard-api/src/supervisor/supervisor.module.ts` (new)
- `apps/dashboard-api/src/supervisor/supervisor.types.ts` (new)
- `apps/dashboard-api/src/supervisor/queue-manager.ts` (new)

## Parallelism

Can run in parallel — new module, no file scope overlap. Depends on TASK_2026_221 and TASK_2026_222.
