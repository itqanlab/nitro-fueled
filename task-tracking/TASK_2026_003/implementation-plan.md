# Implementation Plan - TASK_2026_003: Supervisor Architecture

## Codebase Investigation Summary

### Files Analyzed

| File | Purpose | Lines |
|------|---------|-------|
| `.claude/skills/auto-pilot/SKILL.md` | Current auto-pilot loop (becomes Supervisor) | 610 |
| `.claude/skills/orchestration/SKILL.md` | Orchestration workflow (needs Exit Gate, Build/Review scoping) | 322 |
| `.claude/skills/orchestration/references/task-tracking.md` | Task states and folder structure | 260 |
| `.claude/commands/auto-pilot.md` | Command entry point (terminology update) | 130 |
| `.claude/skills/orchestration/references/checkpoints.md` | Checkpoint definitions | 546 |
| `task-tracking/TASK_2026_002/review-style.md` | Review findings to address | 207 |

### Key Findings from Investigation

1. **Current state machine** (task-tracking.md:219-229): Registry has CREATED, IN_PROGRESS, COMPLETE, BLOCKED, CANCELLED. No IMPLEMENTED or IN_REVIEW at registry level.
2. **IMPLEMENTED already exists at tasks.md level** (task-tracking.md:237): Individual sub-tasks in tasks.md use IMPLEMENTED, but the registry does not.
3. **Workers currently write completion-report.md** (auto-pilot SKILL.md:45), and the Supervisor (auto-pilot) updates the registry (SKILL.md:386-392). This inverts in the new design: workers update registry themselves.
4. **`--stuck` is dead configuration** (review-style.md:18-58): Must be removed from SKILL.md Configuration table and command Parameters table.
5. **Modes section already added** (auto-pilot SKILL.md:103-113): The TASK_2026_002 review finding about missing modes was already addressed.
6. **completion-report.md missing from task-tracking.md folder structure** (review-style.md:86-90): Should be added.
7. **Current orchestration prompt** (auto-pilot SKILL.md:233-268): Single monolithic prompt that tells worker to do everything (PM through Completion). Must be split into Build Worker and Review Worker prompts.
8. **Completion Phase** (orchestration SKILL.md:248-311): Currently runs in the single worker session. Must be scoped to Review Worker only.
9. **Phase Detection table** (task-tracking.md:176-191): Determines where to resume. Build Worker and Review Worker need different subsets of this table.

### Review Findings to Address (from TASK_2026_002)

| Finding | Status | Action in This Task |
|---------|--------|-------------------|
| Dead `--stuck` parameter | BLOCKING | Remove from SKILL.md Configuration and command Parameters |
| Missing modes in SKILL.md | ALREADY FIXED | Modes section exists at SKILL.md:103-113, no action needed |
| State vs registry reconciliation gap | SERIOUS | Add reconciliation step (already planned for Step 1 rework) |
| `completion-report.md` not in task-tracking.md | SERIOUS | Add to folder structure and Document Ownership table |

---

## New State Machine

### Registry-Level States

```
CREATED --> IN_PROGRESS --> IMPLEMENTED --> IN_REVIEW --> COMPLETE
   |            |              |               |
   v            v              v               v
BLOCKED      BLOCKED        BLOCKED         BLOCKED
   |            |              |               |
   v            v              v               v
CANCELLED   CANCELLED      CANCELLED       CANCELLED
```

### State Transition Table

| From State | To State | Who Sets It | Trigger |
|------------|----------|-------------|---------|
| CREATED | IN_PROGRESS | Build Worker | Build Worker starts working on task |
| IN_PROGRESS | IMPLEMENTED | Build Worker | All batches implemented + committed, Exit Gate passed |
| IN_PROGRESS | BLOCKED | Supervisor | Build Worker failed, retries exhausted |
| IMPLEMENTED | IN_REVIEW | Review Worker | Review Worker starts working on task |
| IN_REVIEW | COMPLETE | Review Worker | All reviews done, fixes committed, Completion Phase done, Exit Gate passed |
| IN_REVIEW | BLOCKED | Supervisor | Review Worker failed, retries exhausted |
| Any | BLOCKED | Supervisor | Dependency issues, cycle detection |
| Any | CANCELLED | User/Manual | Task abandoned |

### Supervisor Spawn Logic

| Current Registry State | Worker Type to Spawn | Expected End State |
|----------------------|---------------------|-------------------|
| CREATED | Build Worker | IMPLEMENTED |
| IMPLEMENTED | Review Worker | COMPLETE |
| IN_PROGRESS | Build Worker (retry/resume) | IMPLEMENTED |
| IN_REVIEW | Review Worker (retry/resume) | COMPLETE |

### Failure Handling

When a worker finishes and the registry state did NOT transition to the expected end state:
1. Increment retry counter for this task
2. If retries exhausted: mark BLOCKED
3. If retries remain: leave state as-is (do NOT reset to CREATED). Respawn same worker type on next loop iteration. The worker uses phase detection to resume.

**Key change from current design**: Currently, failed tasks are reset to CREATED (SKILL.md:368, 394). In the new design, failed tasks stay at their current state (IN_PROGRESS or IN_REVIEW) so the Supervisor knows which worker type to respawn.

---

## Component Specifications

### Component 1: Auto-Pilot SKILL.md --> Supervisor SKILL.md

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Action**: REWRITE (same path, new content structure)

#### 1A. Frontmatter Update

