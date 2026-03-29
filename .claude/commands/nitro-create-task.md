# Create Task

Scaffold a new task folder with a pre-filled `task.md` from the canonical template.

## Usage

```
/nitro-create-task                        # Interactive — prompts for all fields
/nitro-create-task [brief description]    # Pre-fills description, prompts for the rest
```

## CRITICAL: No Approval Step

**Do NOT ask the user to confirm or approve before creating the task.** Gather the information, write the files immediately, then show the summary. The task can always be edited after creation. Never present gathered info with "Does this look right?" or "Any adjustments?" before writing — just create it.

## Execution Steps

### Step 1: Read Template

Read `task-tracking/task-template.md` as the source of truth for task structure. This file defines all fields, valid values, and inline guidance. **Never hardcode template content — always read the file.**

### Step 2: Determine Task ID

Run this command to find the highest existing task folder:

```bash
ls task-tracking/ | grep -E '^TASK_[0-9]{4}_[0-9]{3}$' | sort | tail -1
```

Increment the `NNN` portion by 1, zero-pad to 3 digits, use the current year for `YYYY`.
Format: `TASK_YYYY_NNN` (e.g., `TASK_2026_116`). If no folders exist, start at `001`.

**Do NOT read `registry.md` for the next ID — it may be stale.** The folder scan is always authoritative.

**Collision guard:** Before creating any folder or file, verify the path does not already exist. If `task-tracking/TASK_YYYY_NNN/` already exists, **stop immediately** — do NOT overwrite or delete it. Increment NNN and re-check until a free slot is found. Never destroy existing task data.

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

### Step 3c: Pre-Write Sizing Validation

**Before writing any files**, validate the gathered task information against sizing rules. Read `task-tracking/sizing-rules.md` and check:

| Check | Condition |
|-------|-----------|
| Description length | > 150 lines |
| Acceptance criteria | > 5 groups |
| File scope | > 7 files listed in File Scope |
| Complexity + layers | Complexity is "Complex" AND description mentions multiple architectural layers |
| Unrelated areas | Multiple unrelated functional areas detected (use judgment) |

When a count is indeterminate (e.g., ambiguous description structure), skip that check — do not block based on uncertainty alone.

**If any check fails — auto-split:**

Do NOT ask the user whether to split. Do NOT create the oversized task. Instead, **automatically split** the work into properly-sized tasks:

1. Analyze the task and determine the natural split boundaries (by functional area, by type, by layer, etc.)
2. Log: `[AUTO-SPLIT] — Task too large for a single worker. Splitting into N tasks.`
3. Create N separate task folders and task.md files, each within sizing limits
4. Each split task gets:
   - Its own sequential Task ID (TASK_YYYY_NNN, NNN+1, NNN+2, ...)
   - Dependencies on prior split tasks where order matters
   - Parallelism analysis reflecting the split
   - A reference back to the original intent (e.g., "Part 1 of N — original request: [title]")
5. Display a summary of all created tasks

**Only skip auto-split if the user explicitly says** words like "force", "create as-is", "don't split", or "single task". In that case, create it with a sizing warning.

**If all checks pass:** proceed to Step 4.

### Step 4: Create Task Folder and File

1. Create directory: `task-tracking/TASK_YYYY_NNN/`
2. Generate `task.md` by populating the template structure with the user's answers
3. Strip HTML guidance comments from the output (they're for template reference, not individual tasks)
4. Write to: `task-tracking/TASK_YYYY_NNN/task.md`

### Step 5: Write Status File

Write `task-tracking/TASK_YYYY_NNN/status` with the single word `CREATED` (no trailing newline, no extra whitespace).

> The registry is no longer appended to during task creation. It is regenerated on demand by `nitro-fueled status` and `/nitro-project-status`. The Task ID for the new task is still determined by scanning `registry.md` for the highest existing NNN in Step 2 — that read remains valid.
>
> **Canonical registry row format** (for reference when regenerating): `Task ID | Status | Type | Description | Priority | Dependencies | Created | Model`
> - Priority: the task's Priority field value (e.g., `P1-High`)
> - Dependencies: comma-separated Task IDs (e.g., `TASK_2026_052, TASK_2026_051`), or `None`
> - COMPLETE/CANCELLED rows use `—` for both Priority and Dependencies
> - Legacy rows (pre-TASK_2026_064) missing Priority/Dependencies columns are handled by the Supervisor's Step 2 fallback (treated as P2-Medium, no deps).

### Step 5b: Commit Task Creation

After writing the status file, commit the new task folder:

```bash
git add task-tracking/TASK_YYYY_NNN/
git commit -m "$(cat <<'EOF'
docs(tasks): create TASK_YYYY_NNN — {title from Description field}
EOF
)"
# Note: pass the commit message via HEREDOC to prevent shell expansion of title metacharacters
```

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

**6b.** *(Removed — sizing validation now runs in Step 3c before writing any files.)*

### Step 7: Display Summary

```
Task created successfully.

  Task ID:  TASK_YYYY_NNN
  Folder:   task-tracking/TASK_YYYY_NNN/
  Type:     [Type]
  Priority: [Priority]
  Status:   CREATED (ready for auto-pilot or /orchestrate)

  Next steps:
  - Run /nitro-orchestrate TASK_YYYY_NNN to start this task manually
  - Or add more tasks and run /nitro-auto-pilot to process the backlog
  - Or run /nitro-auto-pilot --dry-run to see the execution plan
```

## Important Rules

1. **ALWAYS read `task-template.md` first** — never hardcode template structure
2. **ALWAYS scan task folders to determine the next ID** — never read registry.md for this, it may be stale
3. **Write status file immediately after creating the task folder**: `task-tracking/TASK_YYYY_NNN/status` containing `CREATED` (no trailing newline)
4. **Enum values MUST match the template exactly** — extract Type, Priority, and Complexity values from `task-template.md`, never hardcode them
5. **Pre-flight check** — before proceeding, verify that `task-tracking/` directory, `task-tracking/registry.md`, and `task-tracking/task-template.md` all exist. If any are missing, tell the user to run `/nitro-initialize-workspace` first
6. **Do NOT create context.md** — that's the orchestrator's job when `/orchestrate` runs

## References

- Task template: `task-tracking/task-template.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Template guide: `docs/task-template-guide.md`
