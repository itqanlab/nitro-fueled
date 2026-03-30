# Code Logic Review — TASK_2026_106

## Review Summary

| Metric              | Value                                              |
| ------------------- | -------------------------------------------------- |
| Overall Score       | 4/10                                               |
| Assessment          | NEEDS_REVISION                                     |
| Critical Issues     | 2                                                  |
| Serious Issues      | 2                                                  |
| Moderate Issues     | 1                                                  |
| Failure Modes Found | 4                                                  |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

A Build Worker or Cleanup Worker resumes a task that has `implementation-plan.md` on disk (21 existing tasks). It reads the Build Worker prompt from `auto-pilot/SKILL.md` which does contain the legacy fallback on line 2221. The worker therefore detects the architect phase as done and skips ahead correctly. So far so good. But then the worker calls into `team-leader-modes.md` (line 36), which hardcodes `Read implementation-plan.md` in the MODE 1 invocation template. The team-leader receives a prompt instructing it to read the old filename. If the file is named `plan.md` (new tasks) the team-leader opens the wrong filename and silently gets nothing — no error, just missing context, and it proceeds to create a `tasks.md` with no plan to decompose. This is a silent data-loss failure with no error message.

### 2. What user action causes unexpected behavior?

An operator runs `/orchestrate TASK_2026_NNN` on a brand-new task (post-refactor) where the architect creates `plan.md`. The orchestrator arrives at the CONTINUATION phase detection table in `SKILL.md` — the table now correctly says `plan.md (or legacy: implementation-plan.md)`. Detection works. But the orchestrator then invokes `nitro-team-leader MODE 1` using the prompt template in `team-leader-modes.md`, which tells the team-leader to `Read implementation-plan.md`. The team-leader attempts to open a file that does not exist. The failure mode depends on the team-leader's error handling; in practice it will proceed with blank context and decompose tasks incorrectly.

### 3. What data makes this produce wrong results?

Any task folder that contains only `plan.md` (new naming, post-refactor). The agent-catalog.md lists `implementation-plan.md` as the Inputs entry for every agent that consumes the plan: `nitro-team-leader`, `nitro-backend-developer`, `nitro-systems-developer`, `nitro-frontend-developer`, `nitro-devops-engineer`, `nitro-senior-tester`, `nitro-visual-reviewer`, `nitro-code-style-reviewer`. When an orchestrator reads `agent-catalog.md` to determine what inputs an agent needs, it gets the old filename — leading to agents looking for a file that no longer exists.

### 4. What happens when dependencies fail?

The `nitro-software-architect` agent (`nitro-software-architect.md`) still hardcodes `implementation-plan.md` as its output filename in 6 places, including the instruction "BEFORE creating implementation-plan.md". When the architect runs, it will create a file named `implementation-plan.md`, not `plan.md`. This means the phase detection in `SKILL.md` and `task-tracking.md` will use the legacy fallback path — which works, but defeats the entire purpose of this refactoring. No new task created after this commit will actually have `plan.md` on disk.

### 5. What's missing that the requirements didn't mention?

The task's context.md lists exactly 5 affected files. The actual blast radius (discovered via grep) is 22 files in `.claude/` that reference `implementation-plan.md`. Only 5 were updated. The 17 remaining files mean the rename is half-done: the orchestration skill detects `plan.md`, but every downstream agent still reads, writes, and references `implementation-plan.md`. The system is now in a split-brain state where different layers use different filenames for the same artifact.

---

## Failure Mode Analysis

### Failure Mode 1: Architect Still Writes the Old Filename

- **Trigger**: Any task where the architect phase runs post-refactor
- **Symptoms**: `nitro-software-architect.md` line 55 says "BEFORE creating implementation-plan.md". The architect creates `implementation-plan.md`. The orchestrator detects it via the legacy fallback. The rename never actually happens in practice for new tasks.
- **Impact**: The entire refactoring delivers zero behavioral change. Old filename continues to be created indefinitely.
- **Current Handling**: Legacy fallback catches the detection, so no crash — but the rename silently never takes effect.
- **Recommendation**: `nitro-software-architect.md` must be updated to write `plan.md`.

