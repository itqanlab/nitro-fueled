# Status — Project Status Report

Show compact project status by reading `task-tracking/registry.md` only.

## Usage

```
/nitro-status
```

## Execution

**IMPORTANT: Do NOT read any individual task.md files. Read only `task-tracking/registry.md`.**

1. Read `task-tracking/registry.md`
2. Parse the table to extract all task information
3. Calculate counts by status: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, BLOCKED, COMPLETE, CANCELLED, FAILED
4. Generate a table of all non-complete tasks (excluding COMPLETE and CANCELLED)
5. Identify "What's Next" — list all CREATED tasks as ready to start

## Output Format

```
# Project Status
Generated: {timestamp}

## Summary
Total: {total}
- COMPLETE: {count}
- IN_REVIEW: {count}
- IMPLEMENTED: {count}
- IN_PROGRESS: {count}
- CREATED: {count}
- BLOCKED: {count}
- FAILED: {count}
- CANCELLED: {count}

## Active Tasks
| Task ID | Status | Type | Description |
|---------|--------|------|-------------|
| ...     | ...    | ...  | ...         |

## What's Next
Ready to start (CREATED tasks):
- TASK_2026_XXX: description
- TASK_2026_YYY: description
```

If there are BLOCKED or FAILED tasks, list them separately:

```
## Needs Attention
Blocked Tasks:
- TASK_2026_XXX: description

Failed Tasks:
- TASK_2026_YYY: description
```

## Notes

- This command is intentionally lightweight — it avoids context bloat by not reading individual task files
- Dependencies are not displayed because they are not tracked in the registry; for dependency analysis, use individual task files or CLI tools
- CREATED tasks are shown as "ready to start" assuming their dependencies are met (dependency resolution requires reading individual task.md files)
