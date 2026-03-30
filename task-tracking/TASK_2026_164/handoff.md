# Handoff — TASK_2026_164

## Files Changed
- packages/mcp-cortex/src/process/jsonl-watcher.ts (modified, +95 lines — added processOpenCodeMessage method)
- packages/mcp-cortex/src/db/schema.ts (modified, +30 lines — added 'codex' provider constraint + migration)
- packages/mcp-cortex/src/process/token-calculator.ts (modified, +10 lines — added gpt-5.4-mini and codex-mini-latest)

## Commits
- (pending) fix(mcp-cortex): add opencode worker telemetry integration

## Decisions
- Detect opencode format by checking for `part.sessionID` field presence — avoids adding a provider field to the watcher
- Accumulate tokens from `step_finish` events (per-step increments) rather than waiting for a cumulative result message
- Completion detection already worked via pollAll() PID check — no changes needed there
- DB migration uses same pattern as migrateTasksCheckConstraint (recreate table, copy data)

## Known Risks
- OpenCode `step_finish.cost` field is ignored (tracked via token calculator instead) — may diverge from opencode's own cost reporting
- Codex CLI format not verified against real logs (only opencode tested) — may need adjustments
- Prompt sanitization (Issue 3 from task description) not implemented here — deferred since opencode workers successfully ran through subagent delegation despite using Claude-specific tools