### Failure Mode 2: Team-Leader Receives Wrong Read Instruction

- **Trigger**: MODE 1 invocation for any task — new or existing — after this change
- **Symptoms**: `team-leader-modes.md` line 36 contains `Read implementation-plan.md`. The orchestrator copies this template literally into the team-leader prompt. For tasks with only `plan.md`, the team-leader opens a nonexistent file.
- **Impact**: Tasks decompose with missing context; batches are invented rather than derived from the plan; wrong files get modified; implementation drifts from architecture.
- **Current Handling**: None. No fallback in the template, no "or legacy" qualifier.
- **Recommendation**: `team-leader-modes.md` must use `plan.md (or legacy: implementation-plan.md)` in both the Mode Overview table and the invocation template.

### Failure Mode 3: All Agent Definitions Reference the Wrong Input File

- **Trigger**: Any agent execution phase after this refactor
- **Symptoms**: `agent-catalog.md` lists `implementation-plan.md` as the Inputs artifact for 9 agent profiles. `nitro-backend-developer.md`, `nitro-systems-developer.md`, `nitro-frontend-developer.md`, `nitro-devops-engineer.md`, `nitro-visual-reviewer.md`, `nitro-code-style-reviewer.md`, `nitro-senior-tester.md` all hardcode `Read(task-tracking/TASK_[ID]/implementation-plan.md)` in their execution steps.
- **Impact**: For new tasks with `plan.md`, every developer and reviewer reads nothing and proceeds without architectural context. Code generation is unconstrained and likely to miss requirements.
- **Current Handling**: None.
- **Recommendation**: All 9 agent files and `agent-catalog.md` must be updated.

### Failure Mode 4: nitro-orchestrate-help.md and nitro-project-status.md Give Wrong Guidance

- **Trigger**: User or Supervisor reads command help to understand what artifacts exist
- **Symptoms**: `nitro-orchestrate-help.md` line 45 says "Creates implementation-plan.md". `nitro-project-status.md` line 41 checks for `implementation-plan.md` to determine if architecture was done.
- **Impact**: `nitro-project-status.md`'s phase detection is independent of the orchestration skill's phase detection — it will report tasks with `plan.md` as not having completed the architect phase. Status reports will be wrong for every task created post-refactor.
- **Current Handling**: None.
- **Recommendation**: Both command files must be updated.

---

## Critical Issues

### Issue 1: nitro-software-architect.md Still Outputs `implementation-plan.md`

- **File**: `.claude/agents/nitro-software-architect.md` (lines 55, 182, 382, 409, 597, 608)
- **Scenario**: Any architect invocation after this commit
- **Impact**: The root artifact of the entire pipeline is still created under the old name. Every downstream agent that reads it via the hardcoded old name will continue to work — but none of them will ever find `plan.md`. The refactoring is a no-op in production.
- **Evidence**: `nitro-software-architect.md:55` — "BEFORE creating implementation-plan.md"
- **Fix**: Replace all 6 occurrences in `nitro-software-architect.md` with `plan.md`. The output filename definition is the linchpin of the entire rename.

### Issue 2: `nitro-project-status.md` Phase Detection Uses Old Filename

- **File**: `.claude/commands/nitro-project-status.md:41`
- **Scenario**: `/project-status` run on any task created post-refactor
- **Impact**: The status command checks for `implementation-plan.md` to determine if the architect phase completed. For new tasks with `plan.md`, it will report architect phase as incomplete even when the plan exists. This affects Supervisor decision-making if it relies on this command, and misleads developers checking task state.
- **Evidence**: `.claude/commands/nitro-project-status.md:41` — checks `implementation-plan.md`
- **Fix**: Update to check `plan.md` first, fall back to `implementation-plan.md` (same legacy pattern used in the phase detection tables).

---

## Serious Issues

