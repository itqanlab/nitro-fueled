# Code Style Review — TASK_2026_133

**Reviewer**: nitro-code-style-reviewer
**Score**: 6/10

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `--limit N` semantic split between parallel and sequential mode is undocumented in the Configuration table (SKILL.md:61). A future contributor adding a feature that uses `--limit N` will see the canonical Configuration table definition ("stop after N tasks reach terminal state") and assume it applies to sequential mode too. The actual sequential behavior ("cap the queue to N tasks at build time") is buried in step 5 of the Sequential Mode Flow. The divergence will cause silent logic errors in any tooling that treats `--limit` uniformly across modes.

### 2. What would confuse a new team member?

The `source: auto-pilot-sequential` value (SKILL.md:266) appears nowhere in the Row Format section (SKILL.md:1367–1373) and nowhere in the Concurrent Session Guard section. A new contributor looking for valid `source` values for the active-sessions row will find only `auto-pilot` and `orchestrate` documented. They will not know whether `auto-pilot-sequential` is intentional, a typo of `auto-pilot`, or a third source the Guard ignores by design.

### 3. What's the hidden complexity cost?

Step 3d (command:101–104) validates single-task mode status and explicitly handles IMPLEMENTED (triggers review workers). Sequential mode step 5 (SKILL.md:278) explicitly skips IMPLEMENTED tasks. These two rules interact when `--sequential TASK_X` is invoked and TASK_X is IMPLEMENTED: 3d passes the check, step 5 produces an empty queue, and the session ends silently with `0 completed, 0 failed, 0 blocked` — no error surfaced to the user. This is a silent no-op failure mode.

### 4. What pattern inconsistencies exist?

Other modes in the Step 2 parse block (command:63–80) follow the pattern:
> "If `--X` is present, skip Steps N entirely and **jump directly to the X Mode sequence in SKILL.md**."

The `--sequential` bullet (command:81) deviates: it describes *which sub-step to skip* but never says "jump to the Sequential Mode section in SKILL.md." Step 6 closes the gap (command:303), but the Step 2 entry is asymmetric with every other mode's entry in the same list.

### 5. What would I do differently?

- Make the Configuration table note that `--limit N` has different semantics in sequential mode, with a cross-reference to `## Sequential Mode > Key differences from parallel mode`.
- Add `auto-pilot-sequential` as a documented source value in the Row Format section and clarify whether the Concurrent Session Guard covers it.
- Add an explicit error in sequential step 5 when single-task mode targets an IMPLEMENTED task ("IMPLEMENTED tasks are not processed in sequential mode — run without `--sequential` or choose a CREATED task").

---

## Findings

### [MAJOR] `--limit N` semantic divergence is undocumented in the Configuration table

**Location**: `.claude/skills/auto-pilot/SKILL.md:61` and `:341`

**Issue**: The Configuration table defines `--limit N` as "Stop gracefully after N tasks reach a terminal state (COMPLETE/FAILED/BLOCKED)." That is the parallel-mode definition. Sequential mode redefines `--limit N` as "cap the queue to N tasks at build time" (step 5, line 281), and the Key differences table (line 341) confirms the split. The Configuration table — the primary reference for parameters — has no note about this divergence. A reader who consults only the Configuration table will implement the wrong behavior for sequential mode.

**Fix**: Add a conditional note to the Configuration table's `Task limit` row:
> In sequential mode, `--limit N` caps the queue size at build time (tasks to start), not tasks to terminal state. See `## Sequential Mode > Key differences from parallel mode`.

---

### [MAJOR] `source: auto-pilot-sequential` is undocumented in the Row Format section

**Location**: `.claude/skills/auto-pilot/SKILL.md:266` (use) vs `:1367–1373` (definition)

**Issue**: Sequential mode registers in `task-tracking/active-sessions.md` with `source: auto-pilot-sequential` (step 3, line 266). The Row Format section defines exactly two source values — `auto-pilot` and `orchestrate` — with no mention of `auto-pilot-sequential`. The Concurrent Session Guard section filters by source `auto-pilot` to detect duplicate supervisors; `auto-pilot-sequential` does not match that filter. This means two sequential sessions can run simultaneously without triggering any guard warning.

Two sub-problems:
1. `auto-pilot-sequential` is not listed as a valid source value — future contributors will not know it exists.
2. The Guard's `auto-pilot`-only filter silently permits concurrent sequential sessions.

**Fix**:
1. Add `auto-pilot-sequential` to the Row Format section with the same `| {SESSION_ID} | auto-pilot-sequential | {HH:MM} | {N} | task-tracking/sessions/{SESSION_ID}/ |` format example.
2. Update the Concurrent Session Guard section to include `auto-pilot-sequential` alongside `auto-pilot` in the filter, or add a sentence explicitly documenting that concurrent sequential sessions are intentionally permitted and explaining why.

---

### [MAJOR] Silent no-op when `--sequential TASK_X` targets an IMPLEMENTED task

**Location**: `.claude/commands/nitro-auto-pilot.md:101–104` and `.claude/skills/auto-pilot/SKILL.md:278–279`

