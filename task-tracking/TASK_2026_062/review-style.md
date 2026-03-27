## CODE STYLE REVIEW — TASK_2026_062

**Score**: 6/10
**File**: `.claude/commands/evaluate-agent.md`

---

### Strengths

- **Procedural completeness**: The happy path (PASS) and both failure paths (FAIL → retry, FAIL × 3 → FLAGGED) are all covered end-to-end without ambiguity gaps in the main flow.
- **Cross-reference accuracy**: All three referenced paths exist on disk — `task-tracking/agent-records/`, `.claude/agents/`, and `.claude/skills/orchestration/references/agent-calibration.md`. No dead links.
- **Failure taxonomy faithfulness**: The failure tags (`scope_exceeded`, `instruction_ignored`, `quality_low`, `wrong_tool_used`) match the canonical 4-tag taxonomy from `agent-calibration.md` exactly, and the References section repeats all four — no divergence.
- **Error messages are actionable**: Both pre-flight error strings (Steps 2a and 2b) tell the user what is missing and what to do about it. That is better than most command docs in this repo.
- **Eval block format is close**: The format in Step 7 is structurally consistent with the `agent-calibration.md` schema definition.

---

### Issues

---

#### Issue 1 — Mixed step numbering scheme violates the project convention (Serious)

**Location**: Steps 2, 5, 7, 8 (sub-steps 2a/2b, 5a/5b, 7a/7b, 8a/8b/8c)

**Problem**: The review-general.md lesson from TASK_2026_043 is explicit: "Step numbering in command docs must be flat and sequential — using mixed schemes (Step 5, Step 5b, Step 5c) signals to future contributors that insertions should continue the sub-letter pattern rather than renumber." This file uses that exact mixed scheme. Sub-steps are partially lettered (2a, 2b) and partially named as nested `###` headings (5a, 5b, 7a, 7b, 8a, 8b, 8c), creating an inconsistency even within the sub-step convention.

**Impact**: Future contributors adding a step between 7 and 8 face an ambiguous convention. Cross-references like "jump to Step 8" from Step 7b are currently stable but fragile once any step is inserted.

**Recommended fix**: Flatten to sequential top-level numbers (1 through ~13). Group 2a/2b under a "Pre-Flight Checks" named section with a bulleted list rather than numbered sub-steps. Use the same for 5a/5b, 7a/7b, 8a–8c.

---

#### Issue 2 — `wrong_tool_used` tag is unreachable from Step 6 scoring (Blocking)

**Location**: Step 4 table (line 69), Step 6 (lines 125–161)

**Problem**: Step 4 designs a test scenario for the `wrong_tool_used` tag. However, Step 6's three scoring dimensions only produce three tags: `scope_exceeded` (Dimension 1), `instruction_ignored` (Dimension 2), and `quality_low` (Dimension 3). There is no dimension that produces `wrong_tool_used` as a FAILURE_TAG. An evaluation run that detects an agent using unauthorized tools has no scoring path that assigns the correct tag. The executor would be forced to choose `instruction_ignored` as the closest match, which produces a mislabeled failure record and corrupts the tag-frequency count used in Step 3 to select the next test scenario.

**Impact**: Once a `wrong_tool_used` failure is mislabeled as `instruction_ignored`, the next evaluation cycle designs a test for instruction compliance rather than tool authorization, missing the actual problem. The calibration loop silently degrades for this entire failure class.

**Recommended fix**: Add a Dimension 4 — Tool Use Check — to Step 6:

```
**Question**: Did the agent use tools, methods, or approaches outside its authorized workflow?

- Review every tool call made during the run
- Check against the agent's expected workflow in its definition

**Pass**: Only authorized tools and approaches used.
**Fail**: Any unauthorized tool or approach used → tag `wrong_tool_used`.
```

---

#### Issue 3 — Eval block write-then-edit pattern creates an atomicity gap (Serious)

**Location**: Step 7 (lines 167–200), Step 7a (lines 186–200)

**Problem**: Step 7 instructs appending the eval block with `Changes made: {description}` before the agent definition has been updated. Step 7a then updates the `Changes made:` field in that block after applying the fix. This means the record file is written once, then immediately edited. If execution is interrupted between the append and the back-edit (context compaction, crash, user interruption), the record contains a permanent block with a placeholder in `Changes made:` that neither reflects "none" nor a real description. The `agent-calibration.md` spec's append-only rule doesn't prohibit editing an entry just written in the same session, but the pattern still creates an inconsistency window.

**Impact**: A partially written eval block is indistinguishable from a completed one. The next run will count it as a FAIL iteration and may FLAGGED the agent prematurely.

**Recommended fix**: Write the eval block after Step 7a completes, not before. The block is only appended once, with all fields already populated. This eliminates the edit step entirely.

---

#### Issue 4 — Eval History block format diverges from the spec for the inline-task case (Serious)