**Current** (SKILL.md:1-9):
```yaml
name: auto-pilot
description: >
  Autonomous task processing loop for Nitro-Fueled orchestration.
  Use when: Running batch task execution, processing a task backlog,
  or spawning parallel workers for multiple tasks.
```

**New**:
```yaml
name: supervisor
description: >
  Supervisor loop for Nitro-Fueled orchestration.
  Use when: Running batch task execution, processing a task backlog,
  or spawning parallel workers for multiple tasks.
  Reads the task registry and task folders, builds a dependency graph,
  spawns Build Workers and Review Workers via MCP session-orchestrator,
  monitors health and state transitions, and loops.
  Invoked via /auto-pilot command.
```

#### 1B. Title and Role Section

**Current** (SKILL.md:12-46): "Auto-Pilot Skill" / "Your Role: Orchestrator of Orchestrators"

**New title**: `# Supervisor Skill`
**New subtitle**: `Autonomous loop that processes the task backlog by spawning, monitoring, and managing **Build Workers** and **Review Workers** via MCP session-orchestrator.`

**Role section rename**: "Your Role: Supervisor" (keep "Orchestrator of Orchestrators" as subtitle/clarification)

**Update Primary Responsibilities** to reflect two-worker model:
1. Read registry + task.md files -- build the dependency graph
2. Identify actionable tasks (CREATED or IMPLEMENTED) and order by priority
3. Spawn appropriate worker type based on task state (Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW)
4. Monitor worker health on a configurable interval
5. Handle completions: check if state transitioned, decide next action
6. Handle failures: if state didn't transition, respawn same worker type (counts as retry)
7. Persist state to `orchestrator-state.md` for compaction survival
8. Loop until backlog is drained or all remaining tasks are blocked

**Update "What You Never Do"**:
- Keep existing items
- Add: **Update the registry** -- workers update their own registry states
- Add: **Verify code quality** -- reviewers do that in the Review Worker session
- Remove: current item about writing completion-report.md (still true but reword to "workers handle all task artifacts")

#### 1C. Configuration Table

**Current** (SKILL.md:49-57): Has Concurrency limit, Monitoring interval, Retry limit, MCP retry backoff. The `--stuck` param was already removed per review findings.

**Verify**: The `--stuck` parameter must NOT be present. If it still exists, remove it. The current file (as read) does NOT have `--stuck` in the Configuration table -- it was already addressed. No change needed here.

**Note on stuck detection** (SKILL.md:58): Keep as-is. Already correctly explains server-side stuck detection.

#### 1D. Session Log Updates

**Current** (SKILL.md:66-97): Session log event table.

**Changes to event table**:

| Event | Current Format | New Format |
|-------|---------------|------------|
| Worker spawned | `SPAWNED {worker_id} for TASK_X ({Type})` | `SPAWNED {worker_id} for TASK_X ({WorkerType}: {TaskType})` where WorkerType is `Build` or `Review` |
| Worker finished (success) | `COMPLETE -- TASK_X: completion-report.md found` | `STATE TRANSITIONED -- TASK_X: {old_state} -> {new_state}` |
| Worker finished (no report) | `FAILED -- TASK_X: no completion-report.md` | `NO TRANSITION -- TASK_X: expected {expected_state}, still {current_state} (retry {N}/{limit})` |
| New: Build done | (none) | `BUILD DONE -- TASK_X: IMPLEMENTED, spawning Review Worker` |
| New: Review done | (none) | `REVIEW DONE -- TASK_X: COMPLETE` |

Keep all other events (healthy, stuck, kill, retry, blocked, MCP, compaction, etc.) with `AUTO-PILOT` renamed to `SUPERVISOR` in the start/stop messages.

#### 1E. Modes Section

**Current** (SKILL.md:103-113): Already has three modes table.

**Update**: Replace "auto-pilot" with "supervisor" in descriptions. Update single-task mode to be state-aware:

Single-task mode behavior: "Spawn appropriate worker type based on current state. If CREATED, spawn Build Worker. If IMPLEMENTED, spawn Review Worker. If IN_PROGRESS, spawn Build Worker (resume). If IN_REVIEW, spawn Review Worker (resume). Monitor until that worker completes and state transitions. If state transitioned to IMPLEMENTED, automatically spawn Review Worker and monitor until COMPLETE. Stop after final state reached or failure."

This means single-task mode now handles the full lifecycle (Build then Review) for one task.

#### 1F. Core Loop Restructure

##### Step 1: Read State (Recovery Check) -- MODIFY

**Current** (SKILL.md:133-155): Reconciles state vs MCP.

**Add** after MCP reconciliation (new sub-step, addresses review finding):
```
5. Reconcile state vs registry:
   - Task active in state but COMPLETE in registry: Remove from active workers (registry wins).
   - Task active in state but CREATED in registry and worker NOT in MCP: Treat as failed Build Worker.
   - Task active in state but IMPLEMENTED in registry and worker NOT in MCP: Build Worker succeeded, queue Review Worker.
   - Task active in state but IN_REVIEW in registry and worker NOT in MCP: Treat as failed Review Worker.
```

##### Step 2: Read Registry and Task Folders -- MODIFY

**Current** (SKILL.md:158-166): Reads CREATED and IN_PROGRESS tasks.

