# Task: Session Artifact Commit Ownership — Defined Committers and Stale Archive Pre-Flight

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Simple      |
| Model      | default     |
| Provider   | default     |
| Testing    | skip        |

## Description

Session artifacts (log.md, analytics.md, worker-logs/, orchestrator-history.md) are written by the supervisor but never committed. If the supervisor crashes before Step 8b, all session history is lost. There is also no defined owner for committing these files — workers commit task artifacts, but nobody commits session-level history.

This task defines clear commit ownership for every session artifact and adds a pre-flight check to the supervisor startup that detects and commits stale session artifacts from any previously ended sessions before starting a new loop.

## Commit Ownership Design

### 1. orchestrator-history.md — committed by Completion/Fix Worker

The Completion Worker and Fix Worker already have a defined commit at the end of their work:
`"docs: add TASK_YYYY_NNN completion bookkeeping"`

Add `orchestrator-history.md` to that same commit. The worker appends its task's session summary line to the file and stages it. This guarantees history is committed even if the supervisor never reaches Step 8b.

> The worker only appends the entry for its own task — it does NOT write the full session block (that belongs to the supervisor). Format: a single row appended to the `### Workers Spawned` table of the current session block, or a new task-completion entry if no open session block exists.

### 2. log.md, analytics.md, worker-logs/ — committed by supervisor at session stop

At Step 8b (session stop), after writing the final state.md and before removing the active-sessions.md row, the supervisor runs:

```
git add task-tracking/sessions/{SESSION_ID}/
git commit -m "chore(session): archive {SESSION_ID} — {N} tasks, ${cost}"
```

This is best-effort — if the commit fails (e.g., nothing to commit, git error), log a warning and continue. A commit failure must never prevent the session from stopping cleanly.

### 3. state.md, active-sessions.md — never committed

These are pure runtime state. Add them to `.gitignore` under `task-tracking/sessions/*/state.md` and `task-tracking/active-sessions.md` so they never appear in `git status` noise.

## Pre-Flight: Stale Session Archive Check

Add as the **first check** in the auto-pilot pre-flight (before MCP validation), or as a new Step 0 in the Core Loop startup:

```
STALE ARCHIVE CHECK:
1. Run: git status --short task-tracking/sessions/ task-tracking/orchestrator-history.md
2. Collect uncommitted files.
3. Filter: exclude state.md and active-sessions.md (those are runtime, never committed).
4. Cross-reference with active-sessions.md:
   - If the session directory IS in active-sessions.md → it is a live session, skip it.
   - If the session directory is NOT in active-sessions.md → it is ended, commit its artifacts.
5. For each ended session with uncommitted artifacts:
   a. git add task-tracking/sessions/{SESSION_ID}/log.md
      git add task-tracking/sessions/{SESSION_ID}/analytics.md
      git add task-tracking/sessions/{SESSION_ID}/worker-logs/ (if exists)
   b. git commit -m "chore(session): archive {SESSION_ID} — recovered from previous session"
   c. Log: "PRE-FLIGHT — archived stale session {SESSION_ID}"
6. If orchestrator-history.md has uncommitted changes and is not being written by an active session:
   git add task-tracking/orchestrator-history.md
   git commit -m "chore(session): commit stale orchestrator-history.md"
7. If no stale artifacts found: log "PRE-FLIGHT — no stale session artifacts"
```

## Acceptance Criteria

- [ ] `.gitignore` updated: `task-tracking/sessions/*/state.md` and `task-tracking/active-sessions.md` excluded from tracking
- [ ] Completion Worker and Fix Worker prompts updated to stage `orchestrator-history.md` in their completion bookkeeping commit
- [ ] Supervisor Step 8b runs `git add + git commit` for `task-tracking/sessions/{SESSION_ID}/` at session stop
- [ ] Commit failure at Step 8b is non-fatal — logged as warning, session stop proceeds normally
- [ ] Pre-flight stale archive check runs at supervisor startup before MCP validation
- [ ] Stale session artifacts from ended sessions are committed before the new loop starts
- [ ] Active sessions (in active-sessions.md) are never touched by the stale archive check
- [ ] Pre-flight log entries written for each action taken

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — Step 8b commit, pre-flight stale archive check
- `.claude/skills/orchestration/SKILL.md` — Completion Phase: stage orchestrator-history.md
- `.claude/commands/auto-pilot.md` — pre-flight section update
- `.gitignore` — add session runtime file exclusions

## Dependencies

- TASK_2026_060 — touches `SKILL.md` (supervisor reconciliation). Must complete first to avoid merge conflict.
- TASK_2026_067 — touches `SKILL.md` (event-driven completion). Must complete first to avoid merge conflict.

## Parallelism

Cannot run in parallel with TASK_2026_060 or TASK_2026_067 (all touch SKILL.md).
Wave: after 060 and 067 complete.