**Location**: Step 7, lines 171–176 vs. `agent-calibration.md` lines 96–103

**Problem**: The spec defines the `Test task` field format as:

```
- Test task: TASK_YYYY_NNN (or inline description if no task ID)
```

The command hardcodes it as:

```
- Test task: inline — {one-line description of the test scenario}
```

The command always uses the `inline —` prefix, with no path for a real task ID. Since the evaluation always runs an inline scenario (per Step 4's design rules: "Write the test scenario as a short inline description... You do NOT need to create a `task.md` file"), the `inline —` prefix is always correct in practice. But the command's block format adds the literal word `inline —` which does not appear in the spec's format definition — only in the filled example (`test task: TASK_2026_EVAL_003`). Agents reading both the spec and the command will see two different field formats and cannot determine which is canonical.

**Impact**: Future eval blocks written by this command and future blocks written by a worker directly consulting the spec will have different `Test task` field formats. Tooling or reviewers that parse this field by prefix will see inconsistencies.

**Recommended fix**: Either align with the spec's format (omit the `inline —` prefix, just write the description) or update the spec to show the `inline —` form as the canonical format for inline scenarios. One of the two must be authoritative.

---

#### Issue 5 — Pre-flight check order is logically inverted (Minor)

**Location**: Steps 2a and 2b (lines 21–25)

**Problem**: Step 2a checks for the agent record before Step 2b checks for the agent definition. A record file's existence is meaningless if the agent definition does not exist — the record schema includes the path to the definition (`Definition File` field), and the evaluation loop reads the definition in Step 3. Checking the record first means a user who has an orphaned record (agent definition was deleted or renamed) sees the record check pass and then fails on the definition check, which may be confusing. The more intuitive order is: verify the thing being evaluated exists (definition), then verify the tracking file for it exists (record).

**Impact**: Low — both checks must pass regardless of order, so no functionality is broken. But the ordering confuses users who have a record but no definition, making them think the record is valid when it is stale.

**Recommended fix**: Swap the order — check `.claude/agents/{AGENT_NAME}.md` first (2a), then `task-tracking/agent-records/{AGENT_NAME}-record.md` (2b).

---

#### Issue 6 — PRIOR_CONSECUTIVE_FAILURES tie-breaking assumes chronological log order (Minor)

**Location**: Step 3, line 46 — "Tie → pick whichever appears most recently"

**Problem**: The tie-breaking rule for `TOP_FAILURE_TAG` relies on "most recently" appearing, which assumes the Failure Log is ordered newest-last. The `agent-calibration.md` spec's append-only rule means normal operation produces chronological order, but correction rows (explicitly permitted by the spec) are appended at the current date and describe an older event. A correction row that reads `| scope_exceeded | TASK_2026_038 | 2026-03-27 | CORRECTION: ... |` will appear at the bottom of the log even though it references an old event, causing it to be treated as the most recent `scope_exceeded` entry and potentially shifting the tie-break outcome.

**Impact**: Low probability but non-zero. Affects which test scenario is chosen, not whether the evaluation runs.

**Recommended fix**: Clarify that "most recently" means the row with the latest `Date` column value, not the row closest to the bottom of the file. Alternatively, note that correction rows are excluded from the frequency count.

---

#### Issue 7 — Step 2a error message does not pinpoint the template location in a long file (Minor)

**Location**: Step 2a error message (line 22)

**Problem**: The error tells users to "Create it from the blank template in `.claude/skills/orchestration/references/agent-calibration.md`". That file is 233 lines long and includes overview prose, failure taxonomy, a filled example, and usage notes before the blank template appears near line 201. An autonomous worker executing this command would read the full file and find the template, but a human following the error message must scroll to find it.

**Impact**: Minor friction for humans. Autonomous workers are unaffected.

**Recommended fix**: Append the section anchor: "...in `.claude/skills/orchestration/references/agent-calibration.md` (see the `### Blank Record Template` section)."

---

### Summary

The command is functionally sound for the happy path and for `scope_exceeded`, `instruction_ignored`, and `quality_low` failure classes. The blocking gap is Issue 2: `wrong_tool_used` is handled in test scenario design (Step 4) but produces no reachable code path in Step 6 scoring, so any detection of unauthorized tool use gets silently mislabeled. This corrupts the tag-frequency counters that drive future test scenario selection, causing the calibration loop to pursue the wrong fix indefinitely for this failure class.

Issue 3 (write-then-edit atomicity) and Issue 4 (eval block format divergence from spec) are serious maintainability risks that will produce inconsistent records over time. The mixed step numbering (Issue 1) violates an existing project lesson and will compound as the command grows.

The document is well-structured prose overall — the scoring logic, FLAGGED summary output, and fix rules are all clearly specified. With the blocking issue resolved and the three serious issues addressed, this would score 8/10.