**Change**: Read tasks with status CREATED, IN_PROGRESS, IMPLEMENTED, or IN_REVIEW:
```
3. For each task with status CREATED, IN_PROGRESS, IMPLEMENTED, or IN_REVIEW:
   - Read task-tracking/TASK_YYYY_NNN/task.md
   - Extract: Type, Priority, Complexity, Dependencies list
```

##### Step 2b: Validate Task Quality -- NO CHANGE

Keep as-is (SKILL.md:169-185). Validation only applies to CREATED tasks before first spawn.

##### Step 3: Build Dependency Graph -- MODIFY

**Current** (SKILL.md:188-212): Classifications only cover CREATED, IN_PROGRESS, BLOCKED, COMPLETE, CANCELLED.

**New classifications**:

| Classification | Condition |
|----------------|-----------|
| **READY_FOR_BUILD** | Status is CREATED AND (no deps OR all deps COMPLETE) |
| **BUILDING** | Status is IN_PROGRESS (Build Worker running) |
| **READY_FOR_REVIEW** | Status is IMPLEMENTED AND (no deps OR all deps COMPLETE) |
| **REVIEWING** | Status is IN_REVIEW (Review Worker running) |
| **BLOCKED** | Status is BLOCKED |
| **COMPLETE** | Status is COMPLETE |
| **CANCELLED** | Status is CANCELLED |

Dependency validation rules stay the same (missing dep, cancelled dep, cycle detection).

##### Step 4: Order Task Queue -- MODIFY

**Current** (SKILL.md:215-227): Orders unblocked tasks.

**New**: Two queues, both sorted by Priority then Task ID:
1. **Build Queue**: READY_FOR_BUILD tasks (need Build Worker)
2. **Review Queue**: READY_FOR_REVIEW tasks (need Review Worker)

Interleave from both queues when filling spawn slots. Review Workers take priority over Build Workers (finishing tasks is more valuable than starting new ones).

```
slots = concurrency_limit - count(active workers from state)
Select tasks: first from Review Queue, then from Build Queue, until slots filled.
```

##### Step 5: Spawn Workers -- MAJOR REWRITE

**Current** (SKILL.md:229-328): Single worker prompt, single spawn logic.

**New**: Two worker prompt templates, worker-type-aware spawn logic.

**5a. Determine Worker Type**:
- Task state CREATED or IN_PROGRESS --> Build Worker
- Task state IMPLEMENTED or IN_REVIEW --> Review Worker

**5b. Generate Worker Prompt** (see Build Worker and Review Worker templates below)

**5c. Call MCP `spawn_worker`**:
- `prompt`: the generated prompt from 5b
- `working_directory`: project root absolute path
- `label`: `"TASK_YYYY_NNN-TYPE-BUILD"` or `"TASK_YYYY_NNN-TYPE-REVIEW"`

**5d. On successful spawn**:
- Do NOT update registry (workers do that themselves now)
- Record in `orchestrator-state.md` active workers table:
  - worker_id, task_id, label, worker_type=`"build"|"review"`, status=`"running"`, spawn_time, retry_count, expected_end_state=`"IMPLEMENTED"|"COMPLETE"`

**5e. On spawn failure**: Same as current (log, leave state, continue)

**5f. Write state after each spawn**: Same as current.

##### Step 6: Monitor Active Workers -- MINOR MODIFY

**Current** (SKILL.md:330-377): Health monitoring with two-strike stuck detection.

**Changes**:
- All health state handling stays the same (healthy, high_context, compacting, stuck, finished)
- Two-strike stuck detection stays the same
- On stuck kill: Do NOT reset to CREATED. Leave registry state as-is. Increment retry count. If retries exhausted, mark BLOCKED. The current state (IN_PROGRESS or IN_REVIEW) tells the Supervisor which worker type to respawn.

##### Step 7: Handle Completions -- MAJOR REWRITE

**Current** (SKILL.md:379-413): Checks for completion-report.md to determine success.

**New logic**:

For each worker with health `finished` (or discovered missing during Step 1 reconciliation):

**7a. Read current registry state for the task.**

**7b. Determine if state transitioned:**
- Look up `expected_end_state` from orchestrator-state.md for this worker
- Read current state from registry

**7c. IF state transitioned to expected end state:**

- If new state is IMPLEMENTED (Build Worker succeeded):
  - Log: `"BUILD DONE -- TASK_X: IMPLEMENTED, queuing Review Worker"`
  - Move worker from active to completed list in state
  - Task will be picked up as READY_FOR_REVIEW on next loop iteration (Step 3)

- If new state is COMPLETE (Review Worker succeeded):
  - Log: `"REVIEW DONE -- TASK_X: COMPLETE"`
  - Move worker from active to completed list in state
  - Record: task_id, completion_timestamp

**7d. IF state did NOT transition (still at pre-worker state):**

- Treat as incomplete/failed
- Leave registry state as-is (do NOT reset to CREATED)
- Increment `retry_count` for this task in state
- If `retry_count > retry_limit`:
  - Set task status to BLOCKED in registry
  - Log: `"TASK_X: {worker_type} failed {N} times -- marked BLOCKED"`
- Else:
  - Log: `"TASK_X: {worker_type} finished without state transition -- will retry (attempt {N}/{retry_limit})"`
- Move worker from active to failed list in state

**7e. After processing all completions**: Same as current (re-evaluate dependency graph, go to Step 2).

**7f. Edge case**: Worker still running after expected state reached -- same as current (wait one interval, then kill).

##### Worker Recovery Protocol -- MODIFY

