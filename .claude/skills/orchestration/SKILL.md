---
name: orchestration
description: >
  Development workflow orchestration for software engineering tasks.
  Use when: (1) Implementing new features, (2) Fixing bugs, (3) Refactoring code,
  (4) Creating documentation, (5) Research & investigation, (6) DevOps/infrastructure,
  (7) Landing pages and marketing content.
  Supports full (PM->Architect->Dev->QA), partial, or minimal workflows.
  Invoked via /orchestrate command or directly when task analysis suggests delegation.
---

# Orchestration Skill

Multi-phase development workflow orchestration with dynamic strategies and user validation checkpoints. **You are the orchestrator** - coordinate agents, manage state, verify deliverables.

## Quick Start

```
/orchestrate [task description]     # New task
/orchestrate TASK_2026_XXX          # Continue existing task
```

### Strategy Quick Reference

| Task Type     | Strategy Flow                                                                               |
| ------------- | ------------------------------------------------------------------------------------------- |
| FEATURE       | PM -> [Research] -> Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker \| Completion Worker] |
| BUGFIX        | [Research] -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker \| Completion Worker]             |
| REFACTORING   | Architect -> Team-Leader -> Review Lead + Test Lead (parallel) -> [Fix Worker \| Completion Worker] |
| DOCUMENTATION | PM -> Developer -> Style Reviewer                  |
| RESEARCH      | Researcher -> [conditional implementation]         |
| DEVOPS        | PM -> Architect -> DevOps Engineer -> QA           |
| CREATIVE      | [ui-ux-designer] -> content-writer -> frontend     |

See [strategies.md](references/strategies.md) for detailed flow diagrams.

---

## Your Role: Orchestrator

**CRITICAL**: You are the **orchestrator**, NOT the implementer.

### Primary Responsibilities

1. **Delegate to Specialist Agents** - Use Task tool to invoke specialists
2. **Coordinate Workflows** - Manage flow between agents, handle checkpoints
3. **Verify Quality** - Ensure agents complete tasks correctly
4. **Never Implement Directly** - Avoid writing code yourself

### When to Delegate (ALWAYS)

| Task Type      | Agent(s)                                                  |
| -------------- | --------------------------------------------------------- |
| Writing code   | backend-developer, frontend-developer                     |
| Testing        | senior-tester                                             |
| Code review    | code-style-reviewer, code-logic-reviewer, visual-reviewer |
| Research       | researcher-expert                                         |
| Architecture   | software-architect                                        |
| Planning       | project-manager                                           |
| Infrastructure | devops-engineer                                           |

**Default**: When in doubt, delegate. See [agent-catalog.md](references/agent-catalog.md) for all 16 agents.

---

## Workflow Selection Matrix

### Task Type Detection

| Keywords Present                              | Task Type     |
| --------------------------------------------- | ------------- |
| CI/CD, pipeline, build tool, deploy, pack     | DEVOPS        |
| landing page, marketing, brand, visual        | CREATIVE      |
| implement, add, create, build                 | FEATURE       |
| fix, bug, error, issue                        | BUGFIX        |
| refactor, improve, optimize                   | REFACTORING   |
| document, readme, comment                     | DOCUMENTATION |
| research, investigate, analyze                | RESEARCH      |

**Priority**: DEVOPS > CREATIVE > FEATURE (when multiple keywords present)

### Adaptive Strategy Selection

When analyzing a task, evaluate multiple factors:

| Factor          | Weight | How to Assess                              |
| --------------- | ------ | ------------------------------------------ |
| Keywords        | 30%    | Match request against keyword table above  |
| Affected Files  | 25%    | Identify likely affected code paths        |
| Complexity      | 25%    | Simple (<2h), Medium (2-8h), Complex (>8h) |
| Recent Patterns | 20%    | Check last 5 tasks in registry.md          |

**Decision Rules**:

- Top strategy confidence >= 70%: Proceed with that strategy
- Top two strategies within 10 points: Present options to user
- All strategies < 70%: Ask user for clarification

