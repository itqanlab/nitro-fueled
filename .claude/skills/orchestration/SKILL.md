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

| Task Type     | Strategy Flow                                      |
| ------------- | -------------------------------------------------- |
| FEATURE       | PM -> [Research] -> Architect -> Team-Leader -> QA |
| BUGFIX        | [Research] -> Team-Leader -> QA                    |
| REFACTORING   | Architect -> Team-Leader -> QA                     |
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
if ($ARGUMENTS matches /^TASK_2026_\d{3}$/)
    -> CONTINUATION mode (resume existing task)
else
    -> NEW_TASK mode (create new task)
```

### NEW_TASK: Initialization

1. **Read Registry**: `Read(task-tracking/registry.md)` - find highest TASK_ID, increment
2. **Create Task Folder**: `mkdir task-tracking/TASK_[ID]`
3. **Create Context**: `Write(task-tracking/TASK_[ID]/context.md)` with user intent, strategy
4. **Announce**: Present task ID, type, complexity, planned agent sequence

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
| [review-lessons/](../../review-lessons/)                | Before dev + after reviews   | Accumulated review findings by role (replaces anti-patterns.md) |

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

After the QA cycle (reviews + fixes + final commit), the orchestrator MUST complete ALL of these bookkeeping steps BEFORE the final commit. The completion report is the #1 most-skipped deliverable — if you skip it, the task is considered INCOMPLETE regardless of code quality.

**Commit order:**
1. First commit: implementation code (after dev, before QA)
2. Second commit: QA fixes
3. Third commit: completion bookkeeping (report + registry + plan update)

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

### 2. Update Registry

Update `task-tracking/registry.md` — set status to COMPLETE.

> In Supervisor mode, the Review Worker sets the status to COMPLETE.
> In interactive mode, the orchestrator sets this status.

### 3. Update Plan

Update `task-tracking/plan.md`:

1. **Update task status** in the relevant Phase's Task Map table — set this task's status to COMPLETE.
2. **Check phase completion**: If ALL tasks in the phase are now COMPLETE or CANCELLED, update the phase status to COMPLETE and check all milestone boxes.
3. **Update Current Focus**: If the active phase just completed, advance "Active Phase" to the next incomplete phase and update "Next Priorities" accordingly.

### 4. Final Commit

Commit all bookkeeping changes with message: `docs: add TASK_[ID] completion bookkeeping`

---

## Exit Gate (MANDATORY)

Before exiting the orchestration session, verify ALL applicable checks pass.
The Exit Gate ensures workers leave the task in a clean, verifiable state
that the Supervisor can react to.

### Build Worker Exit Gate

Run these checks after implementation is committed and registry is updated:

| Check | Command | Expected |
|-------|---------|----------|
| tasks.md exists | Glob task-tracking/TASK_[ID]/ for tasks.md | File found |
| tasks.md has content | Grep "Task" in tasks.md | At least one `### Task N.N:` heading present |
| All sub-tasks COMPLETE | Grep "COMPLETE" in tasks.md | All tasks show COMPLETE |
| Implementation committed | Check git status | No unstaged implementation files |
| Registry updated | Grep task ID in registry.md | Status shows IMPLEMENTED |
| Registry committed | Check git status | registry.md is committed |

If any check fails, fix it before exiting. Do not exit with uncommitted
work or an un-updated registry.

**If tasks.md is missing**: Create it by listing all implementation steps you completed as task entries with `**Status**: COMPLETE`. See the tasks.md format under `## MODE 1: DECOMPOSITION` > `### Expected Output` in `.claude/skills/orchestration/references/team-leader-modes.md`. If that file is unavailable, use this minimal structure:

```markdown
# Development Tasks - TASK_[ID]

## Batch 1: [Description] - COMPLETE

**Developer**: systems-developer

### Task 1.1: [What you implemented]

**File**: [path/to/file]
**Status**: COMPLETE
```

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
