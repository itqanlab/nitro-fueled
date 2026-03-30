# Task: Merge session-orchestrator into nitro-cortex — single MCP server

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | REFACTORING          |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Part 1 of 2 — Unified Cortex MCP Server.

Currently the system requires two MCP servers: `session-orchestrator` (worker spawning, iTerm2, health monitoring) and `nitro-cortex` (SQLite DB, task/session tools). This doubles configuration complexity for target projects and splits related functionality across two processes.

Merge session-orchestrator into nitro-cortex so there is ONE MCP server that handles everything: DB queries, worker management, and agent tools.

**What moves into cortex:**
- Worker spawning (spawn_worker, kill_worker)
- Worker monitoring (get_worker_activity, get_worker_stats, list_workers)
- Event system (subscribe_worker, get_pending_events, emit_event)
- iTerm2 integration (tab creation, process management)

**What changes:**
- `apps/session-orchestrator/` becomes a thin wrapper or gets removed
- `libs/nitro-cortex/` gains worker management module
- `settings.json` configured by `init` references one MCP: `nitro-cortex`
- All existing tool names preserved (no breaking changes for skills/agents)

**Cortex-required-by-default policy:**
- When cortex MCP is unavailable: STOP and report error. Do not silently fall back.
- New config option: `allow_file_fallback: true` — user must explicitly opt-in to file-based fallback
- Default: `allow_file_fallback: false`
- Skills and agents check cortex availability at startup, report clearly if missing

**What stays the same:**
- All MCP tool signatures (spawn_worker, get_worker_activity, etc.)
- Worker behavior (iTerm2 tabs, process management)
- DB schema and tools

## Dependencies

- TASK_2026_138 — cortex schema extension (tables must exist)
- TASK_2026_140 — file-DB sync layer (sync utilities)

## Acceptance Criteria

- [ ] Session-orchestrator worker management merged into nitro-cortex
- [ ] Single MCP server configuration in settings.json
- [ ] All existing tool names preserved (no breaking changes)
- [ ] `init` command configures one MCP server (nitro-cortex), not two
- [ ] Cortex-required-by-default: error + stop when MCP unavailable
- [ ] `allow_file_fallback` config option added, default false
- [ ] `apps/session-orchestrator/` deprecated or removed
- [ ] Worker spawning, monitoring, events all work through cortex

## References

- Session-orchestrator: `apps/session-orchestrator/`
- nitro-cortex: `libs/nitro-cortex/`
- Worker-core lib: `libs/worker-core/`
- Architecture doc: `docs/supervisor-worker-architecture-v2.md`

## File Scope

- `libs/nitro-cortex/src/` (add worker management module)
- `libs/worker-core/src/` (may need interface changes)
- `apps/session-orchestrator/` (deprecate/remove)
- `apps/cli/src/commands/init.ts` (single MCP config)

## Parallelism

- Do NOT run in parallel with TASK_2026_138, 139, 140 (cortex dependency chain)
- Can run in parallel with TASK_2026_137 (different files)