See [strategies.md](references/strategies.md) for detailed selection guidance.

---

## Core Orchestration Loop

### Mode Detection

```
if ($ARGUMENTS matches /^TASK_\d{4}_\d{3}$/)
    -> CONTINUATION mode (resume existing task)
else
    -> NEW_TASK mode (create new task)
```

### NEW_TASK: Initialization

1. **Read Registry**: `Read(task-tracking/registry.md)` - find highest TASK_ID, increment
2. **Create Task Folder**: `mkdir task-tracking/TASK_[ID]`
3. **Create Context**: `Write(task-tracking/TASK_[ID]/context.md)` with user intent, strategy
4. **Announce**: Present task ID, type, complexity, planned agent sequence
5. **Write Status File**: `Write(task-tracking/TASK_[ID]/status)` with `CREATED` (no trailing newline).

### CONTINUATION: Phase Detection

> **Worker Scoping**: In Supervisor mode, Build Workers use phases up through
> "Dev complete" (all COMPLETE in tasks.md). Review Workers start from
> "Dev complete" and run QA + Completion Phase. In interactive mode
> (when the orchestration skill is invoked directly by a user via
> `/orchestrate`, not spawned by the Supervisor), a single session
> runs the full workflow with user validation checkpoints.

| Documents Present       | Next Action                         |
| ----------------------- | ----------------------------------- |
| context.md only         | Invoke project-manager              |
| task-description.md     | User validate OR invoke architect   |
| implementation-plan.md  | User validate OR team-leader MODE 1 |
| tasks.md (PENDING)      | Team-leader MODE 2 (assign batch)   |
| tasks.md (IN PROGRESS)  | Team-leader MODE 2 (verify)         |
| tasks.md (IMPLEMENTED)  | Team-leader MODE 2 (commit)         |
| tasks.md (all COMPLETE) | Team-leader MODE 3 OR QA choice     |
| review-context.md       | Review Lead context generated — spawn sub-workers |
| review-context.md + review files (registry still IN_REVIEW) | Review/Test phase done — Supervisor spawns Fix or Completion Worker |
| fix committed, no completion-report.md | Fix phase done — run Completion Phase |
| future-enhancements.md  | Workflow complete                   |

See [task-tracking.md](references/task-tracking.md) for full phase detection.

### Agent Invocation Pattern

```typescript
Task({
  subagent_type: '[agent-name]',
  description: '[Brief description] for TASK_[ID]',
  prompt: `You are [agent-name] for TASK_[ID].

**Task Folder**: [absolute path]
**User Request**: "[original request]"

[Agent-specific instructions]
See [agent-name].md for detailed instructions.`,
});
```

---

## Validation Checkpoints

After PM or Architect deliverables, present to user:

```
USER VALIDATION CHECKPOINT - TASK_[ID]
[Summary of deliverable]
Reply "APPROVED" to proceed OR provide feedback for revision
```

See [checkpoints.md](references/checkpoints.md) for all checkpoint templates.

---

## Team-Leader Integration

The team-leader operates in 3 modes:

| Mode   | When                    | Purpose                            |
| ------ | ----------------------- | ---------------------------------- |
| MODE 1 | After architect         | Create tasks.md with batched tasks |
| MODE 2 | After developer returns | Verify, commit, assign next batch  |
| MODE 3 | All batches COMPLETE    | Final verification, summary        |

### Response Handling

| Team-Leader Says     | Your Action                           |
| -------------------- | ------------------------------------- |
| NEXT BATCH ASSIGNED  | Invoke developer with provided prompt |
| BATCH REJECTED       | Re-invoke developer with issues       |
| ALL BATCHES COMPLETE | Invoke MODE 3                         |

See [team-leader-modes.md](references/team-leader-modes.md) for detailed integration.

---

## Flexible Invocation Patterns

