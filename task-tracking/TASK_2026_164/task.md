# Task: Fix OpenCode Worker Telemetry Integration

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | required    |

## Description

The MCP nitro-cortex activity tracker doesn't work with opencode-launched workers. Three issues identified during a live auto-pilot session with openai/gpt-5.4 workers:

**Issue 1: Activity tracker blind to opencode workers**
`get_worker_activity()` always returns "starting/0 msgs/0 tools/$0" for opencode workers even when they are actively working (confirmed via log file inspection showing 78+ lines of real activity). The log parser in `spawn.ts` only handles Claude CLI JSON streaming format. OpenCode uses a different JSON structure with fields like `openai.itemId`, `openai.phase`, and different event type naming.

**Issue 2: Completion events never fire**
Worker completion events never fire for opencode workers because the process exit detector doesn't recognize opencode's exit signals. This means the supervisor's `get_pending_events()` always returns empty for opencode sessions, forcing fallback to manual log inspection.

**Issue 3: Prompt sanitization for non-Claude launchers**
OpenCode models may attempt to use Claude-specific tools (Agent tool, Skill tool) that don't exist in their environment. Observed: an opencode worker tried "Delegating to a general subagent" via the Agent tool, which caused apparent stalling (though it actually worked through opencode's own subagent mechanism). The spawn prompt should be adapted for non-Claude launchers to either strip or remap Claude-specific tool references.

## Dependencies

- TASK_2026_142 — nitro-cortex is the merged MCP server where spawn.ts and workers.ts live

## Acceptance Criteria

- [ ] `get_worker_activity()` returns accurate msg count, tool count, cost, and last action for opencode-launched workers
- [ ] Worker completion events fire correctly when an opencode worker process exits
- [ ] Spawn prompts are sanitized for non-Claude launchers — Claude-specific tool references (Agent, Skill) are stripped or remapped when `provider` is `opencode` or `codex`
- [ ] Existing Claude worker telemetry is not broken (regression test)

## References

- Worker log format (opencode): `.worker-logs/TASK_*_opencode_*.log` — uses `openai.itemId`, `openai.phase` fields
- Worker log format (claude): `.worker-logs/TASK_*_claude_*.log` — uses `claudeSessionId`, `claudeConversationId` fields
- spawn.ts: `packages/mcp-cortex/src/process/spawn.ts`
- workers.ts: `packages/mcp-cortex/src/tools/workers.ts`
- Live session evidence: `task-tracking/sessions/SESSION_2026-03-30_05-15-40/`

## File Scope

- packages/mcp-cortex/src/process/spawn.ts (MODIFIED — add opencode log format parser)
- packages/mcp-cortex/src/tools/workers.ts (MODIFIED — fix completion detection for opencode)
- .claude/skills/auto-pilot/references/worker-prompts.md (MODIFIED — add launcher-aware prompt notes)

## Parallelism

✅ Can run in parallel — no file scope overlap with other CREATED tasks (TASK_2026_098, 127, 128, 131, 132, 149, 150, 151, 154, 156, 157, 158 all touch different files)
