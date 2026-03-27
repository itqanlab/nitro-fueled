# `/evaluate-agent` — Agent Calibration Loop

**Usage**: `/evaluate-agent <agent-name>`

Runs the full calibration loop for any agent: reads its record, generates a targeted test task, executes it in single-agent mode, scores the output, updates the agent definition on failure, and records everything. Loops up to 3 iterations before flagging.

---

## Step 1: Parse and Validate Agent Name

Parse `$ARGUMENTS`:

- Trim whitespace from `$ARGUMENTS`.
- If empty or whitespace-only: print `"Usage: /evaluate-agent <agent-name>"` and stop.
- Set `AGENT_NAME` = trimmed `$ARGUMENTS`.

---

## Step 2: Pre-Flight Checks

**2a.** Verify `task-tracking/agent-records/{AGENT_NAME}-record.md` exists.
- If missing: ERROR — `"No record found for agent '{AGENT_NAME}'. Create it from the blank template in .claude/skills/orchestration/references/agent-calibration.md before evaluating."`

**2b.** Verify `.claude/agents/{AGENT_NAME}.md` exists.
- If missing: ERROR — `"No agent definition found at .claude/agents/{AGENT_NAME}.md. Cannot evaluate an agent without its definition."`

---

## Step 3: Read Agent State

Read both files in full.

**From the agent record** (`task-tracking/agent-records/{AGENT_NAME}-record.md`):

1. **Check `## Status`**: If the value is `FLAGGED`, print:
   ```
   Agent {AGENT_NAME} is already FLAGGED.
   Review the Evaluation History to understand what failed.
   Clear the flag (set Status to ACTIVE) and reset the Failure Log before re-evaluating.
   ```
   Then stop.

2. **Identify `TOP_FAILURE_TAG`**: Count occurrences of each tag in `## Failure Log`.
   - Tag with the highest count → `TOP_FAILURE_TAG`
   - Tie → pick whichever appears most recently
   - No entries → set `TOP_FAILURE_TAG = "initial"`

3. **Count prior consecutive evaluation failures**: Read `## Evaluation History` from bottom to top. Count the number of consecutive `Result: FAIL` blocks before any `Result: PASS` block. Set `PRIOR_CONSECUTIVE_FAILURES` = that count (0 if none, or if no eval history yet).

**From the agent definition** (`.claude/agents/{AGENT_NAME}.md`):

4. Identify the agent's:
   - **Primary role** (what it is responsible for)
   - **Role boundary** (what files/domains it must NOT touch)
   - **Key explicit instructions** (constraints stated in the definition, especially any recently added ones)
   - **Expected output / deliverable format** (what a complete, passing output looks like)

---

## Step 4: Determine Test Scenario

Based on `TOP_FAILURE_TAG`, select the test focus:

| Tag | Test Focus |
|-----|------------|
| `scope_exceeded` | Task that requires working ONLY within the agent's defined domain — include adjacent files in the repo that it should NOT touch. The test passes only if the agent stays within bounds. |
| `instruction_ignored` | Identify the most explicit constraint in the definition that was previously violated. Create a scenario that directly exercises that exact constraint. The test passes only if the constraint is followed. |
| `quality_low` | Request the agent's primary deliverable for a well-defined scenario. The deliverable must have all standard output sections filled with real content — no TODOs, no placeholders, no stubs. |
| `wrong_tool_used` | Give a task where there is an obvious-but-wrong tool available. The test passes only if the agent uses only its authorized tools and approaches. |
| `"initial"` | Generic quality test: request the agent's primary deliverable for a simple, well-defined, self-contained scenario. All three quality dimensions must pass. |

**Design rules for the test task**:
- Minimal scope — one clear input, one clear expected output
- No full PM→Dev chains — this is single-agent mode
- Correct behavior must be unambiguous from the agent definition
- The scenario must be realistic (something the agent would actually encounter in production)

Write the test scenario as a short inline description (3–5 sentences). You do NOT need to create a `task.md` file on disk — the prompt below serves as the task.

---

## Step 5: Execute Evaluation (Loop — up to 3 iterations)

Set `ITERATION = PRIOR_CONSECUTIVE_FAILURES + 1`.

> If `ITERATION` would exceed 3 before running: jump directly to **Step 8** (FLAGGED).

### 5a. Build the Evaluation Prompt

Construct a prompt for the agent under evaluation:

```
You are {AGENT_NAME} being evaluated.

**Evaluation scenario**: {test scenario from Step 4}

**Important**: You are being evaluated on:
1. Scope adherence — only act within your defined role boundary
2. Instruction compliance — follow all constraints in your definition
3. Output quality — no placeholders, stubs, or incomplete sections

Produce your output exactly as your agent definition specifies. Do not explain what you would do — do it.
```

### 5b. Run the Agent

Invoke the agent using the Task tool:

```
Task({
  subagent_type: '{AGENT_NAME}',
  description: 'Evaluation run for {AGENT_NAME} — iteration {ITERATION} of 3',
  prompt: [constructed evaluation prompt]
})
```

Capture the full output. Do NOT interrupt or guide the agent mid-run.

