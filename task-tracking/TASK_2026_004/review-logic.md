# Code Logic Review - TASK_2026_004

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 7.5/10                               |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 1                                    |
| Serious Issues      | 4                                    |
| Moderate Issues     | 4                                    |
| Failure Modes Found | 6                                    |

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Staleness detection can silently produce wrong plan.md content.** Section 5d says "refresh plan.md silently before proceeding" when discrepancies are found between plan.md and registry.md. But the staleness detection only compares task *statuses*. If a task was CANCELLED and removed from registry entirely (not a defined status, but a user manually deleting a row), the plan.md Task Map would still reference it. The Planner would not detect this because it only looks for status mismatches, not missing rows.

**Orphan detection only runs one direction.** Section 8 checks for tasks in registry NOT in plan.md. It does NOT check for tasks in plan.md that are NOT in registry (deleted or corrupted registry rows). Those ghost entries sit in plan.md silently influencing Supervisor tie-breaking via "Next Priorities" forever.

**REPRIORITIZE guidance in Step 3b has no feedback loop.** When the Supervisor sees REPRIORITIZE, it re-reads registry.md. But the Supervisor Guidance field stays as REPRIORITIZE until the Planner manually changes it. If the Planner session ended before updating this field (interrupted session), the Supervisor will re-read registry on *every single loop iteration* indefinitely -- a silent performance concern, not a crash, but wasteful and misleading in logs.

### 2. What user action causes unexpected behavior?

**`/plan status` with argument collision.** If a user runs `/plan status report for the board`, Step 2 of plan.md parses $ARGUMENTS and sees "status" as the first keyword. But the rest of the text is ignored. The user intended a planning conversation about a "status report for the board" feature and gets a status assessment instead. Same issue with `/plan reprioritize the navbar component` -- the user wants to plan a navbar reprioritization feature but gets the reprioritize mode.

**`/plan` with plan.md existing but registry empty.** The onboarding mode triggers when "no plan.md exists AND registry is empty or has no active tasks." But what if plan.md exists from a previous project and the registry was wiped? The user gets "resume" mode which reads a stale plan.md from a completely different context. The mode detection logic does not validate that plan.md content is coherent with registry content.

**Rapid sequential `/plan` invocations.** If a user runs `/plan add authentication` and before the Planner finishes creating tasks, runs `/plan add authorization` in another terminal/session, both Planner instances will read registry.md, compute the same "next NNN", and create colliding task IDs. The collision check in 4e validates against what it read, but both read before either wrote.

### 3. What data makes this produce wrong results?

**Malformed plan.md "Current Focus" section.** If the Supervisor Guidance field contains a typo like "PROCCED" instead of "PROCEED", Step 3b has no fallback behavior defined. The Supervisor extracts the guidance value but the action table only covers four exact strings. An unrecognized value would cause undefined behavior -- the Supervisor might skip consultation entirely, crash, or interpret it as a default. No explicit "ELSE / unknown guidance" clause exists.

**Registry with duplicate task IDs.** The Planner validates "task IDs do not collide with existing entries" (4e), but what if registry.md already has duplicate rows from a prior bug? The Planner reads the highest NNN, which could be from either duplicate. The duplicate itself is never detected or reported.

**plan.md with tasks listed in Task Map but with wrong priority values.** Since plan.md Task Map priorities are "informational" and registry is authoritative, but the Supervisor uses plan.md "Next Priorities" for tie-breaking, there is a data inconsistency risk. If plan.md says TASK_005 is P1 and registry says P0, the Supervisor sorts by registry priority (correct) but then applies plan.md ordering for ties. The tie-breaking list was written under assumptions about priorities that may no longer hold.

### 4. What happens when dependencies fail?

**task-template.md changes between Planner reads.** The Planner reads task-template.md to extract valid enum values. If someone edits task-template.md between the Planner reading it and creating tasks, the Planner uses stale enum values. This is unlikely but the window exists in long planning conversations.