**Current** (SKILL.md:416-425): Resets task to CREATED for retry.

**New**: Do NOT reset to CREATED. Leave at current state. The worker type determination in Step 5a handles the mapping: IN_PROGRESS spawns Build Worker, IN_REVIEW spawns Review Worker. The replacement worker prompt includes retry context.

##### Step 8: Loop Termination Check -- MODIFY

**Current** (SKILL.md:429-434): Checks for unblocked tasks and active workers.

**New**: "Unblocked tasks" now means "READY_FOR_BUILD or READY_FOR_REVIEW tasks". Same termination logic otherwise:
- No actionable tasks AND no active workers --> STOP
- No actionable tasks BUT active workers exist --> monitor (Step 6)
- Actionable tasks exist --> spawn (Step 4)

#### 1G. orchestrator-state.md Format Update

**Current** (SKILL.md:437-504): Active Workers table has Worker ID, Task ID, Label, Status, Spawn Time, Last Health, Stuck Count.

**Add column**: `Worker Type` (Build | Review) and `Expected End State` (IMPLEMENTED | COMPLETE).

```markdown
## Active Workers

| Worker ID | Task ID       | Worker Type | Label                        | Status  | Spawn Time          | Last Health | Stuck Count | Expected End State |
|-----------|---------------|-------------|------------------------------|---------|---------------------|-------------|-------------|-------------------|
| abc-123   | TASK_2026_003 | Build       | TASK_2026_003-FEATURE-BUILD  | running | 2026-03-24 10:00:00 | healthy     | 0           | IMPLEMENTED        |
| def-456   | TASK_2026_004 | Review      | TASK_2026_004-BUGFIX-REVIEW  | running | 2026-03-24 10:05:00 | healthy     | 0           | COMPLETE           |
```

Update the example Session Log entries to use new event formats (BUILD DONE, REVIEW DONE, etc.).

#### 1H. Key Principles Update

**Current** (SKILL.md:598-610): 10 principles.

**Changes**:
- Principle 1: "You are the **Supervisor**" (was "orchestrator of orchestrators")
- Principle 5: Replace "Only YOU write registry status transitions -- workers write completion-report.md" with "**Workers update the registry themselves** -- you monitor state transitions, not cause them"
- Principle 7: Update "Never spawn duplicate workers" to also mention: "check worker_type matches expected worker for current state"
- Add Principle 11: "**Spawn the right worker type** -- Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW"
- Add Principle 12: "**Review Workers take priority** -- finishing tasks is more valuable than starting new ones"

#### 1I. Terminology Sweep

Global find-and-replace throughout the file:
- "Auto-Pilot" --> "Supervisor" (in headings, descriptions)
- "auto-pilot" --> "supervisor" (in log messages, descriptions -- but NOT in file paths like `/auto-pilot` command)
- "AUTO-PILOT STARTED" --> "SUPERVISOR STARTED" (log events)
- "AUTO-PILOT STOPPED" --> "SUPERVISOR STOPPED" (log events)
- Keep `/auto-pilot` command references as-is (command file path is not renamed)

---

### Component 2: Build Worker Prompt Template

**Location**: New section in `.claude/skills/auto-pilot/SKILL.md`, replacing the current single prompt in Step 5a.

#### First-Run Build Worker Prompt

```
Run /orchestrate TASK_YYYY_NNN

BUILD WORKER — AUTONOMOUS MODE

You are a Build Worker. Your job is to take this task from CREATED
through implementation. Follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints (Scope, Requirements, Architecture, QA Choice)
   and continue immediately. There is no human at this terminal.

2. Run the orchestration flow: PM -> Architect -> Team-Leader -> Dev.
   Complete ALL batches until tasks.md shows all tasks COMPLETE.

3. After ALL development is complete (all batches COMPLETE in tasks.md):
   a. Create a git commit with all implementation code
   b. Update task-tracking/registry.md: set task status to IMPLEMENTED
   c. Commit the registry update: `docs: mark TASK_YYYY_NNN IMPLEMENTED`

4. Before developers write any code, they MUST read
   .claude/review-lessons/ (review-general.md, backend.md,
   frontend.md). These contain accumulated rules from past reviews.

5. EXIT GATE — Before exiting, verify:
   - [ ] All tasks in tasks.md are COMPLETE
   - [ ] Implementation code is committed
   - [ ] Registry shows IMPLEMENTED for this task
   - [ ] Registry change is committed
   If any check fails, fix it before exiting.

6. You do NOT run reviews. You do NOT write completion-report.md.
   You do NOT mark the task COMPLETE. Stop after IMPLEMENTED.

7. If you encounter errors or blockers, document them in the task
   folder and exit cleanly. The Supervisor will detect the state
   and decide whether to retry.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

#### Retry Build Worker Prompt

```
Run /orchestrate TASK_YYYY_NNN

BUILD WORKER — CONTINUATION MODE
This task was previously attempted {N} time(s).
The previous Build Worker {reason: stuck / crashed / stopped}.

AUTONOMOUS MODE — follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. No human at this terminal.

2. FIRST: Check the task folder for existing deliverables:
   - context.md exists? -> PM phase already done
   - task-description.md exists? -> Requirements already done
   - implementation-plan.md exists? -> Architecture already done
   - tasks.md exists? -> Check task statuses to see dev progress
   The orchestration skill's phase detection will automatically
   determine where to resume based on which files exist.

3. Do NOT restart from scratch. Resume from the detected phase.

