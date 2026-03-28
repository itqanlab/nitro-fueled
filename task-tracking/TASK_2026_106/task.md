# Task: Generalize Orchestration Lifecycle — Type-Agnostic Artifact Names and Universal Flow

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | claude-opus-4-6 |
| Testing    | skip        |

## Description

The orchestration lifecycle must be **type-agnostic**. Every task type (FEATURE, BUGFIX, CONTENT, SOCIAL, DESIGN, OPS, RESEARCH, etc.) follows the same lifecycle flow — different agents fill the pipeline, but the surrounding process (artifacts, status transitions, logging, commits) is identical.

### Current Problem

Artifact names are coding-centric:
- `implementation-plan.md` — implies code implementation
- `task-description.md` — generic enough, keep as-is
- `context.md` — generic enough, keep as-is
- `research-report.md` — generic enough, keep as-is
- `visual-design-specification.md` — too specific to design

### Generalized Artifact Names

| Current Name | Generalized Name | Rationale |
|-------------|-----------------|-----------|
| `implementation-plan.md` | `plan.md` | A plan can be an architecture plan, content outline, design brief, research methodology, ops runbook |
| `task-description.md` | `task-description.md` | Already generic — keep as-is |
| `context.md` | `context.md` | Already generic — keep as-is |
| `research-report.md` | `research-report.md` | Already generic — keep as-is |
| `visual-design-specification.md` | `design-spec.md` | Shorter, still clear |

### Universal Lifecycle Flow

Every task type, regardless of pipeline, follows these lifecycle steps:

```
Step 1: GATHER CONTEXT
  Agent: First agent in pipeline (PM, Researcher, etc.)
  Artifact: context.md
  Purpose: Collect codebase state, existing patterns, constraints

Step 2: DEFINE REQUIREMENTS
  Agent: PM or first planning agent
  Artifact: task-description.md
  Purpose: What needs to be done, acceptance criteria, scope

Step 3: PLAN THE WORK
  Agent: Architect, Content Writer (outline), Designer (brief), etc.
  Artifact: plan.md
  Purpose: How the work will be executed — steps, structure, approach

Step 4: EXECUTE
  Agent: Developer, Content Writer, Designer, DevOps Engineer, etc.
  Artifact: The actual output (code, content, designs, configs)
  Purpose: Do the work

Step 5: REVIEW
  Agent: Review Lead (code), Style Reviewer (content), etc.
  Artifact: review-report.md
  Purpose: Quality gate — review criteria are type-specific

Step 6: COMPLETE
  Agent: Completion Worker or Supervisor
  Artifact: Status transition, logging, commit
  Purpose: Close the task
```

**What varies per type:**
- Which agents fill each step
- What "review" means (code review vs tone review vs accessibility review)
- What the output of Step 4 looks like
- Whether Step 3 is an architecture plan, content outline, or design brief

**What stays identical per type:**
- The artifact filenames at each step
- Status transitions (CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE)
- Logging format
- Commit convention (traceability footer)
- Checkpoint handling
- How the Supervisor monitors and manages the worker

### Changes

1. **Orchestration SKILL.md** — Rename `implementation-plan.md` → `plan.md` throughout. Define the Universal Lifecycle Flow as a top-level section. Document that all types conform to this flow. Update phase detection logic to use `plan.md`.
2. **task-tracking.md** — Update artifact references and folder structure documentation.
3. **strategies.md** — Update artifact references in all strategy workflow diagrams.
4. **checkpoints.md** — Update artifact references in checkpoint definitions.
5. **auto-pilot SKILL.md** — Update worker prompt templates that reference `implementation-plan.md` → `plan.md`.

## Dependencies

- None

## Acceptance Criteria

- [ ] `implementation-plan.md` renamed to `plan.md` across orchestration SKILL.md
- [ ] Universal Lifecycle Flow documented as a top-level section in SKILL.md
- [ ] Phase detection logic updated to check for `plan.md` instead of `implementation-plan.md`
- [ ] task-tracking.md artifact references updated
- [ ] strategies.md workflow diagrams updated
- [ ] checkpoints.md artifact references updated
- [ ] auto-pilot SKILL.md worker prompt templates updated
- [ ] All 6 lifecycle steps documented with "what varies" vs "what stays identical"

## References

- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Task tracking: `.claude/skills/orchestration/references/task-tracking.md`
- Strategies: `.claude/skills/orchestration/references/strategies.md`
- Checkpoints: `.claude/skills/orchestration/references/checkpoints.md`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`

## File Scope

- .claude/skills/orchestration/SKILL.md
- .claude/skills/orchestration/references/task-tracking.md
- .claude/skills/orchestration/references/strategies.md
- .claude/skills/orchestration/references/checkpoints.md
- .claude/skills/auto-pilot/SKILL.md

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_099, TASK_2026_100, TASK_2026_101–105 — overlapping files
- Suggested execution wave: Wave 2, before the new flow tasks (101–105) so they build on the generalized lifecycle