**registry.md write conflict between Planner and Supervisor.** The Planner writes new CREATED rows to registry.md. The Supervisor also writes to registry.md (marking tasks BLOCKED, etc.). There is no locking mechanism. If the Planner is in the middle of creating 5 tasks (writing rows one by one) and the Supervisor marks a task BLOCKED at the same time, one write could overwrite the other. The existing Registry Write Safety section in SKILL.md only addresses Supervisor-vs-Worker conflicts, not Supervisor-vs-Planner conflicts.

**plan.md read by Supervisor during Planner write.** The Planner updates plan.md (adding new tasks to Task Map, updating Current Focus). If the Supervisor reads plan.md mid-write, it could see a partially updated file -- new tasks in Task Map but stale Current Focus, or vice versa. No atomicity guarantee exists.

### 5. What's missing that the requirements didn't mention?

**No plan.md versioning or backup.** plan.md is the single strategic document. If the Planner corrupts it (partial write, interrupted session), there is no backup. The interrupted session recovery (Section 9) handles task folder/registry inconsistencies but does NOT handle plan.md corruption. A half-written plan.md could break the Supervisor's Step 3b parsing.

**No maximum task batch size.** The Planner can propose and create an unlimited number of tasks in one session. If a user approves 30 tasks, the Planner creates 30 task folders, writes 30 registry rows, and updates plan.md with 30 entries -- all in one session. If the session is interrupted at task 17, the first 17 exist but the remaining 13 do not. Plan.md might reference all 30 (written optimistically) or only 17 (written incrementally). The recovery logic handles folder/registry mismatches but not plan.md referencing non-existent tasks.

**No `/plan delete` or `/plan cancel` mode.** The Planner can create tasks and reprioritize them, but cannot cancel or remove tasks from the plan. If a feature is abandoned, there is no documented flow for the Planner to mark tasks CANCELLED, remove them from plan.md, and update the registry.

**No conflict resolution when Planner and `/create-task` both create tasks.** The orphan detection (Section 8) detects tasks created via `/create-task` not in plan.md, but the offer to "incorporate" has no defined protocol. What fields does the Planner add? Where in which phase? What priority? The incorporation flow is hand-waved.

**No Supervisor acknowledgment of ESCALATE.** When ESCALATE is set, the Supervisor logs it and continues. But there is no mechanism for the Product Owner to see the escalation. The log is in orchestrator-state.md which the PO is unlikely to read. The escalation could sit unnoticed indefinitely.

---

## Failure Mode Analysis

### Failure Mode 1: Argument Parsing Ambiguity

- **Trigger**: User runs `/plan status dashboard feature` or `/plan reprioritize the login flow`
- **Symptoms**: User enters status/reprioritize mode instead of planning conversation mode. Unexpected output, confusion.
- **Impact**: Medium -- user gets wrong mode, must re-run with different wording. No data loss.
- **Current Handling**: Simple keyword match on first word of $ARGUMENTS. No disambiguation.
- **Recommendation**: Use exact-match only (entire $ARGUMENTS string equals "status" or "reprioritize"). If $ARGUMENTS is "status dashboard feature", treat as planning intent, not status mode. Alternatively, prefix modes with `--` flag style (`/plan --status`).

### Failure Mode 2: Unrecognized Supervisor Guidance Value

- **Trigger**: Planner writes a typo or future guidance value to plan.md Supervisor Guidance field
- **Symptoms**: Supervisor encounters unknown guidance in Step 3b. Behavior is undefined -- could skip, could error.
- **Impact**: Serious -- Supervisor loop could behave unpredictably on every iteration until plan.md is manually fixed.
- **Current Handling**: No default/fallback case in the Step 3b guidance table.
- **Recommendation**: Add an explicit fallback: "If Supervisor Guidance is not one of the four recognized values, treat as PROCEED and log a warning: `PLAN WARNING -- unrecognized guidance '{value}', defaulting to PROCEED`."

### Failure Mode 3: Registry Write Race Between Planner and Supervisor

