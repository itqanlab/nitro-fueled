# Create — Unified Task Creation

Create a new task. Routes to the Planner for discussion-based creation or the quick form for immediate scaffolding.

## Usage

```
/nitro-create [description]           # Planner mode — discussion-based task creation
/nitro-create --quick [description]   # Quick mode — form-based task scaffolding
```

## Routing Logic

### Step 1: Parse Arguments

Parse $ARGUMENTS:
- Contains `--quick` anywhere in the string → quick mode
  - Strip all occurrences of `--quick` from $ARGUMENTS, then trim whitespace from the result
  - The trimmed remainder is the description (may be empty — `/nitro-create-task` will prompt interactively)
- No `--quick` present → Planner mode (pass full $ARGUMENTS as intent, trimmed)

### Step 2: Route

**Planner mode** (no `--quick` flag):

Load and execute `/nitro-plan $ARGUMENTS`. This starts a Planner conversation to discuss requirements, scope the work, and create well-formed tasks with Product Owner approval.

**Quick mode** (`--quick` flag present):

Load and execute `/nitro-create-task [description]`. This invokes the form-based task scaffold which prompts for metadata fields (Type, Priority, Complexity, Acceptance Criteria) and writes the task.md immediately.

## Notes

- The existing `/nitro-plan` and `/nitro-create-task` commands remain available as power-user direct access.
- This command is a thin router — all logic lives in the underlying commands.
- Use Planner mode when scope is uncertain or the work needs discussion.
- Use quick mode when requirements are clear and you want to bypass the planning conversation.
