# Create Task

Scaffold a new task folder with a pre-filled `task.md` from the canonical template.

## Usage

```
/create-task                        # Interactive — prompts for all fields
/create-task [brief description]    # Pre-fills description, prompts for the rest
```

## Execution Steps

### Step 1: Read Template

Read `task-tracking/task-template.md` as the source of truth for task structure. This file defines all fields, valid values, and inline guidance. **Never hardcode template content — always read the file.**

### Step 2: Determine Task ID

1. Read `task-tracking/registry.md`
2. Find the highest `NNN` value among existing `TASK_YYYY_NNN` entries for the current year
3. Increment by 1, zero-pad to 3 digits
4. Format: `TASK_YYYY_NNN` (e.g., `TASK_2026_001`)
5. If no entries exist for the current year, start at `001`

### Step 3: Gather Task Information

**If description was provided as argument:**
- Pre-fill the Description field with the argument text
- Prompt the user for remaining fields:
  - **Title**: Short name for the task
  - **Type**: Show valid values from the template's Metadata table
  - **Priority**: Show valid values from the template's Metadata table
  - **Complexity**: Show valid values from the template's Metadata table
  - **Dependencies**: Task IDs this depends on, or "None"
  - **Parallelism**: Can this run in parallel with other tasks, or must it run alone? Analyze file scope overlap with any other CREATED tasks in the registry to determine this. If the task touches files that are also in scope for other CREATED tasks, mark it as "no parallel" and list which tasks conflict. Always include a `## Parallelism` section in the task.md.
  - **Model**: Which Claude model to use (optional — default: `default`). Show valid values from the template.
  - **Acceptance Criteria**: What "done" looks like (list items)

**If no argument provided:**
- Prompt for ALL fields including Description

**If the user says "use defaults" for any field:**
- Priority: P2-Medium
- Complexity: Medium
- Dependencies: None
- Model: default

**Important**: Extract valid values for Type, Priority, and Complexity from the template file read in Step 1. Do not hardcode these values — the template is the single source of truth.

### Step 3b: Dependency and Parallelism Analysis

Before writing the task file, analyze how this task relates to other CREATED tasks in the registry:

1. **Read the File Scope** of the new task (files it will modify)
2. **Read File Scope sections** of all other CREATED tasks in `registry.md`
3. **Identify conflicts**: any file appearing in both this task's scope and another task's scope = a conflict
4. **Determine safe execution wave**: which tasks must complete before this one can start?

Output a `## Parallelism` section in the task.md with:
- `✅ Can run in parallel` — if no file scope conflicts exist
- `⚠️ MUST RUN ALONE` — if the blast radius is large enough that any concurrent task risks conflicts (e.g., mass renames, schema changes, cross-cutting refactors)
- `🚫 Do NOT run in parallel with TASK_X` — list specific conflicting tasks
- Suggested execution wave (e.g., "Wave 2, after TASK_052 completes")

This analysis is **mandatory** — every task must have a Parallelism section.

### Step 4: Create Task Folder and File

1. Create directory: `task-tracking/TASK_YYYY_NNN/`
2. Generate `task.md` by populating the template structure with the user's answers
3. Strip HTML guidance comments from the output (they're for template reference, not individual tasks)
4. Write to: `task-tracking/TASK_YYYY_NNN/task.md`

### Step 5: Write Status File

Write `task-tracking/TASK_YYYY_NNN/status` with the single word `CREATED` (no trailing newline, no extra whitespace).

> The registry is no longer appended to during task creation. It is regenerated on demand by `nitro-fueled status` and `/project-status`. The Task ID for the new task is still determined by scanning `registry.md` for the highest existing NNN in Step 2 — that read remains valid.

### Step 6: Post-Creation Validation

Run two sequential checks before displaying the summary. All warnings are **non-blocking** — display them and continue to Step 7.

**6a. Validate Auto-Pilot Readiness**

Verify the task is ready for auto-pilot pickup:

| Check | Requirement | If Missing |
|-------|------------|------------|
| Type | Must be a valid enum value | Prompt user to pick one |
| Priority | Must be a valid enum value | Default to P2-Medium |
| Description | At least 2 sentences | Warn user: "Description may be too brief for the PM agent to generate requirements autonomously. Consider adding more detail." |
| Acceptance Criteria | At least 1 criterion | Warn user: "No acceptance criteria — QA will have nothing to verify against." |

These checks ensure the task won't be skipped by auto-pilot's Step 2b validation.

**6b. Validate Task Sizing**

Read `task-tracking/sizing-rules.md` and validate the task against the hard limits. If any limit is exceeded, display a non-blocking warning:

```
[SIZING WARNING] — This task may be too large for a single worker session:
  - [specific violation 1]
  - [specific violation 2]

  See task-tracking/sizing-rules.md for guidance on splitting.
  You can proceed as-is or split the task into smaller pieces.
```

Checks to run against the written task.md:

| Check | Condition | Warning Message |
|-------|-----------|-----------------|
| Description length | > 150 lines | "Description exceeds 150 lines (actual: N lines)" |
| Acceptance criteria | > 5 groups | "More than 5 acceptance criteria groups (actual: N)" |
| File scope | > 7 files listed in File Scope | "File Scope lists more than 7 files (actual: N)" |
| Complexity + layers | Complexity is "Complex" AND description mentions multiple architectural layers | "Complex task spanning multiple architectural layers — consider splitting" |
| Unrelated areas | Multiple unrelated functional areas detected (use judgment) | "Task appears to span multiple unrelated functional areas" |

When a count is indeterminate (e.g., ambiguous description structure), skip that check — do not warn based on uncertainty alone.

### Step 7: Display Summary

```
Task created successfully.

  Task ID:  TASK_YYYY_NNN
  Folder:   task-tracking/TASK_YYYY_NNN/
  Type:     [Type]
  Priority: [Priority]
  Status:   CREATED (ready for auto-pilot or /orchestrate)

  Next steps:
  - Run /orchestrate TASK_YYYY_NNN to start this task manually
  - Or add more tasks and run /auto-pilot to process the backlog
  - Or run /auto-pilot --dry-run to see the execution plan
```

## Important Rules

1. **ALWAYS read `task-template.md` first** — never hardcode template structure
2. **ALWAYS read `registry.md` to determine the next ID** — never guess or assume
3. **Write status file immediately after creating the task folder**: `task-tracking/TASK_YYYY_NNN/status` containing `CREATED` (no trailing newline)
4. **Enum values MUST match the template exactly** — extract Type, Priority, and Complexity values from `task-template.md`, never hardcode them
5. **Pre-flight check** — before proceeding, verify that `task-tracking/` directory, `task-tracking/registry.md`, and `task-tracking/task-template.md` all exist. If any are missing, tell the user to run `/initialize-workspace` first
6. **Do NOT create context.md** — that's the orchestrator's job when `/orchestrate` runs

## References

- Task template: `task-tracking/task-template.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Template guide: `docs/task-template-guide.md`