- **Trigger**: Planner creates tasks (writing registry rows) while Supervisor is simultaneously running and marking tasks BLOCKED
- **Symptoms**: One actor's registry write overwrites the other's. Tasks disappear from registry or BLOCKED status is lost.
- **Impact**: Critical -- data loss in registry, tasks silently vanish or lose status
- **Current Handling**: None. Registry Write Safety in SKILL.md only covers Supervisor-vs-Worker, not Planner-vs-Supervisor.
- **Recommendation**: Document that the Planner MUST NOT be invoked while `/auto-pilot` is running, OR add a re-read-before-write protocol to the Planner's registry update logic (same pattern as worker prompts). Alternatively, the Planner could check for orchestrator-state.md with RUNNING status and warn the user.

### Failure Mode 4: plan.md Corruption from Interrupted Session

- **Trigger**: Planner session dies mid-write to plan.md (context overflow, user closes terminal, network drop)
- **Symptoms**: plan.md is partially written. Supervisor's Step 3b parsing fails or reads garbage. Current Focus may be missing or malformed.
- **Impact**: Serious -- Supervisor falls back to default ordering (graceful degradation exists), but plan.md remains corrupted until manually fixed.
- **Current Handling**: Section 9 (Interrupted Session Recovery) handles task folder/registry mismatches but does NOT mention plan.md recovery at all.
- **Recommendation**: Add plan.md to the recovery checklist in Section 9. On next invocation, validate plan.md structure (has required sections: Project Overview, Phases, Current Focus). If malformed, warn the PO and offer to regenerate from registry state.

### Failure Mode 5: REPRIORITIZE Guidance Stuck in Loop

- **Trigger**: Planner sets Supervisor Guidance to REPRIORITIZE and then the Planner session ends before resetting it to PROCEED
- **Symptoms**: Supervisor re-reads registry.md on every loop iteration indefinitely. Wasteful I/O, misleading log entries.
- **Impact**: Moderate -- no data corruption, but unnecessary work and confusing logs
- **Current Handling**: No auto-reset mechanism. No timeout on guidance values.
- **Recommendation**: Either (a) require the Planner to always set guidance back to PROCEED after making changes, or (b) have the Supervisor treat REPRIORITIZE as a one-shot action -- after re-reading registry once, mentally treat it as PROCEED for subsequent iterations until plan.md is modified (check file modification timestamp if available).

### Failure Mode 6: Bidirectional Orphan Blindness

- **Trigger**: A task exists in plan.md Task Map but was manually deleted from registry.md
- **Symptoms**: plan.md references a non-existent task. Supervisor's tie-breaking may reference this ghost task in "Next Priorities". No error is raised.
- **Impact**: Moderate -- Supervisor ignores the ghost task ID (it is not in the queue), but plan.md accumulates stale entries that confuse humans reading it.
- **Current Handling**: Section 8 only checks one direction (registry tasks not in plan.md). The reverse is not checked.
- **Recommendation**: Add reverse orphan detection: on every invocation, also check that all task IDs in plan.md exist in registry.md. If not, warn the PO and offer to remove them from plan.md.

---

## Critical Issues

### Issue 1: Registry Write Race Condition -- Planner vs Supervisor

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:157-159` (Section 4e)
- **Scenario**: User runs `/plan` to create tasks while `/auto-pilot` is running in another session. Both write to registry.md concurrently.
- **Impact**: Registry rows from either the Planner or the Supervisor are silently lost. Tasks vanish or lose status updates.
- **Evidence**:
  ```markdown
  ### 4e. Registry Update
  - Add one row per task: `| TASK_YYYY_NNN | CREATED | [Type] | [Description] | YYYY-MM-DD |`
  - Validate task IDs do not collide with existing entries
  ```
  No mention of concurrent access protection. The SKILL.md Registry Write Safety section (lines 69-78) only addresses Supervisor-vs-Worker races.
- **Fix**: Add a guard to the Planner: "Before writing to registry.md, check if `task-tracking/orchestrator-state.md` exists with `Loop Status: RUNNING`. If so, warn the Product Owner that the Supervisor is active and registry writes may conflict. Recommend pausing auto-pilot first." Also add re-read-before-write logic to the Planner's registry update protocol.

---

## Serious Issues

### Issue 2: No Fallback for Unrecognized Supervisor Guidance

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:251-258` (Step 3b guidance table)
- **Scenario**: plan.md contains a typo or unexpected value in the Supervisor Guidance field.
- **Impact**: Undefined Supervisor behavior on every loop iteration.
- **Evidence**:
  ```markdown
  3. Apply guidance:
     | Guidance | Supervisor Action |
     | **PROCEED** | ... |
     | **REPRIORITIZE** | ... |
     | **ESCALATE** | ... |
     | **NO_ACTION** | ... |
  ```
  No "else" or "default" case.
