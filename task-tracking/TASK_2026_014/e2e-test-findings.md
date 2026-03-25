# E2E Test Findings — Session "test-103"

**Date**: 2026-03-24
**Test Project**: `/Volumes/SanDiskSSD/mine/test`
**Scenario**: Fresh project init + /plan + /auto-pilot (2 tasks, landing page)
**Duration**: 29 minutes (19:57 - 20:34)
**Result**: Both tasks COMPLETE, but with retries and several bugs

---

## Timeline

| Time  | Event                                              | Duration |
|-------|----------------------------------------------------|----------|
| 19:57 | Initial scaffold commit (tsconfig.json only)       | --       |
| 19:58 | `.claude/` + task-tracking scaffolded via init      | ~1m      |
| 20:02 | `/plan` created TASK_2026_001, TASK_2026_002        | ~4m      |
| 20:05 | Supervisor started, spawned Build Worker for 001    | --       |
| 20:08 | TASK_001 IMPLEMENTED (build ~3m)                    | 3m       |
| 20:12 | Review Worker spawned for 001                       | --       |
| 20:13 | Build Worker spawned for 002                        | --       |
| 20:16 | TASK_002 IMPLEMENTED (build ~3m)                    | 3m       |
| 20:18 | **BUG: TASK_001 Review stuck (0 msgs), killed**     | --       |
| 20:20 | Review retry #1 spawned for 001                     | --       |
| 20:21 | Review Worker spawned for 002                       | --       |
| 20:24 | TASK_001 COMPLETE (review ~4m)                      | 4m       |
| 20:26 | **BUG: TASK_002 Review stuck (0 msgs), killed**     | --       |
| 20:28 | Review retry #1 spawned for 002                     | --       |
| 20:32 | TASK_002 COMPLETE (review ~4m)                      | 4m       |
| 20:34 | Supervisor stopped -- all complete                  | --       |

**Total workers spawned**: 6 (2 builds, 4 reviews -- 2 failed + 2 retried)
**Wasted time from failures**: ~10-12 minutes

---

## Bugs

### BUG-1: Review Workers fail to start on first attempt (100% repro)

**Severity**: HIGH
**Impact**: Every review worker failed on first try, adding ~5-6m delay per task

**Evidence**:
- `TASK_001-REVIEW` log: only `[EXIT] code=143 signal=null` (0 messages)
- `TASK_002-REVIEW` log: only `[EXIT] code=143 signal=null` (0 messages)
- Retry workers (R1) succeeded every time

**Exit code 143** = SIGTERM (supervisor killed them after detecting 0 messages)

**Hypotheses**:
1. `claude --print` cold-start delay exceeds the health check window
2. Race condition: JSONL file not yet created when the watcher starts polling
3. The prompt is too large for the initial turn and causes a timeout before first output
4. MCP server connection delay when spawning concurrent workers

**Required investigation**:
- Check the health check timing in auto-pilot SKILL.md (when does "stuck" detection kick in?)
- Check if JSONL watcher has a startup grace period
- Check if spawn_worker returns before the process is actually ready
- Test with a single review worker (no concurrency) to rule out resource contention

---

### BUG-2: No `tasks.md` in TASK_2026_002

**Severity**: LOW
**Impact**: Inconsistent artifacts -- TASK_001 has subtask breakdown, TASK_002 doesn't

**Evidence**:
- TASK_001 folder: 7 files (includes `tasks.md` with 5 subtasks)
- TASK_002 folder: 6 files (no `tasks.md`)

**Root cause**: The orchestration skill does not enforce `tasks.md` as a required build artifact. The build worker has discretion to skip it.

**Fix**: Add `tasks.md` to the Exit Gate checklist in the orchestration skill. Build workers must create it before exiting.

---

### BUG-3: No task isolation -- TASK_001 reviewer fixed TASK_002 code

**Severity**: MEDIUM
**Impact**: Cross-task interference, unclear ownership of fixes

**Evidence**:
- Commit `360140a` message says "address TASK_2026_001 review findings"
- But TASK_002's completion report lists `360140a` as one of its commits
- Both tasks edit the same `index.html`

**Root cause**: No file-level isolation between tasks. When tasks share files, a reviewer for one task sees and fixes issues in the other task's code too.

