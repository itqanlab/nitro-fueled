# Context — TASK_2026_025

## User Request
Fix review worker startup failure — 100% first-attempt failure rate observed in e2e test (session test-103).

## Strategy
BUGFIX — Research → Team-Leader → QA

## Root Cause Analysis

**The bug**: Review workers are killed by the supervisor on first attempt because the MCP server reports them as `stuck` before they've had time to start producing output.

**Mechanism**:

1. `spawn_worker` registers a worker with `session_id: 'pending'` and `progress.last_action_at = Date.now()` (spawn time)
2. Background resolver takes 10-30s to resolve session ID + JSONL path
3. JSONL watcher skips workers with `session_id === 'pending'` or no `jsonl_path` — so `last_action_at` never gets updated during startup
4. Even after JSONL path resolves, Claude needs time to process the first turn (reading task folder, generating response)
5. Both `get_worker_activity` (line 26) and `assessHealth` in `get_worker_stats` (line 62) use a hard 120-second threshold: `Date.now() - last_action_at > 120_000 → STUCK`
6. Review worker prompts are larger than build worker prompts → slower first-turn processing → more likely to exceed 120s before first JSONL entry

**Timeline**: Worker spawned → 120s pass with no JSONL data → health = `stuck` → supervisor strikes → kill → retry succeeds (because by then the system is warmed up / JSONL resolution is cached)

**Why build workers aren't affected**: Build workers have smaller prompts and faster first-turn responses. They typically produce JSONL entries within 60-90s.

## Fix

Add a **startup grace period** to health assessment. Workers with `message_count === 0` should not be reported as `stuck` until a configurable startup timeout (default: 5 minutes) has elapsed since spawn.

### Files to modify (session-orchestrator repo):
1. `src/types.ts` — Add `'starting'` to `HealthStatus` type
2. `src/tools/get-worker-stats.ts` — Update `assessHealth` to accept `messageCount` and `startedAt`, return `'starting'` during grace period
3. `src/tools/get-worker-activity.ts` — Same logic in inline health computation

### Files to modify (nitro-fueled repo):
4. `.claude/skills/auto-pilot/SKILL.md` — Add `starting` health state handling (no action, just log)