- **Fix**: Add a row: `| **[unrecognized]** | Log: "PLAN WARNING -- unrecognized guidance '{value}', defaulting to PROCEED". Continue to Step 4 with default ordering. |`

### Issue 3: plan.md Not Covered by Interrupted Session Recovery

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:317-323` (Section 9)
- **Scenario**: Session dies while Planner is writing plan.md. File is left partially written.
- **Impact**: Supervisor Step 3b reads malformed plan.md. Could silently fail to parse Current Focus.
- **Evidence**:
  ```markdown
  ## 9. Reliability: Interrupted Session Recovery
  1. Task folder exists but no registry entry: Add the missing registry entry
  2. Registry entry exists but task folder is missing: Warn the Product Owner
  3. Reconcile silently when safe, report when ambiguous
  ```
  No mention of plan.md integrity check.
- **Fix**: Add a fourth recovery check: "4. Validate plan.md structure if it exists: verify it contains `## Current Focus` and `## Phases` sections. If sections are missing or malformed, warn the Product Owner and offer to regenerate Current Focus from registry state."

### Issue 4: Argument Parsing Creates Mode Collision

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/plan.md:25-28` (Step 2)
- **Scenario**: `/plan status page redesign` triggers status mode instead of planning mode.
- **Impact**: User gets wrong mode. Must figure out why and re-run differently.
- **Evidence**:
  ```markdown
  Parse $ARGUMENTS for:
  - `status` keyword -> status mode
  - `reprioritize` keyword -> reprioritize mode
  - Any other text -> new planning conversation
  ```
  "keyword" matching is ambiguous -- does it mean exact match or substring/first-word match?
- **Fix**: Clarify that mode keywords must be an exact match of the entire $ARGUMENTS string (after trimming whitespace). If $ARGUMENTS is "status page redesign", that is NOT a status mode invocation -- it is a planning conversation about a "status page redesign."

### Issue 5: Step 3b Log Event Inconsistency

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:258` (NO_ACTION guidance)
- **Scenario**: NO_ACTION guidance is handled in Step 3b body vs the session log events table.
- **Impact**: Confusing log output; implementer does not know which format to use.
- **Evidence**:
  Step 3b body says: `Log: "PLAN -- no action needed"`
  Session log events table (line 117) says: `[HH:MM:SS] PLAN -- no plan.md found, using default ordering`
  These are for different scenarios (NO_ACTION guidance vs no plan.md file), which is correct. But the NO_ACTION guidance action says to log "PLAN -- no action needed" while there is no corresponding session log event format for it. The "Plan not found" log event is only for when plan.md does not exist.
  Missing: A session log event row for the NO_ACTION guidance case.
- **Fix**: Add a session log event row: `| Plan no action | \`[HH:MM:SS] PLAN -- no action needed\` |`. Also add one for PROCEED: `| Plan proceed | \`[HH:MM:SS] PLAN CONSULT -- guidance: PROCEED\` |` to match the generic "Plan consultation" event.

---

## Moderate Issues

### Issue 6: No `/plan cancel` or `/plan delete` Mode

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md` (Section 3, Interaction Protocols)
- **Scenario**: Product Owner decides to abandon a feature. No defined flow to cancel tasks and remove from plan.
- **Impact**: User must manually edit registry.md and plan.md, bypassing the Planner's ownership model.
- **Fix**: Document that task cancellation is out of scope for this task, or add a minimal protocol: "To cancel tasks, the PO edits registry.md status to CANCELLED. On next `/plan status`, the Planner detects the status change and updates plan.md accordingly."

### Issue 7: Orphan Detection is One-Directional

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:306-314` (Section 8)
- **Scenario**: Task deleted from registry but still in plan.md.
- **Impact**: plan.md accumulates ghost tasks. Human readers are confused.
- **Fix**: Add reverse check: "Also check that all task IDs referenced in plan.md exist in registry.md. If a plan.md task is not in registry, warn the PO and offer to remove it."

