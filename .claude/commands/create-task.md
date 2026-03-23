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
  - **Acceptance Criteria**: What "done" looks like (list items)

**If no argument provided:**
- Prompt for ALL fields including Description

**If the user says "use defaults" for any field:**
- Priority: P2-Medium
- Complexity: Medium
- Dependencies: None

**Important**: Extract valid values for Type, Priority, and Complexity from the template file read in Step 1. Do not hardcode these values — the template is the single source of truth.

### Step 4: Create Task Folder and File

1. Create directory: `task-tracking/TASK_YYYY_NNN/`
2. Generate `task.md` by populating the template structure with the user's answers
3. Strip HTML guidance comments from the output (they're for template reference, not individual tasks)
4. Write to: `task-tracking/TASK_YYYY_NNN/task.md`

### Step 5: Update Registry

Add a new row to `task-tracking/registry.md`:

```
| TASK_YYYY_NNN | CREATED | [Type] | [Title or brief description] | YYYY-MM-DD |
```

Registry columns: **Task ID** | **Status** | **Type** | **Description** | **Created**

### Step 6: Display Summary

```
Task created successfully.

  Task ID:  TASK_YYYY_NNN
  Folder:   task-tracking/TASK_YYYY_NNN/
  Type:     [Type]
  Priority: [Priority]

  Next: Run /orchestrate TASK_YYYY_NNN to begin the workflow.
```

## Important Rules

1. **ALWAYS read `task-template.md` first** — never hardcode template structure
2. **ALWAYS read `registry.md` to determine the next ID** — never guess or assume
3. **Registry row format MUST match**: Task ID | Status | Type | Description | Created
4. **Enum values MUST match the template exactly** — extract Type, Priority, and Complexity values from `task-template.md`, never hardcode them
5. **Pre-flight check** — before proceeding, verify that `task-tracking/` directory, `task-tracking/registry.md`, and `task-tracking/task-template.md` all exist. If any are missing, tell the user to run `/initialize-workspace` first
6. **Do NOT create context.md** — that's the orchestrator's job when `/orchestrate` runs

## References

- Task template: `task-tracking/task-template.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Template guide: `docs/task-template-guide.md`