**Fix options**:
1. Warn at plan/task-creation time when tasks share files
2. Instruct reviewers to ONLY fix code from their assigned task (by checking git blame)
3. Serialize reviews for tasks that share files (don't run in parallel)
4. Add a "scope" section to task.md defining which files/sections belong to each task

---

### BUG-4: Contradictory review fixes between tasks

**Severity**: MEDIUM
**Impact**: Review workers made opposing decisions on the same code

**Evidence**:
- TASK_001 review: "Replaced all `var` with `const`/`let`" (modern JS best practice)
- TASK_002 review: "`const`/`let` converted to `var` for broader browser support" (opposite decision)

**Root cause**: No shared context between review workers. Each reviewer operates in isolation and can make contradictory style decisions.

**Fix options**:
1. **Shared review context file**: Before review phase, generate a `review-context.md` with project conventions (e.g., "this project uses const/let, not var") that all reviewers read
2. **Serialize reviews**: Run one review at a time so the second reviewer sees the first's fixes
3. **Anti-patterns should be project-specific**: The anti-patterns file should include project-level style decisions established during planning

---

### BUG-5: Timestamps not unified across orchestrator state

**Severity**: LOW
**Impact**: Confusing to debug -- orchestrator-state uses UTC-ish times, git uses local time (UTC+2)

**Evidence**:
- orchestrator-state: `Session Started: 2026-03-24 18:05:39`
- git log: `2026-03-24 20:05:39 +0200` (same moment, different representation)

**Fix**: Use local time consistently, or always include timezone offset in orchestrator timestamps.

---

### BUG-6: Stack detection not captured or used

**Severity**: MEDIUM
**Impact**: Anti-patterns file contains Angular/NestJS rules for a plain HTML/CSS/JS project

**Evidence**:
- Test project has only `tsconfig.json` -- no framework
- `anti-patterns.md` includes Angular lifecycle rules (#5), Tailwind rules (#8), soft-delete DB rules (#7)
- None of these apply to the test project (plain HTML/CSS/JS)

**Root cause**: `anti-patterns.md` is shipped as-is from the core package. It is not filtered or regenerated based on detected tech stack.

**Fix**:
1. `init` should detect the stack and generate project-specific anti-patterns
2. Or: split anti-patterns into categories, only include relevant ones
3. Plan phase should re-assess stack when the project is empty/minimal and note it in plan.md

---

### BUG-7: Review lessons worked, anti-patterns did NOT

**Severity**: MEDIUM

**Review lessons**: WORKING CORRECTLY
- `frontend.md` grew from 0 to 15 lessons across both tasks
- Lessons are specific, actionable, and correctly tagged by task
- Both TASK_001 and TASK_002 reviewers appended their findings

**Anti-patterns**: NOT ADAPTED
- The file is the generic core template (mentions "142 QA findings across 14 tasks" from prior projects)
- Contains Angular, Tailwind, soft-delete rules irrelevant to this plain HTML project
- Workers did not consult or update it during this session
- No evidence anti-patterns were checked before implementation

**Fix**:
1. `init` must generate project-specific anti-patterns based on stack detection
2. Build workers should be instructed to check anti-patterns before submitting
3. Anti-patterns file header should state which tech stack it covers

---

### BUG-8: No cost/usage tracking in session artifacts

**Severity**: HIGH
**Impact**: Cannot measure cost of orchestration runs -- critical for a tool that spawns multiple AI workers

**Evidence**:
- `orchestrator-state.md`: zero mentions of cost, tokens, or usage
- `orchestrator-history.md`: worker table has no Cost column (template says it should)
- Auto-pilot SKILL.md template specifies: `**Total Cost**: ${X.XX}` and `| Cost |` column
- Session orchestrator MCP server HAS cost tracking code (token-calculator.ts, per-worker cost in get_worker_stats)
- But the supervisor never reads cost from MCP and never writes it to state files

**Root cause**: The auto-pilot skill reads worker health/status from MCP but does not read `cost` from `get_worker_stats` or `get_worker_activity`. The cost data exists in the MCP server but is never pulled into the orchestrator state.

**Fix**:
1. Supervisor must call `get_worker_stats` (not just `get_worker_activity`) when a worker completes
2. Write per-worker cost to orchestrator-state.md and orchestrator-history.md
3. Calculate and write total session cost at supervisor stop
4. Consider adding cost to worker log files too

---

### BUG-9: Setup files not committed to repo

**Severity**: LOW (by design, but needs option)

**Evidence**:
- `git status` shows 56 untracked files in `.claude/`, plus `CLAUDE.md`, `.mcp.json`, `task-tracking/` artifacts
- Only `tsconfig.json` was in the initial commit
- Workers committed their own code but not the setup scaffolding

**Root cause**: `init` does not commit. Workers are told "Do NOT start git commit/push without explicit user instruction" (from CLAUDE.md).

**Fix**: Add `--commit` flag to `nitro-fueled init` that optionally commits the scaffolded files. Default remains no-commit (non-destructive).

---

## Enhancements

### ENH-1: Worker startup handshake

Instead of relying on health check polling to detect stuck workers, implement a startup handshake:
- Worker writes a "ready" signal (e.g., first line to JSONL or a `.ready` file)
- Supervisor waits for ready signal before starting health monitoring
- If no ready signal within N seconds, retry immediately (no need to wait for full monitoring interval)

This would eliminate BUG-1 entirely and reduce wasted time from ~5m to ~10s per failure.

### ENH-2: Session cost summary command

Add `npx nitro-fueled cost` or include cost in `npx nitro-fueled status` output:
- Per-worker token breakdown (input, output, cache)
- Per-worker cost
- Session total
- Historical cost tracking across sessions

### ENH-3: Shared review context

Before spawning review workers, the supervisor should generate a `review-context.md` that includes:
- Project conventions established during planning
- Files changed per task (so reviewers know their scope)
- Decisions from other completed reviews (if running sequentially)

This prevents BUG-3 and BUG-4.

### ENH-4: File-level task scope tracking

During task creation, record which files each task will create/modify:
- Plan phase or architect phase should specify file ownership
- Supervisor can detect overlapping file scopes and warn or serialize
- Reviewers get explicit scope boundaries

### ENH-5: Worker log enrichment

Current worker logs are minimal (just exit summary). Enhance with:
- Timestamp for each phase transition
- Token count at exit
- Cost at exit
- Files modified list
- Review score (for review workers)

### ENH-6: Post-session analytics

After supervisor stops, generate a `session-analytics.md`:
- Total duration, cost, tokens
- Per-task breakdown
- Failure rate and retry stats
- Review scores before/after fixes
- Lessons generated count

### ENH-7: Progressive anti-patterns

Instead of a static file, anti-patterns should:
- Be initialized from stack-specific templates at `init`
- Grow during the project as reviews add findings
- Be consulted (and cited) by build workers in a pre-submit check

### ENH-8: Orchestrator state timezone normalization

All timestamps in orchestrator-state.md, orchestrator-history.md, and worker logs should use the same format: `YYYY-MM-DD HH:MM:SS +-ZZZZ` (local time with offset), matching git's format.

### ENH-9: Init commit option

`nitro-fueled init --commit` should:
- Stage all scaffolded files
- Commit with message `chore: initialize nitro-fueled orchestration`
- Default: no commit (current behavior, safe)

### ENH-10: Dry-run / plan validation

Before auto-pilot spawns workers, validate:
- All task dependencies are satisfiable
- No circular dependencies
- File scope overlaps detected and flagged
- Estimated cost based on task complexity

---

## Validation Checklist (from e2e-test-prompt.md)

| Check | Result | Notes |
|-------|--------|-------|
| `init` scaffolded .claude/, task-tracking/, CLAUDE.md | PASS | All present, correct structure |
| Stack detection found TypeScript/Node.js | FAIL | No evidence of stack detection output; anti-patterns are generic |
| `/plan` created tasks in registry | PASS | 2 tasks with plan.md |
| `/orchestrate` ran full PM -> Architect -> Dev -> QA flow | PASS | Full pipeline with reviews |
| Completion phase updated registry.md and plan.md | PASS | Both show COMPLETE |
| Final output is a real landing page | PASS | 1069-line index.html, fully functional |

---

## Summary

| Category | Count |
|----------|-------|
| Bugs found | 9 |
| HIGH severity | 2 (BUG-1: review startup, BUG-8: no cost tracking) |
| MEDIUM severity | 4 (BUG-3, BUG-4, BUG-6, BUG-7) |
| LOW severity | 3 (BUG-2, BUG-5, BUG-9) |
| Enhancements proposed | 10 |
| Validation checks passed | 5/6 |

The pipeline works end-to-end but has reliability issues (review workers failing 100% on first try) and observability gaps (no cost tracking despite the infrastructure existing). The review quality is strong but lacks cross-task coordination.
