# Task: CLI run Command

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

Implement the `npx nitro-fueled run` command that starts the Supervisor loop to process tasks autonomously.

**What run does:**

1. **Pre-flight checks**:
   - Verify `.claude/` and `task-tracking/` exist (suggest `init` if not)
   - Verify `registry.md` exists and has CREATED or IMPLEMENTED tasks
   - Verify MCP session-orchestrator is configured and reachable (from TASK_013)

2. **Start Supervisor session**:
   - Spawn a Claude Code session that runs `/auto-pilot` (or `/auto-pilot TASK_ID` for single task)
   - Pass through any flags (--concurrency, --interval, --retries, --dry-run)

3. **Display status**: Show what's about to be processed (similar to dry-run output)

**Usage:**
```
npx nitro-fueled run                    # Process all unblocked tasks
npx nitro-fueled run TASK_2026_007      # Process single task
npx nitro-fueled run --dry-run          # Show plan without executing
npx nitro-fueled run --concurrency 2    # Override concurrency
```

## Dependencies

- TASK_2026_008 — CLI scaffold must exist

## Acceptance Criteria

- [ ] `npx nitro-fueled run` starts the Supervisor loop
- [ ] `npx nitro-fueled run TASK_ID` processes a single task
- [ ] `npx nitro-fueled run --dry-run` shows execution plan
- [ ] Pre-flight checks verify workspace setup
- [ ] Pre-flight checks verify MCP server availability
- [ ] Flags passed through to Supervisor (concurrency, interval, retries)
- [ ] Clear error messages when prerequisites missing

## References

- Supervisor SKILL.md: `.claude/skills/auto-pilot/SKILL.md`
- Auto-pilot command: `.claude/commands/auto-pilot.md`
- MCP design: `docs/mcp-session-orchestrator-design.md`
