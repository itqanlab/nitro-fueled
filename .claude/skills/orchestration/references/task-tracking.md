# Task Tracking Reference

This reference documents the task management system used by the orchestration workflow, including ID formats, folder structures, registry management, and continuation mode detection.

---

## Task ID Format

```
TASK_YYYY_NNN
```

| Component | Description                     | Example       |
| --------- | ------------------------------- | ------------- |
| `TASK_`   | Fixed prefix                    | TASK\_        |
| `YYYY`    | Year                            | 2026          |
| `_`       | Separator                       | \_            |
| `NNN`     | Sequential number (zero-padded) | 001, 042, 110 |

**Examples**: `TASK_2026_001`, `TASK_2026_042`, `TASK_2026_110`

---

## Folder Structure

```
task-tracking/
  registry.md                    # Master task registry (all tasks)
  task-template.md               # Canonical task template (reference, not inside TASK_*)
  TASK_[ID]/
    task.md                      # Task definition (user-created or /create-task output)
    context.md                   # User intent, conversation summary
    task-description.md          # Requirements (PM output)
    implementation-plan.md       # Architecture design (Architect output)
    tasks.md                     # Atomic task breakdown (Team-leader output)
    test-report.md               # Testing results (Tester output)
    code-style-review.md         # Style review (Code-style-reviewer output)
    code-logic-review.md         # Logic review (Code-logic-reviewer output)
    visual-review.md             # Visual review (Visual-reviewer output)
    screenshots/                 # Visual testing screenshots
      baseline.png               # Baseline screenshot
      mobile.png                 # Mobile viewport
      tablet.png                 # Tablet viewport
      desktop.png                # Desktop viewport
      *.png                      # Additional state screenshots
    future-enhancements.md       # Future work (Modernization-detector output)
    visual-design-specification.md # Visual design (UI/UX Designer output, optional)
```

---

## Registry Management

### Registry Location

```
task-tracking/registry.md
```

### Reading the Registry

At workflow start, read registry to:

1. Get next available task ID
2. Check if task already exists (for continuation)
3. Understand project task history

```bash
Read(task-tracking/registry.md)
```

### Registry Format

```markdown
# Task Registry

| Task ID       | Status      | Type          | Description           | Created    |
| ------------- | ----------- | ------------- | --------------------- | ---------- |
| TASK_2026_008 | COMPLETE    | FEATURE       | Project settings panel| 2026-01-15 |
| TASK_2026_009 | IN_PROGRESS | BUGFIX        | Fix sidebar collapse  | 2026-01-18 |
| TASK_2026_010 | IN_PROGRESS | DOCUMENTATION | Skill conversion      | 2026-01-20 |
```

### Generating New Task ID

1. Read registry.md
2. Find highest NNN value for current year
3. Increment by 1
4. Format with zero-padding: `TASK_YYYY_NNN`

**Example**: If highest is TASK_2026_009, next is TASK_2026_010

### Updating Registry

After creating new task:

1. Add row with task info
2. Set status to CREATED (transitions to IN_PROGRESS when orchestration begins)
3. Include task type and brief description

---

## Document Templates

### context.md Template

Created during Phase 0 initialization:

```markdown
# Task Context - TASK\_[ID]

## User Request

[Exact user request text]

## Task Type

[FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE]

## Complexity Assessment

[Simple | Medium | Complex]

## Strategy Selected

[Strategy name from strategies.md]

## Conversation Summary

[Key decisions, clarifications, and context from conversation]

## Related Tasks

- [TASK_YYYY_NNN]: [relationship]

## Created

[ISO date]
```

### Document Ownership

| Document               | Created By             | Contains                          |
| ---------------------- | ---------------------- | --------------------------------- |
| context.md             | Orchestrator (Phase 0) | User intent, task metadata        |
| task-description.md    | project-manager        | Requirements, acceptance criteria |
| implementation-plan.md | software-architect     | Architecture, file specifications |
| tasks.md               | team-leader (MODE 1)   | Batched atomic tasks              |
| test-report.md         | senior-tester          | Test results, coverage            |
| code-style-review.md   | code-style-reviewer    | Pattern compliance findings       |
| code-logic-review.md   | code-logic-reviewer    | Business logic findings           |
| visual-review.md       | visual-reviewer        | UI/UX visual testing results      |
| future-enhancements.md | modernization-detector | Future improvement opportunities  |