### Issue 8: No Guidance on plan.md Concurrency with Supervisor

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:252-282` (Section 6)
- **Scenario**: Planner is updating plan.md Current Focus while Supervisor reads it.
- **Impact**: Supervisor reads partially written Current Focus. Could misparse guidance.
- **Fix**: Add a note in Section 6d: "Write Current Focus section as a single atomic update when possible. Update the Supervisor Guidance field last, as it is the field the Supervisor acts on."

### Issue 9: Planner "Knows" Orchestration Workflow Types But Boundary Is Vague

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/planner.md:48` (Section 2)
- **Scenario**: Planner claims to know "Orchestration workflow types and agent sequences (what each task type triggers)" but Section 10 says it must not "Modify Supervisor SKILL.md or orchestration SKILL.md."
- **Impact**: Ambiguity about how deep this knowledge goes. Does the Planner read orchestration SKILL.md? If so, that consumes context. If not, how does it know workflow types?
- **Fix**: Clarify: "The Planner knows the high-level task types (FEATURE, BUGFIX, etc.) and that each triggers a PM -> Architect -> Dev -> QA pipeline. It does NOT need to read orchestration SKILL.md or understand agent sequencing details."

---

## Data Flow Analysis

```
Product Owner
    |
    | /plan [intent]
    v
plan.md (command) -- Step 1: reads planner.md agent definition
    |                 Step 2: parses $ARGUMENTS
    |                 Step 3: pre-flight checks (task-tracking/, registry.md, task-template.md)
    |                 Step 4: mode detection
    v
Planner Agent (in PO session)
    |
    |-- reads --> task-tracking/registry.md         [GAP: no lock, Supervisor may write concurrently]
    |-- reads --> task-tracking/task-template.md     [OK: static file]
    |-- reads --> task-tracking/plan.md              [GAP: Supervisor may read simultaneously]
    |-- reads --> codebase files via Glob/Grep/Read  [OK: read-only]
    |
    |-- writes --> task-tracking/plan.md             [GAP: no atomicity, partial write risk]
    |-- writes --> task-tracking/TASK_YYYY_NNN/task.md [OK: new files, no contention]
    |-- writes --> task-tracking/registry.md         [GAP: no lock, concurrent write risk]
    |
    v
Supervisor (separate session via /auto-pilot)
    |
    |-- reads --> task-tracking/plan.md Step 3b      [GAP: may read during Planner write]
    |-- reads --> task-tracking/registry.md          [GAP: may read stale data after Planner write]
    |
    v
Workers (spawned by Supervisor)
    |-- NO knowledge of plan.md or Planner           [OK: clean separation]
```

### Gap Points Identified:
1. Registry.md concurrent writes between Planner and Supervisor (Critical)
2. plan.md partial write visible to Supervisor (Moderate)
3. No atomicity guarantee on plan.md updates (Moderate)
4. Orphan detection is one-directional (Moderate)

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Planner agent definition created | COMPLETE | File exists, follows agent format |
| /plan command created | COMPLETE | File exists, follows command format |
| plan.md format defined | COMPLETE | Embedded in planner.md Section 5e |
| Planner can discuss requirements with PO | COMPLETE | Protocol 3a well-defined |
| Planner reads codebase for feasibility | COMPLETE | Section 7 covers methodology |
| Planner creates properly scoped tasks | COMPLETE | Section 4c sizing enforcement |
| Planner creates tasks with dependencies | COMPLETE | Section 4d dependency management |
| Planner updates plan.md on task creation/completion | COMPLETE | Section 5c update triggers |
| Supervisor-Planner consultation protocol | COMPLETE | Step 3b + Section 6, but missing fallback for unrecognized guidance |
| /create-task unchanged | COMPLETE | No modifications to create-task.md |
| New project onboarding flow | COMPLETE | Protocol 3d |
| All 4 interaction modes | COMPLETE | 3a (PO), 3b (status), 3c (reprioritize), 3d (onboarding) |

