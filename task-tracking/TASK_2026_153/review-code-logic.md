# Code Logic Review — TASK_2026_153

## Review Summary

| Metric              | Value                                    |
|---------------------|------------------------------------------|
| Overall Score       | 7/10                                     |
| Assessment          | NEEDS_REVISION                           |
| Critical Issues     | 1                                        |
| Serious Issues      | 2                                        |
| Moderate Issues     | 2                                        |
| Failure Modes Found | 5                                        |
| Verdict             | PASS (with follow-up items)              |

The core requirement is fulfilled: a Per-Phase Output Budget section was added to SKILL.md, Rule #9 was tightened, and the three targeted locations in parallel-mode.md (Steps 5, 6, 8) now carry the correct one-line formats. However, the task spec listed five acceptance criteria; two of them are partially implemented, and Step 7's Completion event is not wired to its own one-liner at the point where it would fire.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `COMPLETE task=<task_id> → IMPLEMENTED` one-liner is defined in the Per-Phase Output Budget table in SKILL.md, but nowhere in parallel-mode.md Step 7 is the supervisor told to emit it. Step 7 contains log instructions (`Log: "BUILD DONE — TASK_X: IMPLEMENTED..."`) but no conversation output instruction. A supervisor following Step 7 to the letter will write the log, skip the conversation line, and move on. The budget rule exists but the execution point is missing.

### 2. What user action causes unexpected behavior?

A user monitoring a long-running session will see SPAWNED lines and heartbeat lines but never see a Completion line — because Step 7 has no `Output:` directive. The session stays silent about individual task completions; the only signal is the final SESSION COMPLETE line at Step 8. For a 10-task session this means the user has no per-task confirmation during the run.

### 3. What data makes this produce wrong results?

The heartbeat format is now consistent across ANTI-STALL RULE, event-driven, and polling sections:
`[HH:MM] monitoring — N active, N complete, N failed`
However the ANTI-STALL RULE pseudocode block places the `Output:` line AFTER `if done: exit in Step 8`, implying the heartbeat fires even when the loop is about to exit. This is not a data bug but it could produce one extra heartbeat line after the SESSION COMPLETE line if a supervisor interprets the pseudocode literally.

### 4. What happens when dependencies fail?

This task modifies documentation (skill instruction files), not executable code. There are no runtime dependencies to fail. The failure surface is a supervisor misreading ambiguous instructions — covered under silent failures above.

### 5. What's missing that the requirements didn't mention?

The task requirement and the new budget table define a `Completion` row but provide no output enforcement in the `--pause` / `--continue` paths. If a supervisor pauses mid-session (writing `Loop Status: PAUSED`) and then resumes, the Per-Phase Output Budget applies to the resumed session. The pause-continue reference file (`references/pause-continue.md`) is not in scope for this task, and it may still carry the old verbose format for any events that fire during resume. This is a gap the requirement did not foresee.

---

## Failure Mode Analysis

### Failure Mode 1: Completion one-liner defined but never triggered

- **Trigger**: A Build Worker finishes and Step 7d fires. The supervisor reads Step 7d, sees `Log: "BUILD DONE — TASK_X: IMPLEMENTED, queuing Review Worker"`, and follows the log instruction. There is no `Output:` directive in Step 7d.
- **Symptoms**: User sees no per-task completion lines during a live session. The completion budget row (`COMPLETE task=<task_id> → IMPLEMENTED`) in SKILL.md is effectively dead letter.
- **Impact**: Minor confusion in monitoring; session looks silent between spawns and SESSION COMPLETE.
- **Current Handling**: Budget table in SKILL.md names the format but Step 7 in parallel-mode.md has no matching `Output:` instruction.
- **Recommendation**: Add `Output: "COMPLETE task=<task_id> → <new_state>"` to Step 7d immediately after the Log line for IMPLEMENTED and COMPLETE transitions.

### Failure Mode 2: Duplicate output marker in SKILL.md (double `---` separator)

