# Task: Add sequential execution mode to auto-pilot

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | FEATURE              |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Add `--sequential` flag to auto-pilot that processes the task backlog inline (same session) instead of spawning MCP workers. This addresses the high token burn caused by supervisor overhead in parallel mode — duplicate registry/plan reads every loop, monitoring polling, and cross-session context multiplication.

When `--sequential` is active:
- Skip MCP validation (not needed — no workers spawned)
- Read registry once at startup, build dependency graph
- Pick highest-priority unblocked task, invoke orchestration skill inline (same session)
- After each task completes, re-read only changed status files (not full registry + plan every loop)
- Supports `--limit N` to cap how many tasks to process
- Supports single-task mode (`/auto-pilot --sequential TASK_X`)
- No monitoring loop, no health checks, no polling overhead
- Retry on failure: re-invoke orchestration for same task (up to retry limit)
- Session logging still works (log.md entries for each task start/complete/fail)

This gives users the "process the backlog" capability without the token multiplication of spawning separate MCP worker sessions. Same orchestration quality — same pipeline runs — just sequential and cheaper.

## Dependencies

- None

## Acceptance Criteria

- [ ] `--sequential` flag added to Mode table in auto-pilot SKILL.md
- [ ] Sequential mode skips MCP validation and worker spawning
- [ ] Tasks execute inline via orchestration skill in dependency order
- [ ] `--limit N` works with sequential mode
- [ ] Single-task mode (`--sequential TASK_X`) works
- [ ] Registry/plan reads are minimized (once at start + incremental after each task)
- [ ] Retry logic works without MCP (re-invoke orchestration on failure)
- [ ] Session logging still works (log.md entries for each task processed)
- [ ] Command file (`nitro-auto-pilot.md`) updated with sequential usage examples
- [ ] Concurrent Session Guard still registers sequential sessions in active-sessions.md

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Auto-pilot command: `.claude/commands/nitro-auto-pilot.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/commands/nitro-auto-pilot.md`

## Parallelism

- Can run in parallel with other tasks that don't touch auto-pilot SKILL.md or nitro-auto-pilot.md
- No conflicting CREATED tasks detected in current registry
