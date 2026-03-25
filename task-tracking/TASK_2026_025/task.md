# Task: Fix Review Worker Startup Failure (100% first-attempt failure rate)

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P0-Critical |
| Complexity | Medium      |

## Description

During e2e testing (session test-103), every review worker failed on first attempt with 0 messages and exit code 143 (SIGTERM from supervisor). Build workers worked fine. The supervisor detected them as "stuck" and killed them, then retries succeeded.

This is the highest priority bug -- it wastes ~5-6 minutes per task and doubles the number of worker spawns.

### Root Cause Investigation Required

1. Check health check timing in auto-pilot SKILL.md -- when does "stuck" detection kick in? Is the grace period too short for review workers (which have larger prompts)?
2. Check if JSONL watcher in session-orchestrator has a startup grace period before declaring 0 messages
3. Check if `spawn_worker` returns before the `claude --print` process is actually writing to JSONL
4. Test with a single review worker (no concurrency) to rule out resource contention
5. Check if review worker prompts are significantly larger than build worker prompts (could cause slower first-turn)

### Fix: Implement Worker Startup Handshake (ENH-1)

Instead of passive health polling, implement an active startup handshake:
- After `spawn_worker`, wait for a "ready" signal (first JSONL entry or a `.ready` marker file)
- Only start health monitoring after ready signal received
- If no ready signal within a configurable timeout (e.g., 60s), retry immediately
- This reduces wasted time from ~5m to ~10-60s per failure

## Dependencies

- None

## Acceptance Criteria

- [ ] Root cause of first-attempt review worker failure is identified and documented
- [ ] Startup handshake or grace period mechanism implemented in auto-pilot skill
- [ ] Session orchestrator MCP server supports ready-signal detection (if needed)
- [ ] Review workers succeed on first attempt in a test run (0% first-attempt failure rate)
- [ ] Build workers still work correctly (no regression)
- [ ] Health check still detects genuinely stuck workers (not just slow starters)

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-1, ENH-1
- `.claude/skills/auto-pilot/SKILL.md` -- health check logic
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts` -- JSONL monitoring
- `.worker-logs/TASK_2026_001-CREATIVE-REVIEW_*.log` -- failed worker logs (test project)