### Issue 3: `team-leader-modes.md` Invocation Template Hardcodes Old Filename

- **File**: `.claude/skills/orchestration/references/team-leader-modes.md` (lines 11, 21, 36)
- **Scenario**: Every MODE 1 invocation; orchestrator pastes the template literally into the team-leader prompt
- **Impact**: Team-leader reads the wrong file for new tasks. Silent missing-context failure.
- **Fix**: Update lines 11, 21, and 36 to reference `plan.md (or legacy: implementation-plan.md)`.

### Issue 4: Nine Agent Files Hardcode `Read(implementation-plan.md)`

- **Files**: `agent-catalog.md` (9 agent profiles), `nitro-backend-developer.md`, `nitro-systems-developer.md`, `nitro-frontend-developer.md`, `nitro-devops-engineer.md`, `nitro-visual-reviewer.md`, `nitro-code-style-reviewer.md`, `nitro-senior-tester.md`, `developer-template.md`, `nitro-team-leader.md`
- **Scenario**: Any execution of developer or reviewer agents on post-refactor tasks
- **Impact**: Agents receive empty plan context; implementation and review quality degrades to zero-plan mode.
- **Fix**: Each `Read(task-tracking/TASK_[ID]/implementation-plan.md)` call must try `plan.md` first, then fall back to `implementation-plan.md`.

---

## Moderate Issues

### Issue 5: `nitro-orchestrate-help.md` Help Text Is Stale

- **File**: `.claude/commands/nitro-orchestrate-help.md:45`
- **Scenario**: User reads help docs or an agent reads command reference
- **Impact**: Help text says "Creates implementation-plan.md". Low operational severity but creates confusion and documentation drift.
- **Fix**: Update to "Creates plan.md".

---

## Data Flow Analysis

```
User request
     |
     v
SKILL.md Phase Detection       <- UPDATED: "plan.md (or legacy: implementation-plan.md)" [OK]
     |
     v
nitro-software-architect       <- NOT UPDATED: still creates "implementation-plan.md"   [BROKEN]
     |
     v  (file written: implementation-plan.md  -- not plan.md)
task-tracking/TASK_[ID]/
     |
     v
task-tracking.md Phase Table   <- UPDATED: fallback present                             [OK]
     |
     v
team-leader-modes.md Prompt    <- NOT UPDATED: "Read implementation-plan.md"            [BROKEN]
     |
     v
nitro-team-leader (MODE 1)     <- NOT UPDATED: reads wrong filename on new tasks        [BROKEN]
     |
     v
Developer agents               <- NOT UPDATED: read "implementation-plan.md"            [BROKEN]
     |
     v
Reviewer agents                <- NOT UPDATED: read "implementation-plan.md"            [BROKEN]
     |
     v
nitro-project-status.md        <- NOT UPDATED: checks "implementation-plan.md"          [BROKEN]
```

**Gap Points Identified:**
1. The architect output filename (the source) was not changed — every file the architect creates will still be named `implementation-plan.md`, making all legacy fallback logic permanently active and the rename permanently inactive.
2. The team-leader invocation template (the handoff point) uses the old filename, breaking new-task flows where `plan.md` actually exists.
3. The status command uses the old filename, causing incorrect phase reporting for all post-refactor tasks.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Phase detection in SKILL.md uses `plan.md` with legacy fallback | COMPLETE | OK — line 203 |
| Phase detection in task-tracking.md uses `plan.md` with legacy fallback | COMPLETE | OK — line 191 |
| strategies.md references `plan.md` for architect output | COMPLETE | OK — confirmed in REFACTORING/FEATURE/DEVOPS flows |
| checkpoints.md references `plan.md` | COMPLETE | OK — Checkpoint 2 template and post-architect commit both reference `plan.md` |
| auto-pilot/SKILL.md Build Worker prompt has legacy fallback | COMPLETE | OK — lines 2221 and 2601 |
| Architect agent actually creates `plan.md` | MISSING | `nitro-software-architect.md` not updated — still creates `implementation-plan.md` |
| Developer agents read `plan.md` | MISSING | All 7 developer/reviewer agents still read `implementation-plan.md` |
| Team-leader invocation template uses `plan.md` | MISSING | `team-leader-modes.md` not updated |
| Agent catalog uses `plan.md` | MISSING | `agent-catalog.md` not updated |
| Status command detects `plan.md` | MISSING | `nitro-project-status.md` not updated |

