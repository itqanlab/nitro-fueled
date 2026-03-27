# Context — TASK_2026_067

## User Intent
Replace the supervisor's 5-minute polling loop with an event-driven completion model using MCP file watchers and supervisor subscriptions.

## Strategy
FEATURE — Full workflow

## Agent Sequence
Architect → Team-Leader (MODE 1) → Developer (systems-developer) → Review Lead + Code Logic + Security reviewers → Completion Phase

## Key Decisions
- New MCP tools: `subscribe_worker`, `get_pending_events`
- fs.watch (one-shot) for each worker condition
- Event queue in-memory, drained on each call to `get_pending_events`
- Supervisor polls events every 30s; stuck detection still every 5 min
- Fallback if `subscribe_worker` unavailable → current 5-min polling
