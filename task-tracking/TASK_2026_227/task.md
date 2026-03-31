# Task: Worker Output Collection — Structured Parsing

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Build the worker output collection layer that the server supervisor uses to parse and store results from completed workers. The session-mode supervisor (Claude) can interpret free-form output naturally. The server supervisor (Node.js) needs structured parsing.

**Output collection flow:**

1. Worker finishes (process exits or signals completion)
2. Server reads worker output (stdout, files changed, MCP events logged)
3. Parser extracts structured data:
   - Exit code (success/failure)
   - Files created/modified (from git diff)
   - Task completion status (from MCP events the worker logged)
   - Phase completed (PM, Architect, Dev, QA)
   - Review results (if review worker)
   - Error messages (if failed)
4. Store structured result in Cortex DB
5. Trigger next action (next phase, retry, mark complete)

**Key design decisions:**
- Workers should log structured events via MCP (`log_event`, `report_progress`) — the server reads these from DB rather than parsing stdout
- Stdout parsing is a fallback for workers that don't use MCP
- Git diff after worker completion captures file scope

## Dependencies

- TASK_2026_224 — Supervisor Service (consumes the output)
- TASK_2026_221 — Claude Code Adapter (produces the output)

## Acceptance Criteria

- [ ] Output collector reads worker results from MCP events in DB
- [ ] Fallback stdout parser for workers that don't log MCP events
- [ ] Git diff capture for file scope after worker completion
- [ ] Structured result stored in Cortex DB
- [ ] Supervisor can determine next action from collected output

## References

- Current output handling: `.claude/skills/auto-pilot/SKILL.md` (search "worker finished")
- MCP event tools: `query_events`, `log_event`, `report_progress`

## File Scope

- `apps/dashboard-api/src/supervisor/output-collector.ts` (new)
- `apps/dashboard-api/src/supervisor/output-parser.ts` (new)

## Parallelism

Can run in parallel — new files only. Depends on TASK_2026_224.
