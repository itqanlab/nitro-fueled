# User Checkpoints Reference

This reference documents all user validation checkpoints in the orchestration workflow, including trigger conditions, templates, and error handling patterns.

---

## Core Principle

**NEVER proceed past a checkpoint without explicit user approval.** Checkpoints are mandatory synchronization points where the user reviews work and decides the next action.

---

## Checkpoint Types Overview

| #      | Checkpoint                  | When              | Purpose                        | Response Expected                     |
| ------ | --------------------------- | ----------------- | ------------------------------ | ------------------------------------- |
| **0**  | Scope Clarification         | Before PM         | Clarify ambiguous requests     | Answers or "use your judgment"        |
| **1**  | Requirements Validation     | After PM          | Approve task-description.md    | "APPROVED" or feedback                |
| **1.5**| Technical Clarification     | Before Architect  | Technical preferences          | Answers or "use your judgment"        |
| **2**  | Architecture Validation     | After Architect   | Approve plan.md                | "APPROVED" or feedback                |
| **3**  | QA Choice                   | After Development | Select QA agents               | tester/style/logic/reviewers/all/skip |
| **4**  | Blocker Report              | Any phase         | Report impediment              | Resolution choice                     |
| **5**  | Completion Confirmation     | Final phase       | Mark task COMPLETED            | "Complete" or "Adjust"                |
| **6**  | Scope Change                | Any phase         | Discovered work exceeds plan   | "Expand", "Split", or "Abort"         |

### Checkpoint Applicability by Strategy

| Strategy      | Scope | Requirements | Tech Clarify | Architecture | QA Choice | Blocker | Completion | Scope Change |
| ------------- | ----- | ------------ | ------------ | ------------ | --------- | ------- | ---------- | ------------ |
| FEATURE       | Yes   | Yes          | Yes          | Yes          | Yes       | Yes     | Yes        | Yes          |
| BUGFIX        | No    | No           | No           | No           | Yes       | Yes     | Yes        | Yes          |
| REFACTORING   | No    | No           | No           | Yes          | Yes       | Yes     | Yes        | Yes          |
| DOCUMENTATION | Yes   | Yes          | No           | No           | No        | Yes     | Yes        | Yes          |
| RESEARCH      | Yes   | No           | No           | No           | No        | Yes     | Yes        | No           |
| DEVOPS        | Yes   | Yes          | No           | Yes          | Yes       | Yes     | Yes        | Yes          |
| OPS           | Yes   | Yes          | No           | No           | Yes       | Yes     | Yes        | Yes          |
| CREATIVE      | Yes   | No           | No           | No           | Yes       | Yes     | Yes        | Yes          |
| CONTENT       | Yes   | Yes          | No           | No           | Yes       | Yes     | Yes        | Yes          |
| SOCIAL        | Yes   | Yes          | No           | No           | Yes       | Yes     | Yes        | Yes          |
| DESIGN        | Yes   | Yes          | No           | No           | Yes       | Yes     | Yes        | Yes          |

---

## Checkpoint 0: Scope Clarification

### Trigger Conditions

Ask if ANY of these apply:

- User request is vague or ambiguous
- Scope could reasonably be interpreted as small OR large
- Multiple valid interpretations exist
- Business context or priority is unclear
- Success criteria are not obvious

### Skip Conditions

Proceed WITHOUT asking if ALL apply:

- User request is extremely specific and unambiguous
- Task is a continuation of previous work with clear context
- User explicitly said "use your judgment" or "just do it"
- Task type is BUGFIX with clear error description

### Template

```markdown
---
SCOPE CLARIFICATION - TASK_[ID]
---

Before I create the requirements, I have a few clarifying questions:

1. **Scope**: [What should be included vs excluded?]
2. **Priority**: [What's the most critical outcome?]
3. **Constraints**: [Any deadlines, technical limits, or dependencies?]
4. **Success**: [How will you know this task is successful?]

---

## Please answer briefly, or say "use your judgment" to skip.
```

### Response Handling

| Response                    | Action                                                |
| --------------------------- | ----------------------------------------------------- |
| User provides answers       | Incorporate into context.md, proceed to PM            |
| "use your judgment"         | Proceed to PM with orchestrator's best interpretation |
| User asks counter-questions | Answer and re-present checkpoint if needed            |