| Pattern | When to Use                     | Flow                                 |
| ------- | ------------------------------- | ------------------------------------ |
| Full    | New features, unclear scope     | PM -> Architect -> Team-Leader -> QA |
| Partial | Known requirements, refactoring | Architect -> Team-Leader -> QA       |
| Minimal | Simple fixes, quick reviews     | Single developer or reviewer         |

---

## Session Logging

The orchestration skill MUST maintain a session-scoped event log so that direct `/orchestrate`
invocations are visible in the same audit trail as auto-pilot-spawned workers.

### Session Directory Setup (run once, on skill entry)

1. Compute `SESSION_ID = SESSION_{YYYY-MM-DD}_{HH-MM-SS}` using the current wall-clock time.
2. Set `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/`.
3. Create `{SESSION_DIR}` if it does not exist (mkdir, no-op if exists).
4. Create `{SESSION_DIR}log.md` with header if it does not already exist:
   ```markdown
   # Session Log — {SESSION_ID}

   | Timestamp | Source | Event |
   |-----------|--------|-------|
   ```
5. Register in `task-tracking/active-sessions.md` (append row with source `orchestrate`,
   Tasks `1`, path `{SESSION_DIR}`).
6. Append startup entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | orchestrate | STARTED TASK_{ID} ({task_type}) |`

On finish (after Completion Phase bookkeeping commit):

1. Append final entry:
   `| {HH:MM:SS} | orchestrate | FINISHED TASK_{ID} — {COMPLETE | FAILED} |`
2. Remove this session's row from `task-tracking/active-sessions.md`.

### Phase Transition Log Entries

Append one row to `{SESSION_DIR}log.md` after each phase completes. Use the exact formats
below.

| Phase | Log Row |
|-------|---------|
| PM complete | `\| {HH:MM:SS} \| orchestrate \| PM phase complete for TASK_{ID} \|` |
| Architect complete | `\| {HH:MM:SS} \| orchestrate \| Architect phase complete for TASK_{ID} \|` |
| Team-Leader batch assigned | `\| {HH:MM:SS} \| orchestrate \| Batch {N} assigned for TASK_{ID} \|` |
| Dev batch complete | `\| {HH:MM:SS} \| orchestrate \| Batch {N} complete for TASK_{ID} \|` |
| All batches complete | `\| {HH:MM:SS} \| orchestrate \| All dev batches complete for TASK_{ID} \|` |
| QA started | `\| {HH:MM:SS} \| orchestrate \| QA started for TASK_{ID} \|` |
| QA complete | `\| {HH:MM:SS} \| orchestrate \| QA complete for TASK_{ID} \|` |
| Completion phase done | `\| {HH:MM:SS} \| orchestrate \| Completion phase done for TASK_{ID} — COMPLETE \|` |

**Log writes are best-effort**: If a write fails, log a warning to the user and continue.
Never let log failure interrupt orchestration.

**In Build Worker / Review Worker sessions** (spawned by auto-pilot): The worker runs
`/orchestrate TASK_X` which invokes this skill. The skill will create a new `SESSION_ID`
for the worker's own session. This is intentional — each worker gets its own session
directory and log. The auto-pilot session's log tracks spawning/monitoring; the worker's
own log tracks phase-level progress.

---

## Session Analytics

At the end of every orchestration run — on all exit paths (success, failure, stuck, manual stop) — write a `session-analytics.md` file to the task folder.

### When to Write

- **Success path (full pipeline)**: Write immediately after the Completion Phase bookkeeping commit. Include `session-analytics.md` in that bookkeeping commit. Set `Outcome = COMPLETE`.
- **Success path (Build Worker)**: Write after the implementation commit, before exiting. Set `Outcome = IMPLEMENTED`. Build Workers stop after dev and do NOT run the Completion Phase.
- **Failure path**: Write before exiting when the orchestration cannot complete (unrecoverable error, agent failure). Set `Outcome = FAILED`.
- **Stuck/kill path**: Write before exiting when the Supervisor kills the session. Set `Outcome = STUCK`.
- **Manual stop**: Write before the session closes if the orchestrator is manually interrupted mid-run. Set `Outcome = FAILED`.

Write is **best-effort**: if the write fails, log a warning to the user and continue. Never let analytics failure interrupt orchestration.

### File Location

`task-tracking/TASK_YYYY_NNN/session-analytics.md`

### File Format

```markdown
# Session Analytics — TASK_YYYY_NNN

