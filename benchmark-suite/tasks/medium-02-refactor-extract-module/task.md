# Benchmark Task: Refactor Extract Module

## Metadata

| Field          | Value       |
|----------------|-------------|
| Difficulty     | medium      |
| Type           | refactoring |
| Estimated Time | 15m         |
| Setup Required | yes         |

## Description

A single `src/monolith.ts` file (approximately 200 lines) contains a task runner with three concerns mixed together: task parsing, task scheduling (topological sort), and task execution (async with timing). The model must extract these into separate modules while preserving the existing public API.

The monolith currently exports only `runTasks` and the types (`Task`, `TaskConfig`, `ExecutionResult`, `TaskStatus`). After refactoring, the same exports must be available from the new module structure.

Target structure after refactoring:

- `src/task-runner/parser.ts` -- `parseTasks(config: TaskConfig): Task[]`
- `src/task-runner/scheduler.ts` -- `scheduleTasks(tasks: Task[]): Task[]` (returns topologically sorted array)
- `src/task-runner/executor.ts` -- `executeTasks(tasks: Task[]): Promise<ExecutionResult[]>`
- `src/task-runner/types.ts` -- shared type definitions (`Task`, `TaskConfig`, `ExecutionResult`, `TaskStatus`)
- `src/task-runner/index.ts` -- barrel export that preserves the original public API surface

The original `src/monolith.ts` must be deleted after extraction.

## Setup Instructions

1. Copy `setup/` contents into the worktree root
2. The `src/monolith.ts` file contains the monolithic implementation with all logic in a single file
3. Review the existing public API: `runTasks`, `Task`, `TaskConfig`, `ExecutionResult`, `TaskStatus`

## Requirements Checklist

### Correctness

- [ ] `parseTasks` produces the same output as the original parsing logic for all input shapes
- [ ] `scheduleTasks` produces a valid topological order (dependencies before dependents)
- [ ] `scheduleTasks` detects circular dependencies (throws or returns error)
- [ ] `executeTasks` runs tasks in the provided order and returns timing and status per task
- [ ] The barrel export (`index.ts`) exposes the same public API as the original `monolith.ts`

### Code Quality

- [ ] Each module has a single responsibility (parser does not schedule, scheduler does not execute)
- [ ] Shared types extracted to `types.ts` (not duplicated across modules)
- [ ] No circular imports between the extracted modules
- [ ] Import paths are clean (relative imports within the `task-runner/` directory)

### Completeness

- [ ] All five files created: `parser.ts`, `scheduler.ts`, `executor.ts`, `types.ts`, `index.ts`
- [ ] Original `monolith.ts` is deleted
- [ ] All functionality from the original file is accounted for (nothing dropped)
- [ ] All type definitions moved to `types.ts`

### Error Handling

- [ ] Circular dependency detection preserved from original (if present) or added
- [ ] Invalid task config input handled in `parseTasks` (malformed config object)
- [ ] Task execution failures in `executeTasks` do not crash the runner (per-task error capture)

## Scoring Guide

| Dimension      | 1-3 (Failing)                                                                 | 4-6 (Partial)                                                                  | 7-8 (Good)                                                                     | 9-10 (Excellent)                                                                |
|----------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Correctness    | Public API broken; barrel export missing or wrong; extracted functions produce different output than original | Barrel export exists but missing some types; 3 of 5 functions work correctly   | All functions work correctly; barrel export covers most of the original API     | All 5 correctness checks pass; barrel export is identical to original public API |
| Code Quality   | Multiple concerns in a single extracted file; types duplicated across modules; circular imports present | Responsibilities mostly separated but one module leaks into another's concern   | Clean separation of concerns; types in one place; minor import path issues      | Each module has exactly one responsibility; types only in types.ts; all imports clean and relative |
| Completeness   | Fewer than 3 of 5 files created; monolith.ts still exists; significant logic dropped | 4 of 5 files created or monolith.ts not deleted; most functionality preserved  | All 5 files created; monolith.ts deleted; minor functionality gap               | All 5 files created; monolith.ts deleted; every function and type from original accounted for |
| Error Handling | Circular dependency detection removed; parseTasks crashes on bad input; executeTasks crashes on task failure | Some error handling preserved but incomplete; one of three error cases missing  | All three error cases handled; minor gap in error message quality               | Circular dependency detection with clear error message; parseTasks validates all input; executeTasks captures per-task errors without crashing |