---

## Checkpoint 1: Requirements Validation

### When to Present

After nitro-project-manager completes and creates `task-description.md`

### Template

```markdown
## Checkpoint: Requirements

**Status**: Project manager completed task description
**Deliverable**: task-tracking/TASK_[ID]/task-description.md

### Summary
- [Key requirement #1]
- [Key requirement #2]
- [Key requirement #3]

### Options
1. **Proceed** - Continue to architecture phase (nitro-software-architect)
2. **Adjust** - Modify requirements or scope
3. **Abort** - Cancel task (state preserved in task-tracking)

> Waiting for your decision...
```

### Response Handling

| Response          | Action                                                         |
| ----------------- | -------------------------------------------------------------- |
| "APPROVED"        | Proceed to Checkpoint 1.5 or Architect                         |
| Feedback provided | Re-invoke nitro-project-manager with feedback, re-present checkpoint |
| Questions asked   | Answer questions, re-present checkpoint                        |

---

## Checkpoint 1.5: Technical Clarification

### Trigger Conditions

Ask if ANY of these apply:

- Multiple valid architectural approaches exist (e.g., SQL vs NoSQL for storage)
- Key technology choices need user preference
- Integration scope is unclear (standalone vs integrated)
- Design tradeoffs have significant impact (performance vs simplicity)
- External service dependencies need confirmation

### Skip Conditions

Proceed WITHOUT asking if ALL apply:

- Codebase investigation shows clear established patterns
- Task is a direct extension of existing architecture
- User explicitly deferred technical decisions
- Task type is BUGFIX or simple REFACTORING

### Template

```markdown
---
TECHNICAL CLARIFICATION - TASK_[ID]
---

Before I create the architecture, I have a few technical questions:

1. **Approach**: [Pattern A vs Pattern B - which do you prefer?]
2. **Integration**: [Should this integrate with X or be standalone?]
3. **Tradeoff**: [Prioritize performance or simplicity?]
4. **Dependencies**: [Use existing library X or implement custom?]

---

## Please answer briefly, or say "use your judgment" to skip.
```

### Response Handling

| Response              | Action                                           |
| --------------------- | ------------------------------------------------ |
| User provides answers | Incorporate into architect prompt, proceed       |
| "use your judgment"   | Proceed with orchestrator's recommended approach |
| User needs more info  | Provide technical context, re-present checkpoint |

---

## Checkpoint 2: Architecture Validation

### When to Present

After nitro-software-architect completes and creates `plan.md`

### Template

```markdown
## Checkpoint: Architecture

**Status**: Software architect completed implementation plan
**Deliverable**: task-tracking/TASK_[ID]/plan.md

### Summary
- [Component/service design summary]
- [Key technical decisions]
- [N files to create/modify, B batches expected]

### Options
1. **Proceed** - Continue to development phase (nitro-team-leader)
2. **Adjust** - Modify architecture or technical approach
3. **Abort** - Cancel task (state preserved in task-tracking)

> Waiting for your decision...
```

### Response Handling

| Response          | Action                                                   |
| ----------------- | -------------------------------------------------------- |
| "APPROVED"        | Invoke nitro-team-leader MODE 1                                |
| Feedback provided | Re-invoke architect with feedback, re-present checkpoint |
| Questions asked   | Answer questions, re-present checkpoint                  |
| Request changes   | Update requirements if needed, re-invoke architect       |

---

## Checkpoint 3: QA Choice

### When to Present

After nitro-team-leader MODE 3 confirms all development complete

### Template

```markdown
## Checkpoint: Development Complete

**Status**: Team leader completed all [B] batches, integration passed
**Deliverable**: task-tracking/TASK_[ID]/MODE3-integration-report.md

### Summary
- [N] files created, [M] files modified across [B] batches
- Full build passes, all existing tests pass
- [B] commits created

### Options
1. **Proceed** - Continue to QA phase. Select reviewers:
   - `tester` - Senior tester (test suites)
   - `style` - Code style reviewer
   - `logic` - Code logic reviewer
   - `visual` - Visual/UI reviewer
   - `all` - All reviewers
   - `skip` - Skip QA entirely
   > **DESIGN tasks**: only `style` or `skip` are valid. `logic`, `tester`, and `visual` are not applicable to design document artifacts.
2. **Adjust** - Request changes to implementation
3. **Abort** - Cancel task (state preserved in task-tracking)

> Waiting for your decision...
```