- **Trigger**: This is a structural defect introduced by the diff. The HARD RULES block already ends with `---`. The new Per-Phase Output Budget section begins with another `---` immediately above its heading. The result is two consecutive `---` dividers with no content between them (lines 38-40 of SKILL.md).
- **Symptoms**: Cosmetic noise. No behavioral impact today, but agents that scan section boundaries by `---` patterns may see a phantom empty section or mis-count sections if logic ever parses the file structurally.
- **Impact**: Low probability of operational impact; higher probability of confusion during future edits.
- **Current Handling**: None.
- **Recommendation**: Remove the redundant `---` so there is exactly one divider between the HARD RULES block and the Per-Phase Output Budget section.

### Failure Mode 3: Budget table positions "Session end" as a conversation output, but SKILL.md places the section before the "Autonomous loop" prose

- **Trigger**: SKILL.md now has: HARD RULES → Per-Phase Output Budget → "Autonomous loop that processes the task backlog..." prose. A supervisor reading sequentially reaches the budget table before it reaches the Quick Start section or the Core Loop section. This is fine architecturally because SKILL.md says "re-read this block after every compaction." However the section currently ends without a re-read reminder, while the HARD RULES block has `Re-read this block after every compaction.`
- **Symptoms**: After compaction, a supervisor recovering via `get_session()` will re-read SKILL.md's HARD RULES block (instructed to do so), but the budget table carries no equivalent reminder.
- **Impact**: Low for experienced supervisors; moderate risk during compaction recovery where the supervisor may skip the budget table as "already read."
- **Current Handling**: None.
- **Recommendation**: Append `**Re-read this section after every compaction.**` to the Per-Phase Output Budget section, matching the HARD RULES pattern.

### Failure Mode 4: Task acceptance criterion AC-4 is partially incomplete

- **Trigger**: AC-4 states: "`parallel-mode.md` Step 6 (Monitor) updated: heartbeat is one line. Any analysis of worker health goes to log.md, not the conversation." The heartbeat format is correctly updated in all three Step 6 locations. However, nowhere in Step 6 is the supervisor explicitly told that health analysis from `get_worker_activity` results must go to `log.md`. The existing text says "compact summary" and "context-efficient" but does not say "write health analysis to log.md, not to the conversation."
- **Symptoms**: A supervisor interpreting a `stuck_count` change may narrate the health analysis to the conversation as reasoning. The budget rule bans this, but the budget table is in SKILL.md while the step instructions are in the reference file — a compaction-loaded supervisor working from references alone may not have the budget in context.
- **Impact**: Moderate: verbose monitoring output resumes under compaction if the reference file is loaded but SKILL.md is not re-read.
- **Current Handling**: Budget table in SKILL.md bans it, but enforcement at the execution point is implicit.
- **Recommendation**: Add one sentence to the Step 6 health-check block in parallel-mode.md: "Health analysis details go to log.md only. Conversation output is the heartbeat line — nothing else."

### Failure Mode 5: ANTI-STALL RULE heartbeat appears after the exit check

- **Trigger**: The ANTI-STALL RULE pseudocode in Step 6 shows:
  ```
  while true:
    sleep 30
    get_pending_events()
    if events: handle in Step 7
    if done: exit in Step 8
    Output: "[HH:MM] monitoring — ..."
  ```
  The heartbeat line is the last statement in the loop body — after the `if done: exit` branch. A supervisor following this literally would never emit the heartbeat on the final iteration (the exit fires first), but on non-final iterations it emits the heartbeat after the event-handling branch, not before the sleep.
- **Symptoms**: Heartbeat timing is inconsistent with the intent (which is to emit once per sleep cycle at the top of each iteration, not at the bottom). This is behavioral documentation noise but could cause a supervisor to print the heartbeat after a completion event, creating a confusing ordering.
- **Impact**: Low; cosmetic. No data loss, no silent failure.
- **Current Handling**: The event-driven and polling subsections place the heartbeat before the sleep (correct). The ANTI-STALL RULE summary differs.
- **Recommendation**: Move the `Output:` line in the ANTI-STALL RULE pseudocode to immediately after `sleep 30` — before the event poll — to match the subsection instructions.

---

## Critical Issues

