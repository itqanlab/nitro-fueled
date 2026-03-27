# Task Sizing Rules

Single source of truth for task sizing enforcement. Referenced by `/create-task` (Step 6b), the Planner agent (Section 4c: Task Sizing Enforcement), the Planner **Backlog Sizing Review** (Section 3e), and `/auto-pilot` (Step 4: Pre-Flight Task Validation — Validation D).

## Purpose

Every task MUST be completable within a single worker session — specifically, within **2 context compactions max**. Tasks that are too large cause workers to die mid-implementation or produce poor output.

> **Enforcement behavior**: These limits trigger warnings, not hard failures. The consuming command or agent determines whether a violation blocks or warns. `/create-task` treats all violations as non-blocking warnings.

## Hard Limits

A task MUST NOT exceed ANY of these:

| Dimension | Maximum |
|-----------|---------|
| Files created or significantly modified | 7 |
| Requirements / acceptance criteria groups | 5 |
| Task description length | ~150 lines |
| Complexity "Complex" + multiple architectural layers | Split required |

## Additional Indicators a Task Is Too Large

Beyond the hard limits above:

- Multiple **unrelated** functional areas are touched in a single task

## Splitting Guidelines

When a task exceeds any limit, break it into multiple tasks with explicit dependencies. Each resulting task must be:

- Independently testable with clear input/output boundaries
- Scoped to a single functional area or architectural layer where possible
- Connected to predecessors/successors via `TASK_YYYY_NNN` dependencies
- Completable within 2 context compactions (consider: how many files will the worker need to read + write?)

## Anti-Pattern: "The Kitchen Sink Task"

A single task that bundles a detection engine, a template system, two commands, and catalog integration (e.g., TASK_2026_006, which was CANCELLED after workers repeatedly died trying to complete it). Every component that can stand on its own SHOULD be its own task.