| Field | Value |
|-------|-------|
| Task | TASK_YYYY_NNN |
| Outcome | IMPLEMENTED \| COMPLETE \| FAILED \| STUCK |
| Start Time | YYYY-MM-DD HH:MM:SS +ZZZZ |
| End Time | YYYY-MM-DD HH:MM:SS +ZZZZ |
| Duration | {N}m |
| Phases Completed | PM, Architect, Dev, QA (comma-separated — omit skipped phases; allowed values only) |
| Files Modified | N |
```

### Field Derivation

| Field | How to Compute |
|-------|----------------|
| Task | Task ID for this run (e.g., `TASK_2026_065`) |
| Outcome | `COMPLETE` (after Completion Phase), `IMPLEMENTED` (if stopped after dev), `FAILED` (unrecoverable error), `STUCK` (killed) |
| Start Time | Wall-clock time when this orchestration session started — same timestamp used for Session Logging startup entry. Run `date '+%Y-%m-%d %H:%M:%S %z'` at session start and record it. |
| End Time | Wall-clock time at exit. Run `date '+%Y-%m-%d %H:%M:%S %z'` |
| Duration | `End Time - Start Time`, rounded to nearest minute. Format: `Nm` (e.g., `14m`) |
| Phases Completed | Comma-separated list of phases that ran to completion. Allowed values: `PM`, `Architect`, `Dev`, `QA`. Omit phases that were skipped or did not complete. Do not include free-form text. |
| Files Modified | Count of unique files changed in commits that mention this Task ID. Run: `git log --grep="TASK_X" --since="{start_time}" --pretty=format: --name-only \| sort \| uniq \| grep -v '^$' \| wc -l`. If git fails, write `unknown`. |

Token and cost fields are **not included** — they are not derivable from within the session context (only available via MCP `get_worker_stats`).

---

## Error Handling

### Validation Rejection

1. Parse feedback into actionable points
2. Re-invoke same agent with feedback
3. Present revised version

### Commit Hook Failure

**NEVER bypass hooks automatically.** Present options:

1. Fix issue (if related)
2. Bypass with --no-verify (if unrelated, with user approval)
3. Stop and report (if critical)

See [checkpoints.md](references/checkpoints.md) for error handling templates.

---

## Reference Index

| Reference                                               | Load When                    | Content                              |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| [strategies.md](references/strategies.md)               | Selecting/executing strategy | 6 strategy flows, creative workflows |
| [agent-catalog.md](references/agent-catalog.md)         | Determining agent            | 14 agent profiles, capability matrix |
| [team-leader-modes.md](references/team-leader-modes.md) | Invoking team-leader         | MODE 1/2/3 patterns                  |
| [task-tracking.md](references/task-tracking.md)         | Managing state               | Folder structure, registry           |
| [checkpoints.md](references/checkpoints.md)             | Presenting checkpoints       | Templates, error handling            |
| [git-standards.md](references/git-standards.md)         | Creating commits             | Commitlint, hook protocol            |
| [review-lessons/](../../review-lessons/)                | Before dev + after reviews   | Accumulated review findings by role |
| [.claude/anti-patterns.md](../../anti-patterns.md)      | Before dev + in Exit Gate    | Stack-specific anti-patterns (generated at init, Exit Gate check) |

### Example Traces

| Example                                                    | Shows                        |
| ---------------------------------------------------------- | ---------------------------- |
| [feature-trace.md](examples/feature-trace.md)              | Full FEATURE workflow        |
| [bugfix-trace.md](examples/bugfix-trace.md)                | Streamlined BUGFIX workflow  |
| [creative-trace.md](examples/creative-trace.md)            | Design-first CREATIVE flow   |

### Loading Protocol

1. **Always loaded**: This SKILL.md (when skill triggers)
2. **Load on demand**: References when specific guidance needed
3. **Never preload**: All references at once

---

## Completion Phase (MANDATORY — DO NOT SKIP)

> **Scope Note**: In Supervisor mode, this phase runs in the
> **Review Worker** session only. Build Workers stop after implementation
> and do NOT execute this phase. In interactive mode, the single session
> runs this phase as before.

> **Review Lead Note**: In Review Lead mode (spawned by Supervisor using the
> Review Lead pattern), the Review Lead runs parallel sub-worker reviews and
> writes review files. It does NOT apply fixes and does NOT run the Completion
> Phase. After both the Review Lead and Test Lead complete, the Supervisor
> spawns a Fix Worker (if findings/failures exist) or Completion Worker (if
> clean). The Fix Worker or Completion Worker runs the Completion Phase.

After the QA cycle (reviews + fixes + final commit), the orchestrator MUST complete ALL of these bookkeeping steps BEFORE the final commit. The completion report is the #1 most-skipped deliverable — if you skip it, the task is considered INCOMPLETE regardless of code quality.

**Commit order:**
1. First commit: implementation code (after dev, before QA)
2. Second commit: QA fixes
3. Third commit: completion bookkeeping (report + status file + plan update)

All three commits are REQUIRED. Do not combine them.

### 1. Write Completion Report

Write `task-tracking/TASK_[ID]/completion-report.md` with:

```markdown
# Completion Report — TASK_[ID]

