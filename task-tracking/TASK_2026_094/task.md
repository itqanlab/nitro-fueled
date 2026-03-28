# Task: Worker-Side Phase Event Emission via MCP `emit_event`

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | FEATURE      |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Add `emit_event(worker_id, label, data)` to the session-orchestrator MCP server so workers can push phase-transition events directly into the supervisor's event queue. Currently the supervisor polls `get_worker_activity` on an interval, which only returns a stale last-tool-call snapshot — it cannot distinguish a long reasoning pause from a genuinely stuck worker.

The fix inverts control entirely: workers call `emit_event` at each major phase transition (IN_PROGRESS written, PM complete, Architecture complete, Dev batch complete, IMPLEMENTED written). The supervisor drains `get_pending_events` reactively and has no need for an interval polling loop. Stuck detection becomes purely event-driven — if no phase event arrives within the configured interval, the worker is truly stuck.

## Dependencies

- TASK_2026_063 (session-orchestrator moved into monorepo — provides the source location)

## Acceptance Criteria

- [ ] MCP server exposes `emit_event(worker_id, label, data)` tool that enqueues an event retrievable via `get_pending_events`
- [ ] Orchestration skill calls `emit_event` at each phase transition: IN_PROGRESS, PM_COMPLETE, ARCHITECTURE_COMPLETE, BATCH_COMPLETE (per batch), IMPLEMENTED
- [ ] Supervisor interval polling loop removed — supervisor is fully event-driven via `get_pending_events`
- [ ] Stuck detection: if no `emit_event` received within configured interval, worker is declared stuck (no `get_worker_activity` polling needed)
- [ ] Existing `subscribe_worker` + `get_pending_events` flow unchanged (backward compatible)
- [ ] Worker log phase timeline populated from emitted events, not from log.md scraping

## References

- packages/session-orchestrator/ (MCP server source)
- .claude/skills/orchestration/SKILL.md (orchestration flow to instrument)
- .claude/skills/auto-pilot/SKILL.md (supervisor monitoring loop to simplify)

## File Scope

- apps/session-orchestrator/src/index.ts
- apps/session-orchestrator/src/event-queue.ts
- .claude/skills/orchestration/SKILL.md
- .claude/skills/auto-pilot/SKILL.md