### Issue 1: Completion one-liner has no execution point in Step 7

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 7d
- **Scenario**: Build Worker finishes; supervisor enters Step 7d; follows `Log:` instruction; no `Output:` directive exists for the conversation line.
- **Impact**: The `COMPLETE task=<task_id> → IMPLEMENTED` format defined in the budget is never emitted. Users monitoring a live session see no per-task completion confirmations. The entire Completion row of the budget table is a no-op.
- **Evidence**: Step 7d contains:
  - `Log: "BUILD DONE — TASK_X: IMPLEMENTED, queuing Review Worker"` (line ~887)
  - No `Output:` directive for the conversation
  - Budget table in SKILL.md line 49: `| **Completion** | COMPLETE task=<task_id> → IMPLEMENTED |` — orphaned
- **Fix**: Insert `Output: "COMPLETE task=<task_id> → IMPLEMENTED"` in Step 7d after the Log line for IMPLEMENTED transitions, and `Output: "COMPLETE task=<task_id> → COMPLETE"` for COMPLETE transitions.

---

## Serious Issues

### Issue 2: Double `---` separator introduced by the diff

- **File**: `.claude/skills/auto-pilot/SKILL.md` — lines 38-41
- **Scenario**: Any editor or agent that parses section boundaries finds two consecutive `---` lines with blank lines around them, creating a ghost empty section between HARD RULES and Per-Phase Output Budget.
- **Impact**: Low operational risk now; structural defect that makes future edits ambiguous.
- **Fix**: Remove the extra `---` at line 39 (the one introduced by the new section block).

