# Supervisor-Worker Architecture v2

> Design document for the token-optimized supervisor-worker communication layer.
> Created: 2026-03-29 | Status: PLANNED

## Problem Statement

The auto-pilot supervisor burns excessive tokens through:
1. **Fat SKILL.md** — 192KB loaded at startup (~48K tokens, ~55% of Sonnet's context)
2. **Redundant loop reads** — registry.md + plan.md + status files re-read every 5-10 minutes (~108KB/hour waste)
3. **No structured handoff** — Review Worker re-discovers what Build Worker did (~50-100KB wasted per task)
4. **File-based queries** — supervisor reads entire files to extract small pieces of data

## Architecture Overview

```
                    ┌─────────────┐
                    │ nitro-cortex │
                    │   (SQLite)   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │ Supervisor │   │Build Worker│   │Review Worker│
    │ (auto-pilot)│  │(orchestrate)│  │(orchestrate) │
    │            │   │            │   │             │
    │ DB queries │   │ file writes│   │ DB reads    │
    │ event logs │   │ + DB sync  │   │ + file reads│
    └───────────┘   └───────────┘   └─────────────┘
```

## Execution Modes

| Mode | Command | Sessions | MCP Required | Best For |
|------|---------|----------|-------------|----------|
| Manual (interactive) | `/orchestrate TASK_X` | 1 (current) | No | Single task, hands-on |
| Sequential (autonomous) | `/auto-pilot --sequential` | 1 (current) | No | Backlog on a budget |
| Parallel (autonomous) | `/auto-pilot` | N+1 (supervisor + workers) | Yes | Maximum throughput |

## Supervisor Core Loop (v2)

### Startup (one-time)
1. Load slim SKILL.md (~15KB) + mode-specific reference
2. Query `tasks` table → cache dependency graph
3. Read plan.md "Current Focus" → cache
4. Enter loop

### On Event (subscribe_worker fires)
1. Re-read ONLY the changed task's status file (~10 bytes)
2. Sync status to DB: `upsert_task(task_id, status)`
3. Update single node in cached dependency graph
4. Decide next action → spawn if slot available

### On Timer (every 5 min — health only)
1. Call `get_worker_activity` for each active worker
2. Check health (stuck/compaction detection)
3. NO file reads. NO graph rebuilds.

## Worker Communication Protocol

### Build Worker → Review Worker (handoff.md)

```markdown
# Handoff — TASK_YYYY_NNN

## Files Changed
- path/to/file.ts (new, 142 lines)
- path/to/other.ts (modified, +38 -12)

## Commits
- abc123: feat(scope): description

## Decisions
- Key architectural decision and why

## Known Risks
- Areas with weak coverage or edge cases
```

Written by Build Worker as last step before IMPLEMENTED.
Read by Review Worker as first step — replaces review-context.md.
Dual-written: file (for fallback) + `write_handoff()` DB call.

### Event Logging (DB-first, file-rendered)

All events logged via `log_event()` MCP tool during execution.
log.md rendered from `events` table at session end for human audit trail.

### Bidirectional Signals (optional, default off)

```
escalate_to_user: false   # default — fully autonomous
escalate_to_user: true    # opt-in — worker can signal NEED_INPUT
```

Workers check for signal files at phase boundaries (PM → Architect → Dev).
Supervisor can signal: ABORT, SKIP_REVIEW.
Workers can signal: BLOCKED, NEED_INPUT (only when escalate_to_user = true).

## DB Schema (nitro-cortex extension)

### tasks table
Replaces registry.md for supervisor queries.
```sql
task_id TEXT PK, status TEXT, type TEXT, priority TEXT,
complexity TEXT, dependencies TEXT, model TEXT,
created_at TEXT, updated_at TEXT
-- Indexed: status, priority, type
```

### handoffs table
Structured Build-to-Review communication.
```sql
id INTEGER PK, task_id TEXT FK, worker_type TEXT,
files_changed TEXT (JSON), commits TEXT (JSON),
decisions TEXT (JSON), risks TEXT (JSON), created_at TEXT
```

### events table
Replaces log.md for queryable event history.
```sql
id INTEGER PK, session_id TEXT, task_id TEXT,
source TEXT, event_type TEXT, data TEXT (JSON), created_at TEXT
-- Indexed: session_id, task_id, event_type
```

## File-DB Sync Rules

| Direction | When | Rule |
|-----------|------|------|
| status file → DB | Worker writes status | Supervisor syncs on detection |
| DB → registry.md | `nitro-fueled status` runs | Rendered from DB (read-only artifact) |
| DB → log.md | Session ends | Rendered from events table |
| task.md → DB | `/nitro-create-task` runs | Metadata mirrored to tasks table |
| handoff.md ↔ DB | Build Worker finishes | Dual-written (file + DB) |

**Conflict resolution**: File wins for status (workers are authoritative). DB wins for queries (optimized).
**Fallback**: Everything works file-only when cortex unavailable. DB can be rebuilt entirely from files.

## Per-Task File Inventory (v2)

### Kept (agent prose — stays as files)
- `task.md` — task definition (human-authored)
- `context.md` — orchestrator init
- `task-description.md` — PM output
- `plan.md` — Architect output
- `tasks.md` — Team-Leader batch tracking
- `handoff.md` — Build→Review structured communication (NEW)
- `review-code-style.md` — Style review findings
- `review-code-logic.md` — Logic review findings
- `review-security.md` — Security review findings
- `test-report.md` — Test results
- `completion-report.md` — Human-facing summary
- `session-analytics.md` — Per-task metrics

### Removed
- `review-context.md` — replaced by handoff.md
- `orchestrator-history.md` — replaced by events table
- `worker-logs/*.md` — replaced by event rows in DB

### Moved to DB (structured data)
- `status` — still written as file (worker authority), mirrored to DB
- `registry.md` — rendered from DB, no longer hand-maintained
- `active-sessions.md` — replaced by sessions table in cortex
- `state.md` — replaced by session_state in cortex

## Token Impact Summary

| Component | Before (v1) | After (v2) | Savings |
|-----------|-------------|------------|---------|
| SKILL.md load | 192KB | ~15KB | **93%** |
| Per-hour loop overhead | ~108KB | ~5KB | **95%** |
| Build→Review handoff | ~50-100KB | ~1KB | **95%+** |
| Supervisor startup | ~223KB | ~30KB | **87%** |
| Total per 3-task session | ~1.5MB | ~400KB | **73%** |

## Implementation Tasks

| Wave | Task | Description | Depends On |
|------|------|-------------|------------|
| 1a | TASK_2026_134 (IN_PROGRESS) | Slim SKILL.md → core + references | — |
| 1b | TASK_2026_137 | Handoff artifact (Build→Review) | — |
| 1c | TASK_2026_138 | Cortex schema (tasks, handoffs, events) | — |
| 2a | TASK_2026_135 | Event-driven supervisor loop | 134 |
| 2b | TASK_2026_136 | Partial task.md reads | 134 |
| 3 | TASK_2026_139 | Supervisor DB migration | 134, 138 |
| 4 | TASK_2026_140 | File-DB sync layer | 138, 139 |