**Issue**: Step 3d validates single-task mode and explicitly allows IMPLEMENTED status ("the Supervisor will spawn the appropriate worker type to resume"). Sequential mode step 5 states "include only CREATED tasks (IMPLEMENTED tasks are skipped)." When both rules apply — `--sequential TASK_X` where TASK_X is IMPLEMENTED — step 3d passes without error, step 5 produces an empty queue, and the session exits cleanly with `0 completed, 0 failed, 0 blocked`. No error is surfaced; the user sees a successful session that did nothing.

**Fix**: In sequential step 5, add an explicit guard: "If `single_task_mode` and `target_task_id` status is IMPLEMENTED: ERROR — `SEQUENTIAL MODE does not process IMPLEMENTED tasks. Run without --sequential to trigger a Review Worker, or use a CREATED task.` Exit."

---

### [MINOR] Step 2 parse bullet for `--sequential` does not follow the cross-reference pattern of sibling mode entries

**Location**: `.claude/commands/nitro-auto-pilot.md:81`

**Issue**: Every other mode entry in the Step 2 parse list uses the pattern "skip Steps X entirely and jump directly to the [Mode Name] sequence in SKILL.md." The `--sequential` bullet describes which sub-step to skip but never instructs the reader to "jump to the Sequential Mode section in SKILL.md." This is inconsistent with the pattern established by `--continue` (line 66–67) and `--evaluate` (line 70–71). The gap is closed by Step 6 (line 303), but a reader scanning Step 2 will not find a pointer to the relevant SKILL.md section.

**Fix**: Append to the `--sequential` bullet: "After completing Step 3a and 3b, proceed to Step 4 as normal, then jump to the `## Sequential Mode` section in SKILL.md for the full execution flow."

---

### [MINOR] Step 6e `--limit` break only triggers on COMPLETE, not on BLOCKED/FAILED

**Location**: `.claude/skills/auto-pilot/SKILL.md:308–311`

**Issue**: The Key differences table says sequential `--limit N` means "tasks to start" (queue is capped at N at build time). But step 6e breaks out of the queue only on COMPLETE (line 308), and counts PARTIAL as completed for limit purposes (line 311), while BLOCKED tasks from retry exhaustion do NOT trigger the break. If a task hits the BLOCKED path after retry, the loop continues to the next queued task. This is internally consistent IF the intent is "cap queue to N" — but it is not consistent with the "break when limit reached" check in 6e, which is phrased as a runtime check rather than a compile-time cap. The two mechanisms are redundant and express conflicting mental models.

**Fix**: Remove the runtime `--limit reached: break` check from step 6e entirely. The cap in step 5 (`If --limit N: cap the queue to N tasks`) is sufficient. Having both creates confusion about which semantics apply.

---

### [MINOR] Session log event table has no entry for the case where sequential mode registers in active-sessions or tears down with error

**Location**: `.claude/skills/auto-pilot/SKILL.md:152–158`

**Issue**: The 7 sequential session log events cover start, task-started, complete, partial, retry, blocked, and stopped. There is no event defined for the case where step 5 produces an empty queue (all tasks blocked or filtered). In parallel mode, the loop termination check handles this by writing SUPERVISOR STOPPED. Sequential mode's teardown (step 7) writes SEQUENTIAL STOPPED — but if the queue is empty on entry to step 6, the SEQUENTIAL STOPPED entry will show `0 completed, 0 failed, 0 blocked` with no indication of why. A dedicated event like `SEQUENTIAL EMPTY QUEUE — no CREATED tasks in scope` would make the log debuggable.

**Fix**: Add a log event row: `| Sequential empty queue | \| {HH:MM:SS} \| auto-pilot \| SEQUENTIAL EMPTY — no CREATED tasks match scope \|` and add an explicit log step at the top of step 6 when the queue is empty before iteration begins.

---

### [MINOR] `source` value `auto-pilot` in the Modes table footnote is stale after adding sequential

**Location**: `.claude/skills/auto-pilot/SKILL.md:185`

**Issue**: The footnote "Single-task, dry-run, sequential, and evaluation modes are handled by the command entry point" was correctly updated to include `sequential`. This is fine. However, it describes *command-handled* modes only. The Quick Reference in the command file (nitro-auto-pilot.md:308) lists modes as `all-tasks (default), single-task, dry-run, pause, continue, sequential, evaluate, evaluate-ab, evaluate-role`. This enumeration is the most reader-visible listing of modes. Adding `sequential` there is correct and was done.

No change needed; this is informational confirmation.

---

## Summary

6 findings: 0 critical, 3 major, 3 minor.

The implementation is structurally sound. The Sequential Mode section follows the established pattern of Pause Mode and Continue Mode (named section, "When to use", numbered flow, key differences table). The 7 session log event rows are correctly formatted with the same pipe-table structure as existing rows, and all event labels match the log instructions in the flow steps — the cross-reference contract from review-general.md:102 is satisfied.

The blocking concerns are the `--limit N` semantic divergence, the undocumented `auto-pilot-sequential` source value and its guard implications, and the silent no-op when `--sequential` targets an IMPLEMENTED task. These are not cosmetic — they will produce incorrect runtime behavior or permanently confuse maintainers.
