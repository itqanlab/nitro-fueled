# Run — Unified Task Execution

Start a single task or the full Supervisor batch loop. Routes intelligently based on whether a task ID is provided.

## Usage

```
/run                        # Batch mode — process all unblocked tasks via auto-pilot
/run TASK_2026_XXX          # Single-task mode — orchestrate one task inline
```

## Routing Logic

### Step 1: Parse Arguments

Parse $ARGUMENTS:
- Empty → batch mode
- Matches `/^TASK_\d{4}_\d{3}$/` → single-task mode

### Step 2: Route

**Batch mode** (no arguments):

Load and execute `/auto-pilot`. This starts the Supervisor loop which reads the task backlog, spawns Build Workers and Review Workers, and monitors until all tasks are complete or blocked.

**Single-task mode** (TASK_ID provided):

Load and execute `/orchestrate $ARGUMENTS`. This runs the full PM → Architect → Dev → QA pipeline for the specified task in the current session.

## Notes

- The existing `/auto-pilot` and `/orchestrate` commands remain available as power-user direct access.
- This command is a thin router — all logic lives in the underlying skills.
- For batch options (--dry-run, --concurrency, --interval), use `/auto-pilot` directly.