4. Before developers write code, ensure they read
   .claude/review-lessons/ for accumulated rules.

5. Complete ALL remaining batches. After all tasks COMPLETE in tasks.md:
   a. Create a git commit with all implementation code
   b. Update registry.md: set task status to IMPLEMENTED
   c. Commit the registry update

6. EXIT GATE — Before exiting, verify:
   - [ ] All tasks in tasks.md are COMPLETE
   - [ ] Implementation code is committed
   - [ ] Registry shows IMPLEMENTED for this task
   - [ ] Registry change is committed

7. You do NOT run reviews. Stop after IMPLEMENTED.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

---

### Component 3: Review Worker Prompt Template

**Location**: New section in `.claude/skills/auto-pilot/SKILL.md`, alongside Build Worker prompt.

#### First-Run Review Worker Prompt

```
Run /orchestrate TASK_YYYY_NNN

REVIEW WORKER — AUTONOMOUS MODE

You are a Review Worker. This task is already IMPLEMENTED.
Your job is to review, fix findings, and complete the task.
Follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. No human at this terminal.

2. The task is already implemented. Do NOT re-run PM, Architect,
   or development phases. Start from the QA/review phase.

3. Run ALL available reviewers: style, logic, and security.
   Do not ask which reviewers to run -- run all of them.

4. After reviews complete, fix ALL review findings. Do not skip any
   blocking or serious issues. Fix minor issues where practical.

5. After fixing review findings, create a git commit with the fixes.

6. Reviewers MUST append new lessons to the appropriate
   .claude/review-lessons/ file (review-general.md, backend.md,
   frontend.md).

7. Update registry.md: set task status to IN_REVIEW BEFORE starting
   reviews (so Supervisor knows you started).

8. Complete the orchestration Completion Phase:
   - Write completion-report.md
   - Update registry.md: set task status to COMPLETE
   - Commit: `docs: add TASK_YYYY_NNN completion bookkeeping`

9. EXIT GATE — Before exiting, verify:
   - [ ] All review files exist (code-style-review.md, code-logic-review.md)
   - [ ] Review findings are fixed and committed
   - [ ] completion-report.md exists
   - [ ] Registry shows COMPLETE for this task
   - [ ] All changes are committed
   If any check fails, fix it before exiting.

10. If you encounter errors or blockers, document them in the task
    folder and exit cleanly. The Supervisor will detect the state
    and decide whether to retry.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

#### Retry Review Worker Prompt

```
Run /orchestrate TASK_YYYY_NNN

REVIEW WORKER — CONTINUATION MODE
This task was previously attempted {N} time(s) in the review phase.
The previous Review Worker {reason: stuck / crashed / stopped}.

AUTONOMOUS MODE — follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. No human at this terminal.

2. FIRST: Check the task folder for existing review deliverables:
   - code-style-review.md exists? -> Style review already done
   - code-logic-review.md exists? -> Logic review already done
   - Review findings fixed? -> Check git log for fix commits
   - completion-report.md exists? -> Completion phase already done
   Resume from wherever the previous worker left off.

3. Do NOT re-run reviews that already have output files.
   Do NOT re-run development phases.

4. Fix any remaining review findings. Commit fixes.

5. Append new lessons to .claude/review-lessons/ if not already done.

6. If registry does not yet show IN_REVIEW, set it to IN_REVIEW.

7. Complete the Completion Phase if not already done:
   - Write completion-report.md
   - Update registry.md to COMPLETE
   - Commit bookkeeping

8. EXIT GATE — Before exiting, verify:
   - [ ] All review files exist
   - [ ] Review findings are fixed and committed
   - [ ] completion-report.md exists
   - [ ] Registry shows COMPLETE
   - [ ] All changes are committed

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

---

### Component 4: Exit Gate Specification

**File**: `.claude/skills/orchestration/SKILL.md`
**Action**: MODIFY -- add new section after Completion Phase

#### Exit Gate Section Content

Add a new `## Exit Gate (MANDATORY)` section after the Completion Phase section (after SKILL.md line 311):

```markdown
## Exit Gate (MANDATORY)

Before exiting the orchestration session, verify ALL applicable checks pass.
The Exit Gate ensures workers leave the task in a clean, verifiable state
that the Supervisor can react to.

### Build Worker Exit Gate

Run these checks after implementation is committed and registry is updated:

| Check | Command | Expected |
|-------|---------|----------|
| All sub-tasks COMPLETE | Grep "COMPLETE" in tasks.md | All tasks show COMPLETE |
| Implementation committed | Check git status | No unstaged implementation files |
| Registry updated | Grep task ID in registry.md | Status shows IMPLEMENTED |
| Registry committed | Check git status | registry.md is committed |

If any check fails, fix it before exiting. Do not exit with uncommitted
work or an un-updated registry.

### Review Worker Exit Gate

Run these checks after reviews, fixes, and completion phase are done:

| Check | Command | Expected |
|-------|---------|----------|
| Review files exist | Glob task folder for review-*.md | At least style + logic reviews present |
| Findings fixed | Check review files for BLOCKING/SERIOUS items | All blocking/serious items resolved |
| Fix commit exists | Check git log | Commit with review fixes present |
| completion-report.md exists | Read task folder | File exists and is non-empty |
| Registry updated | Grep task ID in registry.md | Status shows COMPLETE |
| All committed | Check git status | Clean working tree for task files |

### Exit Gate Failure

If you cannot pass the Exit Gate (e.g., a blocker prevents completion):
1. Document the failure in the task folder (create `exit-gate-failure.md`)
2. Exit cleanly -- the Supervisor will detect the missing state transition and retry
```