### QA Invocation Patterns

```typescript
// Option: "tester" - single agent
Task({ subagent_type: 'nitro-senior-tester', prompt: `Test TASK_[ID]...` });

// Option: "style" - single agent
Task({ subagent_type: 'nitro-code-style-reviewer', prompt: `Review TASK_[ID] for patterns...` });

// Option: "logic" - single agent
Task({ subagent_type: 'nitro-code-logic-reviewer', prompt: `Review TASK_[ID] for completeness...` });

// Option: "reviewers" - parallel (BOTH in single message)
Task({ subagent_type: 'nitro-code-style-reviewer', prompt: `...` });
Task({ subagent_type: 'nitro-code-logic-reviewer', prompt: `...` });

// Option: "all" - parallel (THREE in single message)
Task({ subagent_type: 'nitro-senior-tester', prompt: `...` });
Task({ subagent_type: 'nitro-code-style-reviewer', prompt: `...` });
Task({ subagent_type: 'nitro-code-logic-reviewer', prompt: `...` });

// Option: "skip" - no QA agents invoked
// Proceed directly to workflow completion
```

### Response Handling

| Response    | Action                                      |
| ----------- | ------------------------------------------- |
| "tester"    | Invoke nitro-senior-tester only                   |
| "style"     | Invoke nitro-code-style-reviewer only             |
| "logic"     | Invoke nitro-code-logic-reviewer only             |
| "reviewers" | Invoke BOTH reviewers in parallel           |
| "all"       | Invoke ALL THREE QA agents in parallel      |
| "skip"      | Skip QA, proceed to git operations guidance |

---

## Checkpoint 4: Blocker Report

### When to Present

When any agent reports an impediment that prevents continued progress

### Template

```markdown
## Checkpoint: Blocker Detected

**Status**: [agent-name] encountered an impediment during [phase/batch]
**Deliverable**: task-tracking/TASK_[ID]/[relevant-report].md

### Summary
- Blocker: [specific issue description]
- [Phase/Batch] cannot proceed without resolution
- Potential solutions identified by [agent]

### Options
1. **Resolve** - [Specific resolution option, e.g., "Downgrade dependency to compatible version"]
2. **Alternative** - [Alternative approach, e.g., "Use alternative library with better compatibility"]
3. **Research** - Invoke nitro-researcher-expert to investigate further
4. **Abort** - Cancel task (state preserved in task-tracking)

> Waiting for your decision...
```

---

## Checkpoint 5: Completion Confirmation

### When to Present

Before marking task as COMPLETED, after all phases (dev + QA) are done

### Template

```markdown
## Checkpoint: Task Complete

**Status**: All phases completed successfully
**Deliverable**: task-tracking/TASK_[ID]/STATUS.md

### Summary
- Feature fully implemented: [brief description]
- QA: [summary of review findings]
- [N] total commits on branch task/TASK_[ID]-[description]

### Options
1. **Complete** - Mark task as COMPLETED, update registry
2. **Adjust** - Request final changes before completion

> Waiting for your decision...
```

---

## Checkpoint 6: Scope Change

### When to Present

When discovered work during development significantly exceeds the original plan

### Template

```markdown
## Checkpoint: Scope Change Detected

**Status**: During development, discovered additional work required
**Deliverable**: N/A

### Summary
- Original plan: [original scope summary]
- Discovery: [what additional work was found]
- Impact: [+N additional batches, affects src/X]

### Options
1. **Expand** - Accept expanded scope, add batches to current task
2. **Split** - Create separate task for discovered work, complete current task with workaround
3. **Abort** - Cancel task (state preserved in task-tracking)

> Waiting for your decision...
```

---

## User Response Interpretation

### Approval (proceed to next phase)
Any of these responses mean "proceed":
- `APPROVED`
- `proceed`
- `go`
- `yes`
- `looks good`
- `LGTM`
- `ok`
- `continue`
- `next`
- `go ahead`

### Feedback (incorporate and re-present)
Any response that includes specific changes, questions, or concerns:
- "Change X to Y" -> modify deliverable, re-present checkpoint
- "What about Z?" -> address question, re-present checkpoint
- "Add requirement for..." -> update deliverable, re-present checkpoint
- "I prefer option B instead" -> adjust approach, re-present checkpoint