### Implicit Requirements NOT Addressed:
1. The rename must be complete at the producer (architect) for the consumer (all downstream agents) to ever see `plan.md`. Without updating the architect, no new task will ever have a file named `plan.md` on disk, and the entire refactoring remains inert.
2. Every agent that reads the plan must use the same fallback pattern as the phase detection tables, not a hard requirement for either filename.
3. All command-level docs that reference the artifact name must be in sync — they drive user expectations and supervisor decisions.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Existing task with `implementation-plan.md` on disk | YES | Legacy fallback in phase detection | OK |
| New task where architect runs post-refactor | NO | Architect still creates `implementation-plan.md` | The rename never happens |
| Team-leader MODE 1 on new task with `plan.md` | NO | Prompt template hardcodes old filename | Silent missing-context failure |
| Project status check on post-refactor task | NO | `nitro-project-status.md` uses old filename | Wrong phase reported |
| Developer agent on new task with only `plan.md` | NO | All agent definitions use old filename | Agents operate without plan context |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Architect -> plan artifact | HIGH | Every new task affected | Update `nitro-software-architect.md` output filename |
| Orchestrator -> team-leader prompt | HIGH | MODE 1 decomposition context lost | Update `team-leader-modes.md` template |
| Orchestrator -> developer agents | HIGH | All dev phases lack plan context | Update all 7+ agent files |
| Status command -> task state | HIGH | Wrong phase displayed for all new tasks | Update `nitro-project-status.md` |
| auto-pilot Build Worker -> resume logic | LOW | Legacy fallback present | Already handled |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `nitro-software-architect.md` was not updated. The architect is the producer of the plan artifact. As long as it writes `implementation-plan.md`, no task will ever have `plan.md` on disk, and every legacy fallback added in this refactoring will be permanently exercised instead of ever being retired. The rename is logically complete only in the detection layer; it is entirely absent in the production layer.

---

## What Robust Implementation Would Include

A complete version of this refactoring would have:

1. **Architect output update** — `nitro-software-architect.md` writes `plan.md`, with a single note that `implementation-plan.md` is the legacy name for backward reference only.
2. **Team-leader prompt update** — `team-leader-modes.md` MODE 1 template uses `plan.md (or legacy: implementation-plan.md)` so it works for both old and new tasks.
3. **Agent read-fallback pattern** — Every agent that reads the plan uses: try `plan.md`, if not found try `implementation-plan.md`. This is the same pattern as the phase detection tables.
4. **Agent catalog update** — `agent-catalog.md` Inputs tables list `plan.md` as the primary name.
5. **Status command update** — `nitro-project-status.md` checks for `plan.md` with the same legacy fallback.
6. **Help text update** — `nitro-orchestrate-help.md` updated to the new name.
7. **Scope was 22 files, not 5** — The task context.md listed 5 affected files. Grep shows 22 files in `.claude/` reference `implementation-plan.md`. A complete refactoring must address all 22. The 17 unaddressed files leave the system in a split-brain state indefinitely.

---

## Review Lessons Added

- **Refactoring scope must include producers, not just detectors** — When renaming an artifact in a documentation/orchestration system, the file that CREATES the artifact (the producer agent) is the most critical update. Detection-layer changes that add legacy fallbacks are only safe if the producer is also updated; otherwise the rename never takes effect and the fallbacks become permanent. (TASK_2026_106)
- **Grep the full repo before scoping a rename task** — The task context listed 5 files but the actual blast radius was 22. Always run a grep for the target string before writing the implementation plan; the real scope determines whether the task needs splitting. (TASK_2026_106)