Also update the Completion Phase section (SKILL.md:248-311) to add a scoping note at the top:

```markdown
> **Scope Note**: The Completion Phase runs in the **Review Worker** session only.
> Build Workers stop after implementation + commit and do NOT run this phase.
```

---

### Component 5: Orchestration SKILL.md Updates

**File**: `.claude/skills/orchestration/SKILL.md`
**Action**: MODIFY

#### 5A. Phase Detection Table Update

**Current** (SKILL.md:123-132): CONTINUATION phase detection table.

**Add note** above the table:
```markdown
> **Worker Scoping**: In autonomous mode, Build Workers use phases up through
> "Dev complete" (all COMPLETE in tasks.md). Review Workers start from
> "Dev complete" and run QA + Completion Phase. In interactive mode,
> a single session runs the full flow.
```

#### 5B. Completion Phase Scoping Note

**Current** (SKILL.md:248): "## Completion Phase (MANDATORY -- DO NOT SKIP)"

**Add** immediately after the heading:
```markdown
> **Scope Note**: In autonomous (Supervisor) mode, this phase runs in the
> **Review Worker** session only. Build Workers stop after implementation
> and do NOT execute this phase. In interactive mode, the single session
> runs this phase as before.
```

#### 5C. Registry Update Change in Completion Phase

**Current** (SKILL.md:295-297):
```markdown
### 2. Update Registry
Update `task-tracking/registry.md` -- set status to COMPLETED.
```

**Change to**:
```markdown
### 2. Update Registry
Update `task-tracking/registry.md` -- set status to COMPLETE.

> In autonomous (Supervisor) mode, the Review Worker sets the status to COMPLETE.
> In interactive mode, the orchestrator sets this status.
```

(Also fix: current text says "COMPLETED" but the registry uses "COMPLETE" -- this is a pre-existing inconsistency to fix.)

#### 5D. Add Exit Gate Section

Add the Exit Gate section specified in Component 4 after the Completion Phase (after line 311).

#### 5E. Key Principles Update

**Current** (SKILL.md:314-322): 7 principles.

**Add**:
- Principle 8: **Exit Gate**: Always run the Exit Gate checks before exiting an autonomous session

---

### Component 6: Task-Tracking Reference Updates

**File**: `.claude/skills/orchestration/references/task-tracking.md`
**Action**: MODIFY

#### 6A. Registry Status Table

**Current** (task-tracking.md:219-229):
```
| CREATED     | Task defined, not yet started      |
| IN_PROGRESS | Task actively being worked         |
| COMPLETE    | All phases done, workflow finished |
| BLOCKED     | Waiting on external dependency     |
| CANCELLED   | Task abandoned                     |
```

**New**:
```
| CREATED     | Task defined, not yet started                              |
| IN_PROGRESS | Build Worker actively implementing                         |
| IMPLEMENTED | Implementation complete, awaiting review                    |
| IN_REVIEW   | Review Worker actively reviewing and fixing                 |
| COMPLETE    | All phases done, workflow finished                         |
| BLOCKED     | Waiting on dependency or retries exhausted                  |
| CANCELLED   | Task abandoned                                             |
```

#### 6B. Folder Structure Update

**Current** (task-tracking.md:26-48): Missing `completion-report.md`.

**Add** to the folder structure listing (after `visual-review.md`):
```
    completion-report.md           # Completion report (Review Worker / orchestrator output)
    exit-gate-failure.md           # Exit gate failure log (worker output, only on failure)
```

#### 6C. Document Ownership Table Update

**Current** (task-tracking.md:143-153): Missing `completion-report.md`.

**Add rows**:
```
| completion-report.md   | Review Worker / Orchestrator | Completion summary, review scores |
| exit-gate-failure.md   | Build/Review Worker          | Exit gate failure details (when applicable) |
```

#### 6D. Phase Detection Table Update

**Current** (task-tracking.md:176-191): Phase detection table.

**Add** a new column or note showing which worker type handles each phase:

Add note above the table:
```markdown
> **Worker Scoping**: In Supervisor mode, the Build Worker handles phases from
> "Initialized" through "Dev complete". The Review Worker handles phases from
> "Dev complete" through "All done".
```

#### 6E. Registry Format Update

**Current** (task-tracking.md:74-82): Example registry with COMPLETE, IN_PROGRESS.

**Update example** to include new states:
```markdown
| TASK_2026_008 | COMPLETE    | FEATURE       | Project settings panel| 2026-01-15 |
| TASK_2026_009 | IMPLEMENTED | BUGFIX        | Fix sidebar collapse  | 2026-01-18 |
| TASK_2026_010 | IN_REVIEW   | DOCUMENTATION | Skill conversion      | 2026-01-20 |
| TASK_2026_011 | IN_PROGRESS | FEATURE       | Dashboard widgets     | 2026-01-22 |
```

---

### Component 7: Auto-Pilot Command Updates

**File**: `.claude/commands/auto-pilot.md`
**Action**: MODIFY

#### 7A. Title and Description

**Current** (auto-pilot.md:1-5): "Auto-Pilot -- Autonomous Task Processing"