## Files Created
- [path] ([LOC] lines)

## Files Modified
- [path] — [what changed]

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | X/10 |
| Code Logic | X/10 |
| Security | X/10 |

## Findings Fixed
- [what each review caught, how resolved]

## New Review Lessons Added
- [what was appended to .claude/review-lessons/, or "none"]

## Integration Checklist
- [ ] [Project-specific integration checks — adapt to your stack]
- [ ] Barrel exports / public API updated
- [ ] New dependencies documented

## Verification Commands
[grep/glob commands to confirm deliverables]
```

### 2. Write Status File

Write `task-tracking/TASK_[ID]/status` with the single word `COMPLETE` (no trailing newline).
Do NOT write to registry.md — the registry is a generated artifact regenerated by `nitro-fueled status`.

> In Supervisor mode, the Fix Worker or Completion Worker writes `COMPLETE` to the task's `status` file.
> In interactive mode, the orchestrator writes the `status` file.

### 3. Update Plan

Update `task-tracking/plan.md`:

1. **Update task status** in the relevant Phase's Task Map table — set this task's status to COMPLETE.
2. **Check phase completion**: If ALL tasks in the phase are now COMPLETE or CANCELLED, update the phase status to COMPLETE and check all milestone boxes.
3. **Update Current Focus**: If the active phase just completed, advance "Active Phase" to the next incomplete phase and update "Next Priorities" accordingly.

### 4. Write Session Analytics

Write `task-tracking/TASK_[ID]/session-analytics.md` as described in the [Session Analytics](#session-analytics) section above. Set `Outcome = COMPLETE`. This file is included in the bookkeeping commit below.

### 5. Final Commit

Before committing, append this task's completion entry to `task-tracking/orchestrator-history.md`:

1. Read `task-tracking/orchestrator-history.md` (create if missing with `# Orchestrator Session History` header).
2. Find the most recent `### Workers Spawned` table. Append a new row:
   `| {worker_label_or_unknown} | TASK_[ID] | {worker_type} | COMPLETE | unknown | {duration} |`
   Use `unknown` for any field that cannot be determined from the current session.
   If no open session block exists (file empty or no table found), append a minimal entry:
   ```
   ---

   ## Task Completion Entry — TASK_[ID]
   | Worker | Task | Type | Result | Cost | Duration |
   |--------|------|------|--------|------|----------|
   | {interactive|Build|Review} | TASK_[ID] | {worker_type} | COMPLETE | unknown | unknown |
   ```
   `{worker_type}` = `interactive` for orchestration sessions started by a user directly; `Review` for Review Workers; `Build` is not expected here (Build Workers do not run the Completion Phase).
