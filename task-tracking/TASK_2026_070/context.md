# Context — TASK_2026_070

## User Request
Session artifacts (log.md, analytics.md, worker-logs/, orchestrator-history.md) are written by the supervisor but never committed. This task defines clear commit ownership for every session artifact and adds a pre-flight check to the supervisor startup that detects and commits stale session artifacts from any previously ended sessions.

## Task Type
REFACTORING — Simple

## Strategy
Minimal: direct implementation, no PM/Architect phases needed (task.md provides full design).

## Files to Modify
1. `.gitignore` — add session runtime file exclusions
2. `.claude/skills/auto-pilot/SKILL.md` — Step 8d (commit session dir), stale archive pre-flight
3. `.claude/skills/orchestration/SKILL.md` — Completion Phase: stage orchestrator-history.md
4. `.claude/commands/auto-pilot.md` — pre-flight section update

## Key Design Decisions (from task.md)
- orchestrator-history.md committed by Completion/Fix Worker in their bookkeeping commit
- log.md, analytics.md, worker-logs/ committed by supervisor at session stop (new Step 8d)
- state.md and active-sessions.md added to .gitignore (runtime only, never committed)
- Pre-flight stale archive check runs before MCP validation at supervisor startup
- All archive commits are best-effort (failure is non-fatal)