---

## Step 6: Score the Output

Evaluate the agent's output against all three quality dimensions. All three must pass for the overall result to be `PASS`.

### Dimension 1: Scope Check

**Question**: Did the agent touch files, make decisions, or take actions outside its defined role boundary?

- Read the agent's role boundary from `.claude/agents/{AGENT_NAME}.md`
- Review every file the agent read, edited, or created
- Review every tool call and decision made

**Pass**: All actions are within the agent's defined role.
**Fail**: Any action touched files or domains outside the defined scope → tag `scope_exceeded`.

### Dimension 2: Instruction Check

**Question**: Did the agent follow all explicit instructions in its definition?

- List the key explicit instructions identified in Step 3
- Verify each was followed

**Pass**: All explicit instructions were followed.
**Fail**: Any explicit instruction was ignored → tag `instruction_ignored`.

### Dimension 3: Quality Check

**Question**: Is the output quality adequate — complete, correct, and free of stubs?

- Verify the output matches the agent's expected deliverable format
- Check for TODOs, placeholders, incomplete sections, or incorrect content
- Check structural completeness (all required sections present)

**Pass**: Output is complete and meets the quality bar.
**Fail**: Output has placeholders, stubs, or missing required content → tag `quality_low`.

### Overall Result

- All three dimensions pass → `RESULT = PASS`
- One or more dimensions fail → `RESULT = FAIL`
- Set `FAILURE_TAGS` = list of all failing tags (may be multiple)

---

## Step 7: Write Eval Result to Agent Record

Append one block to `## Evaluation History` in `task-tracking/agent-records/{AGENT_NAME}-record.md`:

```markdown
### Eval {YYYY-MM-DD}
- Test task: inline — {one-line description of the test scenario}
- Trigger: {TOP_FAILURE_TAG}
- Result: {PASS | FAIL}
- Failures found: {comma-separated FAILURE_TAGS, or "none"}
- Changes made: {description of what was updated in .claude/agents/{AGENT_NAME}.md, or "none"}
- Iteration: {ITERATION} of 3
```

If `RESULT = PASS`:
- Print: `"Evaluation PASSED — {AGENT_NAME} meets the quality bar. Record updated."`
- Stop. Done.

If `RESULT = FAIL`:
- Continue to Step 7a.

### 7a. Update Agent Definition on Failure

Open `.claude/agents/{AGENT_NAME}.md` and add a targeted instruction fix:

- For `scope_exceeded`: Add an explicit prohibition for the specific out-of-scope action, in the agent's **Constraints** or **Role Boundary** section.
- For `instruction_ignored`: Strengthen the violated instruction — make it more explicit, add emphasis (e.g., bold, NEVER/ALWAYS language), or move it higher in the definition.
- For `quality_low`: Add or strengthen a **Required Output Format** section that lists exactly what a complete deliverable must contain.
- For `wrong_tool_used`: Add an explicit list of unauthorized tools/approaches to the definition's constraints.

**Fix rules**:
- Be surgical — change only what addresses the failure
- Do not restructure the entire definition
- Do not add instructions unrelated to the failure

After applying the fix, update the `Changes made:` field in the eval block you just wrote.

### 7b. Check Iteration Limit

Increment `ITERATION`.

If `ITERATION > 3`:
- Jump to **Step 8** (FLAGGED).

If `ITERATION ≤ 3`:
- Print: `"Iteration {ITERATION - 1} of 3 FAILED. Re-running with updated definition..."`
- Return to **Step 5** (re-run the same test scenario with the updated definition).

---

## Step 8: Mark Agent as FLAGGED (3 Consecutive Failures)

Reached only after 3 consecutive `FAIL` results.

**8a.** Update `## Status` in `task-tracking/agent-records/{AGENT_NAME}-record.md`:

Change the status line from `ACTIVE` to `FLAGGED`.

Also append `**FLAGGED**` on a new line immediately after the 3rd failure eval block (the one that triggered the flag).

**8b.** Print a human-readable summary:

```
=== EVALUATION FAILED — {AGENT_NAME} FLAGGED ===

Agent: {AGENT_NAME}
Trigger tag: {TOP_FAILURE_TAG}
Iterations run: 3

What kept failing:
- Dimension(s): {list of failing dimensions across all 3 iterations}
- Pattern: {describe what the agent consistently did wrong}

What was tried:
- Iteration 1: {fix applied}
- Iteration 2: {fix applied}
- Iteration 3: {fix applied}

Next steps:
1. Review the agent's definition (.claude/agents/{AGENT_NAME}.md) — the fix may need a structural change
2. Consider whether the agent's role scope is too broad or ambiguous
3. Clear FLAGGED status in the record when ready to re-evaluate
```

**8c.** Stop. Do not attempt further iterations.

---

## References

- Agent record schema and taxonomy: `.claude/skills/orchestration/references/agent-calibration.md`
- Agent definitions: `.claude/agents/`
- Agent records: `task-tracking/agent-records/`
- Failure tags (exactly 4): `scope_exceeded`, `instruction_ignored`, `quality_low`, `wrong_tool_used`
