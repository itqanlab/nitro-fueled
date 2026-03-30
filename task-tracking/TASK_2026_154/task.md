# Task: Stateless Supervisor — Offload All State to MCP DB

## Metadata

| Field                 | Value                  |
|-----------------------|------------------------|
| Type                  | REFACTORING            |
| Priority              | P0-Critical            |
| Complexity            | Medium                 |
| Preferred Tier        | heavy                  |
| Model                 | default                |
| Testing               | skip                   |
| Poll Interval         | default                |
| Health Check Interval | default                |
| Max Retries           | 2                      |

## Description

The supervisor accumulates context on every tick: it reads state.md, writes log.md, reads status files, reads task.md files, and reads registry.md. This context growth is the primary reason sessions stall or hit compaction before processing enough tasks.

The MCP session-orchestrator server already has the DB and tools to hold all of this state. The supervisor should be a thin event loop that queries the DB and reacts — it should carry nothing in context between ticks.

**Current (context-accumulating) loop:**
```
read state.md           → loads supervisor state into context
read registry.md        → loads all task metadata into context
read status files       → polls task state via filesystem
read task.md (JIT)      → loads task detail into context
write state.md          → re-serializes full state table
write log.md            → appends log row
```

**Target (stateless) loop:**
```
mcp.get_tasks(status=[CREATED,IMPLEMENTED])   → task queue (IDs + priority only)
mcp.list_workers(compact:true)                → active worker slots
mcp.spawn_worker(task_id, prompt, model)      → spawn if slots free
mcp.get_pending_events()                      → completions, failures, stuck
mcp.upsert_task(task_id, {status})            → state transitions
sleep(interval)
loop
```

Nothing persisted in the supervisor's context between ticks. Compaction becomes irrelevant — the supervisor re-queries DB state on every cycle. Sessions can process an unlimited number of tasks.

**Changes required in SKILL.md and parallel-mode.md:**

1. **Eliminate state.md** as a primary data store. The supervisor no longer reads or writes state.md during the loop. State.md becomes an optional debug artifact written once at session start (configuration only — concurrency, limit, interval) and never updated again.

2. **Eliminate log.md writes from the supervisor loop.** Log rows are either (a) written by a dedicated MCP `log_event` tool call, or (b) dropped entirely. The supervisor does not append to files.

3. **Eliminate all status file reads.** Task state comes from `mcp.get_tasks()` or `mcp.get_pending_events()` only. The supervisor never reads `task-tracking/TASK_*/status`.

4. **Eliminate registry.md reads.** Task queue comes from `mcp.get_tasks(status=CREATED, order=priority)`. The registry is a human-readable artifact, not a supervisor data source.

5. **Eliminate task.md reads from the loop.** Task metadata needed for spawning (title, type, model preference) comes from `mcp.get_task(task_id)`. The supervisor never opens task.md.

6. **Compaction survival via DB re-query.** If compaction occurs, the supervisor's next action is `mcp.list_workers()` + `mcp.get_tasks()` to reconstruct current state. No state.md recovery needed.

7. **Worker completion detection via `mcp.get_pending_events()`** — not by polling status files. The MCP server pushes events when workers exit.

The result: the supervisor's context at any point in time contains only (a) the SKILL.md instructions loaded at startup, (b) the current tick's MCP tool responses (a few lines each), and (c) the next spawn prompt being constructed. Nothing accumulates.

## Dependencies

- None (SKILL.md and parallel-mode.md changes are self-contained)

## Acceptance Criteria

- [ ] `parallel-mode.md` Core Loop Steps 1-8 rewritten: every task state read uses `mcp.get_tasks()` or `mcp.get_pending_events()`, no file reads.
- [ ] `parallel-mode.md` removes all `state.md` read/write instructions from the loop body. state.md is written once at session start (config only) and never touched again.
- [ ] `parallel-mode.md` removes all `log.md` append instructions from the loop body. Log writes are replaced with `mcp.log_event(...)` calls (or dropped if the tool is unavailable).
- [ ] `SKILL.md` Data Access Rules table updated: registry.md, status files, and task.md are ALL banned inside the supervisor loop — DB is the only source.
- [ ] `SKILL.md` compaction survival section updated: recovery is `mcp.list_workers() + mcp.get_tasks()`, not `read state.md`.
- [ ] `SKILL.md` HARD RULES gains: "NEVER write to log.md or state.md inside the monitoring loop — use MCP tools. File I/O inside the loop is a context leak."

## References

- `.claude/skills/auto-pilot/SKILL.md` — HARD RULES, Data Access Rules, Core Loop
- `.claude/skills/auto-pilot/references/parallel-mode.md` — Steps 1-8, state/log format
- `.claude/skills/auto-pilot/references/session-lifecycle.md` — state.md/log.md format (will be demoted)
- `docs/mcp-session-orchestrator-design.md` — MCP tool API reference

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/auto-pilot/references/parallel-mode.md`
- `.claude/skills/auto-pilot/references/session-lifecycle.md`

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_152 or TASK_2026_153 — all three tasks modify SKILL.md and parallel-mode.md.

Suggested execution wave: Wave 3, after TASK_2026_152 and TASK_2026_153 complete.
