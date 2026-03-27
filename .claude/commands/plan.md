# Plan -- Strategic Planning with the Planner Agent

Start a planning conversation with the Planner agent. Discuss requirements,
create well-scoped tasks, manage the roadmap, and track progress.

## Usage

```
/plan [what you want]          # Start planning a new feature or body of work
/plan status                   # Get a progress assessment of the current plan
/plan reprioritize             # Review and reorder the backlog
/plan                          # Resume current planning context or start fresh
```

## Execution Steps

### Step 1: Load Planner Agent

Read `.claude/agents/nitro-nitro-planner.md` -- this contains the full Planner agent
definition, interaction protocols, task creation rules, and plan management rules.

### Step 2: Parse Arguments

Parse $ARGUMENTS using exact full-string matching:
- $ARGUMENTS is exactly `status` (and nothing else) -> status mode
- $ARGUMENTS is exactly `reprioritize` (and nothing else) -> reprioritize mode
- Any other non-empty text -> new planning conversation with that text as intent
- Empty -> detect mode (onboarding if no plan.md, otherwise resume)

### Step 3: Pre-Flight Checks

3a. Verify `task-tracking/` directory exists.
    If missing: ERROR -- "Workspace not initialized. Run /initialize-workspace first."

3b. Verify `task-tracking/registry.md` exists.
    If missing: ERROR -- "Registry not found. Run /initialize-workspace first."

3c. Verify `task-tracking/task-template.md` exists.
    If missing: ERROR -- "Task template not found. Run /initialize-workspace first."

### Step 4: Detect Mode

IF $ARGUMENTS is exactly "status" (no other words):
  -> Status mode (Planner protocol 3b)

IF $ARGUMENTS is exactly "reprioritize" (no other words):
  -> Reprioritize mode (Planner protocol 3c)

IF $ARGUMENTS is non-empty text (not exactly "status" or exactly "reprioritize"):
  -> New planning conversation (Planner protocol 3a) with $ARGUMENTS as the user's intent

IF $ARGUMENTS is empty:
  IF `task-tracking/plan.md` does NOT exist AND registry has no active tasks:
    -> Onboarding mode (Planner protocol 3d)
  ELSE:
    -> Resume: Read plan.md, present current state, ask PO what they'd like to work on next

### Step 5: Execute Mode

Follow the appropriate Planner interaction protocol as determined in Step 4.
The Planner agent definition contains the full flow for each mode.

## Important Rules

1. ALWAYS read `nitro-planner.md` first -- never bypass the agent definition
2. ALWAYS read `task-template.md` before creating any tasks -- never hardcode template structure
3. ALWAYS read `registry.md` to determine next task ID -- never guess
4. NEVER create tasks without Product Owner approval -- always present and wait
5. NEVER modify plan.md ownership -- only the Planner writes to plan.md
6. Pre-flight check: verify task-tracking/, registry.md, and task-template.md exist

## References

- Planner agent: `.claude/agents/nitro-planner.md`
- Task template: `task-tracking/task-template.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
- Template guide: `docs/task-template-guide.md`