3. Stage the file: `git add task-tracking/orchestrator-history.md`

Then commit all bookkeeping changes (completion-report.md, status file, plan.md, session-analytics.md, orchestrator-history.md) with message: `docs: add TASK_[ID] completion bookkeeping`

---

## Exit Gate (MANDATORY)

Before exiting the orchestration session, verify ALL applicable checks pass.
The Exit Gate ensures workers leave the task in a clean, verifiable state
that the Supervisor can react to.

### Build Worker Exit Gate

Run these checks after implementation is committed and status file is written:

| Check | Command | Expected |
|-------|---------|----------|
| tasks.md exists | Glob task-tracking/TASK_[ID]/ for tasks.md | File found |
| tasks.md has content | Grep "Task" in tasks.md | At least one `### Task N.N:` heading present |
| All sub-tasks COMPLETE | Grep "COMPLETE" in tasks.md | All tasks show COMPLETE |
| Anti-patterns consulted | Read `.claude/anti-patterns.md` | Reviewed relevant sections; no violations in implementation |
| Implementation committed | Check git status | No unstaged implementation files |
| Status file written | Read task-tracking/TASK_[ID]/status | Contains IMPLEMENTED |
| Status file committed | Check git status | task-tracking/TASK_[ID]/status is committed |

**Anti-patterns check**: Before finalizing the commit, read `.claude/anti-patterns.md`. For each
section that applies to your implementation's tech stack, verify your code does not violate the
listed rules. If a violation is found, fix it before committing. This check cannot be automated —
it requires you to read the file and compare against your implementation.

If any check fails, fix it before exiting. Do not exit with uncommitted
work or an un-written status file.

**If tasks.md is missing**: Create it by listing all implementation steps you completed as task entries with `**Status**: COMPLETE`. See the tasks.md format under `## MODE 1: DECOMPOSITION` > `### Expected Output` in `.claude/skills/orchestration/references/team-leader-modes.md`. If that file is unavailable, use this minimal structure:

```markdown
# Development Tasks - TASK_[ID]

## Batch 1: [Description] - COMPLETE

**Developer**: systems-developer

### Task 1.1: [What you implemented]

**File**: [path/to/file]
**Status**: COMPLETE
```

### Review Lead Exit Gate

Run these checks after reviews, fixes, and completion phase are done:

| Check | Command | Expected |
|-------|---------|----------|
| Review files exist | Glob task folder for review-*.md | review-context.md + at least style + logic reviews present |
| Security review | Glob task folder for review-security.md | Present (or note if sub-worker failed) |
| Findings summary | Read review-context.md | Has ## Findings Summary section with counts |
| Status file at IN_REVIEW | Read task-tracking/TASK_[ID]/status | Contains IN_REVIEW (Review Lead does NOT set COMPLETE) |
| All committed | Check git status | Clean working tree for task files |
| Test report exists | Read task folder for test-report.md | Present (or note if Test Lead was skipped/failed — advisory only) |

### Exit Gate Failure

If you cannot pass the Exit Gate (e.g., a blocker prevents completion):
1. Document the failure in the task folder (create `exit-gate-failure.md`)
2. Exit cleanly -- the Supervisor will detect the missing state transition and retry

---

## Key Principles

1. **You are the orchestrator**: Direct tool access, no agent overhead
2. **Progressive disclosure**: Load references only when needed
3. **User validation**: Always get approval for PM/Architect deliverables
4. **Team-leader loop**: 3-mode cycle handles all development coordination
5. **Never bypass hooks**: Always ask user before --no-verify
6. **Single task folder**: All work in parent task folder
7. **Review lessons**: Developers read lessons before coding, reviewers update lessons after reviewing
8. **Exit Gate**: Always run the Exit Gate checks before exiting an autonomous session