### Abort (stop and preserve)
- `abort`
- `cancel`
- `stop`
- `nevermind`

**On abort**: Update STATUS.md to CANCELLED, update registry.md, preserve all files.

---

## Error Handling

### Validation Rejection Handling

When user provides feedback instead of "APPROVED":

```
1. Extract specific feedback points from user response
2. Re-invoke the original agent with:
   - Original context
   - Previous output reference
   - User feedback as revision instructions
3. Agent produces revised output
4. Re-present validation checkpoint with new output
5. Repeat until "APPROVED" or user requests different approach
```

### Verification Failure Handling

When nitro-team-leader MODE 2 rejects a batch:

```
1. Extract rejection reasons from nitro-team-leader response
2. Re-invoke developer with:
   - Original task assignment
   - List of issues found
   - Clear fix instructions
3. Developer produces fixes
4. Re-invoke nitro-team-leader MODE 2 for re-verification
5. Repeat until batch passes verification
```

### Commit Hook Failure Handling

When git commit fails due to pre-commit hooks:

```markdown
---
Pre-commit hook failed: [specific error message]
---

Please choose how to proceed:

1. **Fix Issue** - I'll fix the issue if it's related to current work
   (Use for: lint errors, type errors, commit message format issues)

2. **Bypass Hook** - Commit with --no-verify flag
   (Use for: Unrelated errors in other files, blocking issues outside scope)

3. **Stop & Report** - Mark as blocker and escalate
   (Use for: Critical infrastructure issues, complex errors)

## Which option would you like? (1/2/3)
```

**Option Handling**:

| Choice            | Action                                                              |
| ----------------- | ------------------------------------------------------------------- |
| 1 (Fix Issue)     | Identify and fix the specific issue, retry commit                   |
| 2 (Bypass Hook)   | Execute `git commit --no-verify -m "message"`, document in tasks.md |
| 3 (Stop & Report) | Mark task BLOCKED, create detailed error report                     |

**Critical Rules**:

- NEVER automatically bypass hooks with --no-verify
- NEVER automatically fix issues without user consent
- NEVER proceed with alternative approaches without user decision
- ALWAYS present the 3 options and wait for user choice
- Document chosen option in task tracking if option 2 or 3 selected

---

## Checkpoint Behavior Rules

1. **Always wait** - Present the checkpoint and stop. Do not assume approval.
2. **One at a time** - Never combine multiple checkpoints into one.
3. **Be specific** - The "Adjust" option should name what can be changed.
4. **Link deliverables** - Always reference the file that was just created.
5. **Summarize concisely** - 2-3 bullet points maximum in the summary.
6. **Preserve state on abort** - Never delete work when a task is cancelled.
7. **Re-present after adjustment** - After incorporating feedback, show the checkpoint again with updated summary.
8. **Track in STATUS.md** - Update the task status file at every checkpoint transition.

---

## Checkpoint Flow Summary

```
New Task Start
     |
     v
[Checkpoint 0: Scope Clarification]  <-- Optional
     |
     v
  Project Manager
     |
     v
[Checkpoint 1: Requirements Validation]  <-- Required
     |
     v
[Checkpoint 1.5: Technical Clarification]  <-- Optional
     |
     v
  Software Architect
     |
     v
[Checkpoint 2: Architecture Validation]  <-- Required
     |
     v
  Team-Leader MODE 1 -> Development Loop
     |
     v
  Team-Leader MODE 3
     |
     v
[Checkpoint 3: QA Choice]  <-- Required
     |
     v
  QA Agents (if selected)
     |
     v
[Checkpoint 5: Completion Confirmation]  <-- Required
     |
     v
  Workflow Complete
```

**Cross-cutting checkpoints** (can occur at any phase):
- Checkpoint 4: Blocker Report
- Checkpoint 6: Scope Change

---

## Integration with Other References

- **SKILL.md**: Checkpoint logic embedded in core orchestration loop
- **strategies.md**: Different strategies may skip certain checkpoints
- **agent-catalog.md**: QA agents invoked from Checkpoint 3
- **team-leader-modes.md**: MODE transitions trigger checkpoints
- **git-standards.md**: Hook failure protocol at commit time