**Change**: Keep title as "Auto-Pilot" (this is the command name, not being renamed) but update description:
```markdown
# Auto-Pilot -- Supervisor Task Processing

Start the Supervisor loop. Reads the task backlog, spawns Build Workers
and Review Workers via MCP session-orchestrator, monitors state transitions,
and loops until all tasks are complete or blocked.
```

#### 7B. Parameters Table

**Current** (auto-pilot.md:18-26): Parameters table.

**Verify `--stuck` is absent**: Current file does NOT have `--stuck`. Confirmed no action needed.

No changes to parameters needed.

#### 7C. Step 1: Load Skill

**Current** (auto-pilot.md:30-32): References "auto-pilot/SKILL.md" with note about "full loop logic".

**Update description**:
```markdown
Read `.claude/skills/auto-pilot/SKILL.md` -- this contains the full
Supervisor loop logic, worker type determination, state management,
and monitoring protocol.
```

#### 7D. Step 3c: Single-Task Mode Pre-Flight

**Current** (auto-pilot.md:56-57): Checks task is CREATED.

**Update**: Check task is CREATED or IMPLEMENTED (both are valid for single-task mode):
```markdown
**3c.** If single-task mode: verify the task ID exists in the registry
and its status is CREATED or IMPLEMENTED. If status is IN_PROGRESS or
IN_REVIEW, the Supervisor will spawn the appropriate worker type to resume.
If COMPLETE, warn and confirm. If BLOCKED or CANCELLED, error.
```

#### 7E. Step 4: Display Summary

**Current** (auto-pilot.md:59-73): Summary display.

**Update** to show new state categories:
```
SUPERVISOR STARTING
-------------------
Total tasks in registry: {N}
Ready for build (CREATED): {N}
Building (IN_PROGRESS): {N}
Ready for review (IMPLEMENTED): {N}
Reviewing (IN_REVIEW): {N}
Complete: {N}
Blocked/Cancelled: {N}
Concurrency limit: {N}
Monitoring interval: {N} minutes
Mode: {all | single-task TASK_ID | dry-run}
```

#### 7F. Step 5: Dry-Run Output Update

**Current** (auto-pilot.md:78-100): Dry-run output format.

**Update** to show worker types:
```
DRY RUN -- Execution Plan
========================

Dependency Graph:
  TASK_2026_003 -> [no dependencies] (READY_FOR_BUILD)
  TASK_2026_004 -> TASK_2026_003 (WAITING)
  TASK_2026_005 -> [no dependencies] (READY_FOR_REVIEW)

Execution Order:
  Wave 1 (immediate):
    Review: TASK_2026_005 (P1-High, FEATURE) -- Review Worker
    Build:  TASK_2026_003 (P0-Critical, FEATURE) -- Build Worker
  Wave 2 (after 003):
    Build:  TASK_2026_004 (P1-High, BUGFIX) -- Build Worker
  Blocked: TASK_2026_006 (dependency cycle)

No workers spawned (dry run).
```

#### 7G. Single-Task Mode Behavior

**Current** (auto-pilot.md:104-109): Spawns one worker, monitors, stops.

**Update**:
```markdown
**IF single-task mode (TASK_ID provided):**

Determine worker type from current registry state.
Spawn appropriate worker (Build or Review).
Monitor until that worker completes and state transitions.
If state transitioned to IMPLEMENTED (Build Worker done),
automatically spawn Review Worker and monitor until COMPLETE.
STOP after task reaches COMPLETE or failure.
```

#### 7H. References Update

**Current** (auto-pilot.md:125-129): Reference list.

**Update** skill reference description:
```markdown
- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
```

#### 7I. Quick Reference Update

**Current** (auto-pilot.md:115-122): Quick reference section.

**Update**:
```markdown
**Worker Types**: Build Worker (CREATED -> IMPLEMENTED), Review Worker (IMPLEMENTED -> COMPLETE)
**Modes**: all-tasks (default), single-task, dry-run
**MCP Tools**: spawn_worker, list_workers, get_worker_activity,
              get_worker_stats, kill_worker
**State File**: task-tracking/orchestrator-state.md
**Skill Path**: .claude/skills/auto-pilot/SKILL.md
```

---

## Integration Architecture

### Data Flow

```
Supervisor Loop
  |
  |--> Read registry.md (states: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED)
  |--> Build dependency graph (two queues: Build Queue, Review Queue)
  |--> Spawn workers via MCP
  |      |
  |      |--> Build Worker (runs /orchestrate with Build Worker prompt)
  |      |      |--> PM -> Architect -> Team-Leader -> Dev -> Commit
  |      |      |--> Updates registry: IN_PROGRESS -> IMPLEMENTED
  |      |      |--> Runs Exit Gate
  |      |      |--> Exits
  |      |
  |      |--> Review Worker (runs /orchestrate with Review Worker prompt)
  |             |--> Reviews -> Fix findings -> Commit fixes
  |             |--> Updates registry: IMPLEMENTED -> IN_REVIEW -> COMPLETE
  |             |--> Writes completion-report.md
  |             |--> Runs Exit Gate
  |             |--> Exits
  |
  |--> Monitor workers (health checks)
  |--> Detect state transitions (read registry after worker finishes)
  |--> Handle failures (respawn same worker type if no transition)
  |--> Loop
```

### Key Behavioral Change: Registry Ownership

**Before**: Supervisor reads completion-report.md and updates registry itself.
**After**: Workers update registry directly. Supervisor only reads registry to detect transitions.