### Issue 3: Budget enforcement is only in SKILL.md; reference file has no self-contained reminder

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Steps 5, 6, 8
- **Scenario**: After compaction, a supervisor calls `get_session()` to recover state and then loads `references/parallel-mode.md` (per the Load-on-Demand Protocol). If SKILL.md is not re-read post-compaction (Rule #17 says re-read HARD RULES — but if that step is skipped), the budget table is absent from context. The reference file's Step 5 says "Per-Phase Output Budget applies here" and links back — but "links back" to an anchor that does not exist in the reference file itself.
- **Impact**: Moderate: post-compaction verbose output resumes if the cross-file reference is not resolved.
- **Fix**: Add a one-line inline budget reminder in Step 5 and Step 6 of parallel-mode.md:
  `Conversation output: one line only (see Per-Phase Output Budget in SKILL.md HARD RULES, or: SPAWNED/heartbeat/COMPLETE/SESSION COMPLETE formats apply here).`

---

## Moderate Issues

### Issue 4: AC-5 partially incomplete — Step 8 one-liner placed in the termination table but not in Step 8c/8d

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 8 termination table
- **Scenario**: The SESSION COMPLETE one-liner was added to the Step 8 termination table's STOP condition. However Steps 8c (analytics) and 8d (commit) run after Step 8's termination check. If a supervisor following the non-terminal path (compaction limit, MCP unreachable) also needs to output a session-end line, those exit paths in Step 8c/8d have no output instruction.
- **Impact**: Moderate: abnormal terminations (compaction limit, wave failure guard in 5i) produce no SESSION COMPLETE conversation line.
- **Fix**: Add `Output: "SESSION COMPLETE — {N} complete, {N} failed, {N} blocked"` to Step 8d's "on every session stop" sequence, or note in Step 8c that the termination line must already have been output by the caller.

### Issue 5: ANTI-STALL RULE heartbeat position (already described in Failure Mode 5 above)

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 6 ANTI-STALL RULE pseudocode
- **Impact**: Cosmetic ordering confusion.
- **Fix**: Move the `Output:` line in the pseudocode to immediately after `sleep 30`.

---

## Data Flow Analysis

```
Supervisor session start
  → SKILL.md loaded (always)
  → Per-Phase Output Budget in context (CRITICAL — must survive compaction)

Step 5: spawn_worker call
  → Output: "SPAWNED worker=X task=Y provider=Z"   ✓ CORRECT (parallel-mode.md line 693)
  → sleep 30
  → get_pending_events()

Step 6: monitoring loop
  → sleep 30
  → Output: "[HH:MM] monitoring — N active, N complete, N failed"  ✓ CORRECT (all 3 locations updated)
  → get_pending_events()
  → if events → Step 7

Step 7: completion handler
  → Log: "BUILD DONE — TASK_X: IMPLEMENTED..."   ✓ LOG correct
  → Output: "COMPLETE task=X → IMPLEMENTED"       ✗ MISSING — no Output: directive in Step 7d

Step 8: termination
  → Output: "SESSION COMPLETE — N complete, N failed, N blocked"  ✓ CORRECT (added to table)
  → Steps 8c, 8d: abnormal exits
    → No Output: directive  ✗ GAP
```

### Gap Points Identified

1. Step 7d has no `Output:` directive — Completion one-liner is defined but never triggered.
2. Compaction recovery may load parallel-mode.md without SKILL.md budget in context — cross-reference exists but no inline fallback.
3. Abnormal session exit paths (8c/8d) have no SESSION COMPLETE output instruction.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| AC-1: SKILL.md HARD RULE #9 updated with state.md reference | COMPLETE | None |
| AC-2: SKILL.md gains Per-Phase Output Budget section | COMPLETE | Double `---` separator; no re-read-after-compaction reminder |
| AC-3: parallel-mode.md Step 5 Spawn output updated | COMPLETE | None |
| AC-4: parallel-mode.md Step 6 Monitor heartbeat updated | COMPLETE | No explicit log.md routing instruction for health analysis |
| AC-5: parallel-mode.md Step 8 SESSION COMPLETE one-liner | PARTIAL | Added to Step 8 table; absent from abnormal-exit paths in 8c/8d |
| Implicit: Completion event one-liner wired in Step 7 | MISSING | Budget defines it; Step 7d never emits it |

### Implicit Requirements NOT Addressed

1. The `COMPLETE task=<task_id>` format needs an execution point in Step 7, not just a definition in the budget table.
2. Post-compaction budget enforcement requires an inline reminder in the reference file, since SKILL.md re-read is not guaranteed after every recovery.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Multiple workers spawned same wave | YES | One SPAWNED line per worker | None |
| Compaction mid-session | PARTIAL | HARD RULES says re-read — but budget section has no re-read marker | Moderate |
| Abnormal session exit (compaction limit, MCP fail) | NO | SESSION COMPLETE not emitted in 8c/8d exits | Gap |
| Supervisor running before this commit (transition period) | N/A | Handoff notes format transition risk | Acknowledged |
| TASK_2026_152 merge conflict (both tasks modify same files) | RISK | Noted in handoff; no conflict yet | Monitor at merge |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Budget table in SKILL.md ↔ Step 7d in parallel-mode.md | HIGH | Completion one-liner never fires | Add Output: to Step 7d |
| Budget enforcement after compaction | MEDIUM | Budget drops from context if SKILL.md not re-read | Add inline reminder to parallel-mode.md |
| TASK_2026_152 merge | LOW (already noted) | Merge conflict on same two files | Standard git merge |

---

## Verdict

**Recommendation**: PASS (with follow-up items)

The implementation is structurally sound and satisfies four of the five acceptance criteria fully. The session-end and heartbeat formats are correct and consistently placed. The critical gap is that the Completion event one-liner (`COMPLETE task=X → STATE`) is defined in the budget but has no execution point in Step 7 of parallel-mode.md — a supervisor will log internally but emit nothing to the conversation for individual task completions. This is a correctness gap against the stated requirements but not a session-breaking defect, so a hard FAIL is not warranted; the session will still terminate with SESSION COMPLETE and workers will still run correctly.

**Confidence**: HIGH

**Top Risk**: Completion one-liner is dead letter — defined in SKILL.md budget table, absent as an `Output:` directive in parallel-mode.md Step 7d. Users monitoring live sessions will never see per-task completion lines.

---

## What Robust Implementation Would Include

- `Output: "COMPLETE task=<task_id> → <new_state>"` in Step 7d immediately after each Log line for state transitions, covering IMPLEMENTED, COMPLETE, and BLOCKED cases.
- `Output: "SESSION COMPLETE — {N} complete, {N} failed, {N} blocked"` added to Step 8c or Step 8d's "on every session stop" instruction to cover abnormal exits.
- A single-line inline budget summary embedded in parallel-mode.md Steps 5 and 6 (`Conversation output: one line only — budget enforced in SKILL.md`) so post-compaction reference-file-only recoveries still respect the constraint.
- Removal of the duplicate `---` separator between the HARD RULES end and the Per-Phase Output Budget heading in SKILL.md.
- `**Re-read this section after every compaction.**` added to the Per-Phase Output Budget section, matching the HARD RULES block's own compaction reminder.