---

## Continuation Mode

### Detecting Continuation Request

```
/orchestrate TASK_2026_XXX    -> Continuation mode
/orchestrate [description]    -> New task mode
```

### Phase Detection

When continuing a task, read existing documents to determine current phase:

```bash
Glob(task-tracking/TASK_[ID]/*.md)
```

### Phase Detection Table

| Documents Present                | Phase Status           | Next Action                           |
| -------------------------------- | ---------------------- | ------------------------------------- |
| No context.md                    | **Invalid**            | ERROR: Task doesn't exist             |
| context.md only                  | Initialized            | Invoke project-manager                |
| + task-description.md            | PM done                | User validate OR next agent           |
| + visual-design-specification.md | Designer done          | Invoke software-architect             |
| + implementation-plan.md         | Architect done         | User validate OR team-leader MODE 1   |
| + tasks.md (all PENDING)         | Decomposition done     | team-leader MODE 2 (first assignment) |
| + tasks.md (has IN PROGRESS)     | Dev in progress        | team-leader MODE 2 (verify + next)    |
| + tasks.md (has IMPLEMENTED)     | Dev done, await verify | team-leader MODE 2 (verify + commit)  |
| + tasks.md (all COMPLETE)        | Dev complete           | team-leader MODE 3 OR QA choice       |
| + test-report.md                 | Tester complete        | Continue QA or complete               |
| + code-style-review.md           | Style reviewed         | Continue QA or complete               |
| + code-logic-review.md           | Logic reviewed         | Continue QA or complete               |
| + visual-review.md               | Visual reviewed        | Complete workflow                     |
| + future-enhancements.md         | All done               | Workflow already complete             |

### Continuation Logic

```
1. Parse TASK_ID from user input
2. Check registry.md for task status
3. Glob task folder for existing documents
4. Match against phase detection table
5. Resume at detected phase
```

### Example Continuation

```
User: /orchestrate TASK_2026_008

Orchestrator:
1. Read registry -> TASK_2026_008 exists, status IN_PROGRESS
2. Glob task-tracking/TASK_2026_008/*.md
3. Found: context.md, task-description.md, implementation-plan.md, tasks.md
4. Check tasks.md -> has IN PROGRESS tasks
5. Detected phase: "Dev in progress"
6. Action: Invoke team-leader MODE 2 (verify + next)
```

---

## Task Status Values

### Registry Status

| Status      | Meaning                            |
| ----------- | ---------------------------------- |
| CREATED     | Task defined, not yet started      |
| IN_PROGRESS | Task actively being worked         |
| COMPLETE    | All phases done, workflow finished |
| BLOCKED     | Waiting on external dependency     |
| CANCELLED   | Task abandoned                     |

### Task Status (in tasks.md)

| Status      | Meaning                              |
| ----------- | ------------------------------------ |
| PENDING     | Not yet assigned                     |
| IN PROGRESS | Developer working                    |
| IMPLEMENTED | Code complete, awaiting verification |
| COMPLETE    | Verified and committed               |
| FAILED      | Verification failed                  |

---

## File Path Conventions

**CRITICAL**: Use project-root-relative paths for all file operations.

```
Correct:  task-tracking/TASK_2026_010/context.md
Correct:  libs/main-process/settings/src/lib/settings.service.ts
Incorrect: /absolute/path/to/file.ts (avoid absolute paths in task documents)
```

---

## Integration with Other References

- **SKILL.md**: Phase 0 initialization creates context.md
- **strategies.md**: Determines which documents are created for each workflow type
- **team-leader-modes.md**: MODE 1 creates tasks.md
- **agent-catalog.md**: Each agent outputs specific document(s)
- **checkpoints.md**: Validation points between document creation phases
