# Task: Event-Driven Worker Completion — MCP File Watcher + Supervisor Subscriptions

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | default     |
| Provider   | default     |
| Testing    | skip        |

## Description

Replace the supervisor's 5-minute polling loop with an event-driven completion model. Today the supervisor polls every 5 minutes to discover if a worker finished — it may wait up to 5 minutes after a worker exits before taking the next action. This is wasteful and slows down the entire pipeline.

The fix is a two-part contract: the supervisor tells the MCP server *exactly* what file-system condition signals completion for each worker it spawns. The MCP server watches those conditions via `fs.watch` and fires a completion event the moment they are satisfied. The supervisor drains a lightweight event queue on a short interval (30s) and processes completions immediately.

The 5-minute interval remains only for **stuck detection** — verifying workers that haven't fired a completion event are still making progress.

## Acceptance Criteria

- [ ] New MCP tool `subscribe_worker` accepts per-worker watch conditions (see spec below)
- [ ] MCP server sets up `fs.watch` for each registered condition immediately after subscription
- [ ] When a condition is satisfied, MCP marks the worker `finished` and appends to event queue
- [ ] New MCP tool `get_pending_events` returns and drains the event queue (idempotent drain)
- [ ] Supervisor calls `subscribe_worker` immediately after each successful `spawn_worker`
- [ ] Supervisor polls `get_pending_events` every 30 seconds instead of per-worker health checks
- [ ] Supervisor processes drained events immediately (no waiting for next poll cycle)
- [ ] Stuck detection (`get_worker_activity`) still runs every 5 minutes for workers that have not yet fired a completion event
- [ ] If `subscribe_worker` is unavailable (older MCP server), supervisor falls back to current polling behavior
- [ ] All existing worker types have correct watch conditions defined (see spec below)

## Specification

### New MCP Tool: `subscribe_worker`

```typescript
subscribe_worker(
  worker_id: string,
  conditions: WatchCondition[]   // any condition met → worker is finished
)
→ { subscribed: boolean, watched_paths: string[] }
```

**WatchCondition types:**

```typescript
// File content exactly matches a trimmed string value
{ type: 'file_value', path: string, value: string, event_label: string }

// File contains a specific line or header anywhere in its content
{ type: 'file_contains', path: string, contains: string, event_label: string }

// File appears (creation triggers completion)
{ type: 'file_exists', path: string, event_label: string }
```

All `path` values are relative to the worker's `working_directory`.

### New MCP Tool: `get_pending_events`

```typescript
get_pending_events()
→ {
    events: Array<{
      worker_id: string,
      event_label: string,
      triggered_at: string,   // ISO timestamp
      condition: WatchCondition
    }>
  }
```

Calling this tool drains the queue — events are removed after being returned. If called twice rapidly, the second call returns an empty list.

### Watch Conditions Per Worker Type

| Worker Type       | Condition Type    | Path                                          | Value / Contains             | Event Label          |
|-------------------|-------------------|-----------------------------------------------|------------------------------|----------------------|
| Build Worker      | `file_value`      | `task-tracking/TASK_X/status`                 | `IMPLEMENTED`                | `BUILD_COMPLETE`     |
| Review Lead       | `file_contains`   | `task-tracking/TASK_X/review-context.md`      | `## Findings Summary`        | `REVIEW_DONE`        |
| Test Lead         | `file_exists`     | `task-tracking/TASK_X/test-report.md`         | —                            | `TEST_DONE`          |
| Fix Worker        | `file_value`      | `task-tracking/TASK_X/status`                 | `COMPLETE`                   | `FIX_DONE`           |
| Completion Worker | `file_value`      | `task-tracking/TASK_X/status`                 | `COMPLETE`                   | `COMPLETION_DONE`    |
| Cleanup Worker    | `file_value`      | `task-tracking/TASK_X/status`                 | `IN_PROGRESS` OR `IMPLEMENTED` OR `COMPLETE` | `CLEANUP_DONE` |

### MCP Server Implementation Notes

- Use Node.js `fs.watch` (or `chokidar` if already a dependency) on each registered path
- Watch is set up immediately when `subscribe_worker` is called — even if the file doesn't exist yet (`persistent: false`, `recursive: false`)
- On any `change` or `rename` event on the watched path: read the file, evaluate the condition, if satisfied → enqueue the event and mark the worker `finished` in the registry
- `fs.watch` listener is removed after the condition is first satisfied (one-shot)
- If the file doesn't exist when the watch fires (e.g., brief rename), retry read once after 100ms
- Event queue is in-memory; lost on MCP server restart (acceptable — supervisor reconciles via status files on startup)
- Multiple conditions per worker: first one satisfied wins; all watchers are cleaned up

### Supervisor Changes

**After `spawn_worker` succeeds (Step 5e):**
```
Call subscribe_worker(worker_id, conditions_for_worker_type(task_id, worker_type))
Log: "SUBSCRIBED {worker_id} for TASK_X — watching {N} condition(s)"
```

**Monitoring loop (Step 6):**
```
Every 30 seconds:
  1. Call get_pending_events() → drain event queue
  2. For each event: trigger completion handler (Step 7) for that worker
  3. After processing events, check remaining active workers (no event yet):
     - If worker age > 5 minutes since last stuck check: call get_worker_activity()
     - Apply two-strike stuck detection as before
  4. Write state.md
```

**Fallback (backward compat):**
```
If subscribe_worker tool is not found in MCP tool list:
  Log: "WARN — subscribe_worker unavailable, falling back to 5-minute polling"
  Use current behavior (no change)
```

## Dependencies

- TASK_2026_059 (MCP persist worker registry to disk) — should be done first so MCP server state is durable; not a hard block but recommended
- session-orchestrator MCP server source: `/Volumes/SanDiskSSD/mine/session-orchestrator/`

## File Scope

- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/` — new tools, fs.watch logic, event queue
- `.claude/skills/auto-pilot/SKILL.md` — update spawn flow and monitoring loop
- `.claude/commands/auto-pilot.md` — update pre-flight if needed

## Parallelism

Can NOT run in parallel with TASK_2026_059 or TASK_2026_060 (all touch MCP server and auto-pilot SKILL.md).
Wave: after TASK_2026_059.