This means:
- Step 5 no longer sets IN_PROGRESS in registry on spawn (Build Worker does it)
- Step 7 no longer sets COMPLETE in registry on worker finish (Review Worker does it)
- Supervisor's Step 7 becomes purely observational: "did the state change?"

---

## Quality Requirements

### Non-Functional Requirements

- **Consistency**: All terminology changes applied uniformly (no mixed "auto-pilot"/"supervisor" terminology)
- **Backward Compatibility**: NONE. This is a direct replacement. No old + new parallel systems.
- **Testability**: Each acceptance criterion has a grep/glob verification command
- **Context Efficiency**: Worker prompts must be concise -- each worker only gets instructions relevant to its phase

### Constraints

- File path `.claude/skills/auto-pilot/SKILL.md` stays the same (directory not renamed)
- File path `.claude/commands/auto-pilot.md` stays the same (command name not renamed)
- The `/auto-pilot` command name stays the same
- All other orchestration references and skills not listed above are NOT modified

---

## Verification Plan

Each acceptance criterion with grep/glob patterns to confirm:

| # | Acceptance Criterion | Verification |
|---|---------------------|--------------|
| 1 | SKILL.md renamed to Supervisor | `Grep("# Supervisor Skill" in .claude/skills/auto-pilot/SKILL.md)` -- should match |
| 2 | Task states expanded | `Grep("IMPLEMENTED.*awaiting review" in .claude/skills/orchestration/references/task-tracking.md)` and `Grep("IN_REVIEW.*reviewing" in .claude/skills/orchestration/references/task-tracking.md)` |
| 3 | Two worker types defined | `Grep("Build Worker" in .claude/skills/auto-pilot/SKILL.md)` and `Grep("Review Worker" in .claude/skills/auto-pilot/SKILL.md)` |
| 4 | Supervisor spawn logic | `Grep("READY_FOR_BUILD" in .claude/skills/auto-pilot/SKILL.md)` and `Grep("READY_FOR_REVIEW" in .claude/skills/auto-pilot/SKILL.md)` |
| 5 | Failure handling (no state reset) | `Grep("Leave registry state as-is" in .claude/skills/auto-pilot/SKILL.md)` -- should NOT find "reset to CREATED" in failure handling |
| 6 | Exit Gate in orchestration | `Grep("Exit Gate" in .claude/skills/orchestration/SKILL.md)` |
| 7 | Build Worker prompt template | `Grep("BUILD WORKER" in .claude/skills/auto-pilot/SKILL.md)` |
| 8 | Review Worker prompt template | `Grep("REVIEW WORKER" in .claude/skills/auto-pilot/SKILL.md)` |
| 9 | task-tracking reference updated | `Grep("IMPLEMENTED" in .claude/skills/orchestration/references/task-tracking.md)` in Registry Status section |
| 10 | Registry format supports new states | `Grep("IMPLEMENTED.*IN_REVIEW" in .claude/skills/orchestration/references/task-tracking.md)` in example |
| 11 | Dead --stuck param removed | `Grep("--stuck" in .claude/skills/auto-pilot/SKILL.md)` -- should return 0 matches |
| 12 | completion-report.md in folder structure | `Grep("completion-report.md" in .claude/skills/orchestration/references/task-tracking.md)` |
| 13 | Terminology sweep | `Grep("Auto-Pilot Skill" in .claude/skills/auto-pilot/SKILL.md)` -- should return 0 matches (renamed to Supervisor Skill) |

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: backend-developer
**Rationale**: All changes are markdown/documentation files defining system behavior. No frontend code. The "backend" developer is appropriate for understanding system architecture, state machines, and workflow logic in markdown specification files.

### Complexity Assessment

**Complexity**: HIGH
**Estimated Effort**: 4-6 hours
**Rationale**: While no code is written, the changes span 4 files with deep interdependencies. The Supervisor SKILL.md is a 610-line file requiring careful restructuring. Worker prompt templates must be precise. State machine changes ripple through multiple sections.

### Files Affected Summary

**REWRITE**:
- `.claude/skills/auto-pilot/SKILL.md` (Supervisor restructure -- same path, new content structure preserving unchanged sections)

**MODIFY**:
- `.claude/skills/orchestration/SKILL.md` (Exit Gate section, Completion Phase scoping, key principles)
- `.claude/skills/orchestration/references/task-tracking.md` (new states, folder structure, document ownership)
- `.claude/commands/auto-pilot.md` (terminology, state-aware spawn logic, dry-run format)

### Architecture Delivery Checklist

- [x] All components specified with evidence (file:line citations throughout)
- [x] All patterns verified from codebase (existing state machine, prompt templates, phase detection)
- [x] No hallucinated APIs (all MCP tools verified from SKILL.md:516-543)
- [x] Quality requirements defined (consistency, no backward compat, testability)
- [x] Integration points documented (registry ownership inversion, worker prompts, Exit Gate)
- [x] Files affected list complete (4 files)
- [x] Developer type recommended (backend-developer)
- [x] Complexity assessed (HIGH, 4-6 hours)
- [x] No step-by-step implementation (component specs only)
- [x] State machine fully specified with transitions and ownership
- [x] Build Worker and Review Worker prompt templates complete
- [x] Exit Gate specification complete
- [x] Verification plan with grep/glob patterns
- [x] TASK_2026_002 review findings addressed (dead --stuck, completion-report.md in folder structure, state vs registry reconciliation)