### Implicit Requirements NOT Addressed:
1. **Cancellation flow** -- no way to cancel/abandon tasks through the Planner
2. **Concurrent access safety** -- no protection against Planner + Supervisor writing to registry.md simultaneously
3. **plan.md corruption recovery** -- interrupted session recovery does not cover plan.md
4. **Escalation visibility** -- ESCALATE guidance has no mechanism to reach the Product Owner
5. **Guidance value validation** -- no fallback for typos/unknown values in Supervisor Guidance field

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| No plan.md exists | YES | Onboarding mode or skip in Supervisor | Clean |
| No registry.md exists | YES | Pre-flight check errors out | Clean |
| Empty registry | YES | Onboarding mode trigger | Clean |
| Malformed plan.md | NO | -- | Supervisor Step 3b has no error handling for parse failures |
| Registry-plan.md task ID mismatch | PARTIAL | Orphan detection one-direction only | Reverse direction missing |
| Concurrent Planner + Supervisor | NO | -- | Registry write race, plan.md read-during-write |
| Interrupted task creation (mid-batch) | PARTIAL | Section 9 handles folder/registry | Does not handle plan.md referencing uncreated tasks |
| `/plan status dashboard` argument collision | NO | Keyword parsing is ambiguous | User gets wrong mode |
| Typo in Supervisor Guidance | NO | No fallback case | Undefined Supervisor behavior |
| 50+ tasks in plan.md | PARTIAL | "Supports up to 50 tasks" mentioned | No enforcement, no degradation handling above 50 |
| Circular dependencies | YES | Section 4d validates before creating | Clean |
| Duplicate task IDs in registry | NO | -- | Planner reads highest NNN but does not detect duplicates |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Planner -> registry.md (write) | MEDIUM | HIGH (data loss) | Needs concurrent access guard |
| Planner -> plan.md (write) | LOW | MEDIUM (corruption) | Needs atomicity consideration |
| Supervisor -> plan.md (read, Step 3b) | LOW | MEDIUM (stale data) | Graceful degradation exists (falls back to default ordering) |
| Planner -> task-template.md (read) | VERY LOW | LOW | Static file, rarely changes |
| Planner -> codebase (read) | VERY LOW | NONE | Read-only, no side effects |
| plan.md format <-> Supervisor parser | MEDIUM | HIGH (loop disruption) | Needs fallback for unrecognized guidance |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: Registry write race condition between Planner and Supervisor -- if both are active simultaneously, registry rows can be silently lost.

### What Must Be Fixed Before Approval:

1. **[Critical]** Add concurrent access guard for registry.md -- at minimum, document that Planner must not run while auto-pilot is active, and add a check for orchestrator-state.md RUNNING status
2. **[Serious]** Add fallback/default case for unrecognized Supervisor Guidance values in Step 3b
3. **[Serious]** Add plan.md to interrupted session recovery checklist (Section 9)
4. **[Serious]** Clarify argument parsing: mode keywords must be exact full-string matches, not substring/first-word

### What Robust Implementation Would Include

Beyond the fixes above, a truly bulletproof implementation would have:

- **Bidirectional orphan detection** (plan.md -> registry AND registry -> plan.md)
- **plan.md structural validation** on every read (verify required sections exist before parsing)
- **Batch creation limit** (max N tasks per session to reduce interruption blast radius)
- **REPRIORITIZE auto-reset** (guidance resets to PROCEED after Supervisor acts on it, or after one iteration)
- **Cancellation protocol** (even if minimal -- document how abandoned features flow through the system)
- **Escalation notification** (mechanism for ESCALATE to reach the PO beyond orchestrator-state.md logs)
- **Session log event for every guidance type** (not just ESCALATE and "not found" -- add PROCEED and NO_ACTION)
- **Duplicate registry row detection** (warn if registry has duplicate task IDs)
