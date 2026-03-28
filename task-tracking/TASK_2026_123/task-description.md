# Requirements Document - TASK_2026_123

## Introduction

The Model Evaluation Pipeline is a four-part feature (TASK_2026_123 through TASK_2026_126) that enables the Auto-Pilot Supervisor to test any AI model as a Builder, Reviewer, or both, using standardized benchmark tasks with quantitative scoring. This document covers Part 1: the Benchmark Suite, which is the foundation the entire pipeline builds on.

The benchmark suite provides a set of project-agnostic evaluation tasks that span difficulty tiers (easy, medium, hard) and task types (feature, bugfix, refactoring). Each task includes a requirements checklist with specific, scorable dimensions so that Review Workers can produce consistent 1-10 scores. The suite ships as a directory within the nitro-fueled scaffold and is consumed by the Evaluation Supervisor (TASK_2026_124) at runtime.

**Business Value**: Without a standardized benchmark suite, model evaluation is subjective and unrepeatable. This task creates the measurement instrument that makes all subsequent evaluation pipeline features possible.

---

## Requirements

### Requirement 1: Directory Structure

**User Story:** As an evaluation operator, I want the benchmark suite organized in a consistent, discoverable directory structure, so that the Evaluation Supervisor can programmatically load and iterate over benchmark tasks.

#### Acceptance Criteria

1. WHEN the benchmark suite is installed THEN a `benchmark-suite/` directory SHALL exist at the project root containing:
   - `config.md` at the root level
   - `tasks/` subdirectory containing all benchmark task folders
2. WHEN the Evaluation Supervisor reads the tasks directory THEN each subdirectory SHALL follow the naming convention `{difficulty}-{NN}-{slug}` where:
   - `{difficulty}` is one of: `easy`, `medium`, `hard`
   - `{NN}` is a two-digit zero-padded sequence number within that difficulty tier
   - `{slug}` is a kebab-case description of the task (e.g., `single-file-bugfix`)
3. WHEN a benchmark task directory is read THEN it SHALL contain at minimum:
   - `task.md` -- the task description and requirements checklist
   - `setup/` directory (may be empty) -- seed files that must be copied into the worktree before execution

#### Directory Layout

```
benchmark-suite/
  config.md
  tasks/
    easy-01-single-file-bugfix/
      task.md
      setup/
        src/
          string-utils.ts
    easy-02-add-utility-function/
      task.md
      setup/
    medium-01-multi-file-feature/
      task.md
      setup/
        src/
          index.ts
        package.json
    medium-02-refactor-extract-module/
      task.md
      setup/
        src/
          monolith.ts
    hard-01-cross-cutting-change/
      task.md
      setup/
        src/
          logger.ts
          user-service.ts
          order-service.ts
          payment-service.ts
        tsconfig.json
```

---

### Requirement 2: Benchmark Task Format (task.md Specification)

**User Story:** As a Review Worker scoring benchmark output, I want each benchmark task to have a structured requirements checklist with specific, quantifiable criteria, so that I can produce consistent scores across evaluation runs.

#### Acceptance Criteria

1. WHEN a benchmark task.md is read THEN it SHALL contain these sections in order:
   - **Metadata table** (difficulty, type, estimated-time, setup-required)
   - **Description** (what the model must build/fix/refactor)
   - **Setup Instructions** (how to prepare the worktree -- copy setup/ files, run npm init, etc.)
   - **Requirements Checklist** (scorable dimensions with specific criteria)
   - **Scoring Guide** (how to map observations to 1-10 scores per dimension)

2. WHEN a reviewer reads the Requirements Checklist THEN each dimension SHALL specify:
   - Dimension name (e.g., "Correctness", "Code Quality")
   - Specific observable criteria (not vague -- e.g., "All edge cases from the description are handled" not "Code should be clean")
   - Binary sub-checks (pass/fail items within the dimension)

3. WHEN a reviewer applies the Scoring Guide THEN each dimension SHALL have a rubric mapping scores to observable outcomes:
   - 1-3: Failing (criteria not met, fundamental errors)
   - 4-6: Partial (some criteria met, notable gaps)
   - 7-8: Good (most criteria met, minor issues)
   - 9-10: Excellent (all criteria met, exceeds expectations)

#### task.md Template

Every benchmark task.md MUST follow this exact structure:

```markdown
# Benchmark Task: {Title}

## Metadata

| Field          | Value                              |
|----------------|------------------------------------|
| Difficulty     | easy | medium | hard               |
| Type           | feature | bugfix | refactoring      |
| Estimated Time | Xm (minutes for a capable model)   |
| Setup Required | yes | no                           |

## Description

[Detailed description of what the model must do. Must be specific enough
that a Build Worker can implement autonomously without further clarification.
Include exact function signatures, file paths, and expected behavior.]

## Setup Instructions

[If Setup Required = yes]
1. Copy `setup/` contents into the worktree root
2. [Any additional setup steps -- npm install, etc.]

[If Setup Required = no]
1. Initialize a minimal TypeScript project (tsconfig.json + package.json)

## Requirements Checklist

### Dimension 1: Correctness
- [ ] [Specific observable criterion]
- [ ] [Specific observable criterion]
- [ ] [Specific observable criterion]

### Dimension 2: Code Quality
- [ ] [Specific observable criterion]
- [ ] [Specific observable criterion]

### Dimension 3: Completeness
- [ ] [Specific observable criterion]
- [ ] [Specific observable criterion]

### Dimension 4: Error Handling
- [ ] [Specific observable criterion]
- [ ] [Specific observable criterion]

## Scoring Guide

| Dimension      | 1-3 (Failing)                | 4-6 (Partial)              | 7-8 (Good)               | 9-10 (Excellent)            |
|----------------|------------------------------|-----------------------------|---------------------------|-----------------------------|
| Correctness    | [observable failure criteria] | [observable partial criteria]| [observable good criteria]| [observable excellent criteria]|
| Code Quality   | ...                          | ...                         | ...                       | ...                         |
| Completeness   | ...                          | ...                         | ...                       | ...                         |
| Error Handling | ...                          | ...                         | ...                       | ...                         |
```

#### Scoring Dimensions (Standard Set)

Every benchmark task MUST include these four scoring dimensions. The specific criteria within each dimension vary per task, but the dimension names are fixed to enable cross-task aggregation:

1. **Correctness** (1-10): Does the implementation produce the correct output for all specified cases, including edge cases?
2. **Code Quality** (1-10): Does the code follow TypeScript best practices, use proper typing, avoid code smells, and maintain readability?
3. **Completeness** (1-10): Are all requirements from the description addressed? Are there missing pieces?
4. **Error Handling** (1-10): Does the implementation handle invalid inputs, edge cases, and failure modes gracefully?

---

### Requirement 3: Easy-01 -- Single File Bugfix

**User Story:** As an evaluation operator, I want an easy bugfix benchmark task, so that I can test a model's ability to identify and fix bugs in existing code with minimal context.

#### Task Specification

**Difficulty**: Easy | **Type**: Bugfix | **Estimated Time**: 5m

**Scenario**: A `string-utils.ts` file contains three utility functions with subtle bugs:

1. `truncate(str: string, maxLength: number): string` -- Should truncate and add "..." but has an off-by-one error: it truncates at `maxLength` instead of `maxLength - 3` (so output exceeds maxLength).
2. `capitalize(str: string): string` -- Should capitalize the first letter of each word but fails on strings with multiple consecutive spaces (collapses them or crashes).
3. `slugify(str: string): string` -- Should convert to kebab-case but doesn't handle special characters (accented letters like "e" with acute accent become "-" instead of being transliterated or stripped cleanly).

**Setup**: `setup/src/string-utils.ts` contains the buggy implementations. A `setup/src/string-utils.test.ts` file contains failing tests that document the expected behavior.

#### Requirements Checklist (for this task)

**Correctness**:
- [ ] `truncate("Hello World", 8)` returns `"Hell..."` (length exactly 8)
- [ ] `truncate("Hi", 10)` returns `"Hi"` (no truncation when under limit)
- [ ] `truncate("Hello", 5)` returns `"Hello"` (no truncation when at exact limit)
- [ ] `capitalize("hello  world")` returns `"Hello  World"` (preserves multiple spaces)
- [ ] `capitalize("")` returns `""` (empty string edge case)
- [ ] `slugify("Hello World!")` returns `"hello-world"` (strips special chars)
- [ ] `slugify("Cafe Latte")` returns `"cafe-latte"` (handles accented or special characters gracefully)

**Code Quality**:
- [ ] Bug fixes are minimal -- only the broken logic is changed, not wholesale rewrites
- [ ] No `any` types introduced
- [ ] Existing function signatures preserved (no breaking changes)

**Completeness**:
- [ ] All three bugs are identified and fixed
- [ ] All existing passing tests still pass
- [ ] All previously failing tests now pass

**Error Handling**:
- [ ] Functions handle `null`/`undefined` input without throwing (if TypeScript strict mode allows)
- [ ] `truncate` handles `maxLength <= 3` gracefully (returns truncated without "...")

---

### Requirement 4: Easy-02 -- Add Utility Function

**User Story:** As an evaluation operator, I want an easy feature benchmark task, so that I can test a model's ability to write new code from a specification with proper typing and edge case handling.

#### Task Specification

**Difficulty**: Easy | **Type**: Feature | **Estimated Time**: 8m

**Scenario**: Create a new `array-utils.ts` module with three utility functions:

1. `chunk<T>(array: T[], size: number): T[][]` -- Split an array into chunks of the given size. Last chunk may be smaller.
2. `unique<T>(array: T[], keyFn?: (item: T) => unknown): T[]` -- Return unique elements. Optional `keyFn` for custom equality (e.g., unique by `.id`). Without `keyFn`, use strict equality.
3. `groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]>` -- Group array elements by the string key returned by `keyFn`.

**Setup**: No setup files. Model must create the file from scratch in `src/array-utils.ts`.

#### Requirements Checklist (for this task)

**Correctness**:
- [ ] `chunk([1,2,3,4,5], 2)` returns `[[1,2],[3,4],[5]]`
- [ ] `chunk([], 3)` returns `[]`
- [ ] `unique([1,2,2,3,1])` returns `[1,2,3]`
- [ ] `unique([{id:1,n:"a"},{id:1,n:"b"}], x => x.id)` returns `[{id:1,n:"a"}]`
- [ ] `groupBy(["one","two","three"], s => String(s.length))` returns `{"3":["one","two"],"5":["three"]}`

**Code Quality**:
- [ ] All functions use proper TypeScript generics (no `any`)
- [ ] Functions are exported with named exports
- [ ] Code is readable with clear variable names
- [ ] JSDoc comments present on all three functions describing parameters and return type

**Completeness**:
- [ ] All three functions are implemented
- [ ] File is created at the correct path (`src/array-utils.ts`)
- [ ] All specified signatures are respected exactly

**Error Handling**:
- [ ] `chunk` throws or returns `[]` for `size <= 0`
- [ ] `chunk` handles `size > array.length` (returns single chunk)
- [ ] `unique` handles empty array
- [ ] `groupBy` handles empty array (returns `{}`)

---

### Requirement 5: Medium-01 -- Multi-File Feature

**User Story:** As an evaluation operator, I want a medium-difficulty feature benchmark task, so that I can test a model's ability to build a feature that spans multiple files with proper module boundaries and integration.

#### Task Specification

**Difficulty**: Medium | **Type**: Feature | **Estimated Time**: 20m

**Scenario**: Build a simple in-memory key-value store with TTL (time-to-live) support. The feature spans three files:

1. `src/cache/types.ts` -- Type definitions:
   - `CacheEntry<T>` interface: `{ value: T; expiresAt: number | null }`
   - `CacheOptions` interface: `{ defaultTTL?: number; maxSize?: number; onEvict?: (key: string, value: unknown) => void }`

2. `src/cache/cache.ts` -- The `Cache<T>` class:
   - Constructor accepts `CacheOptions`
   - `set(key: string, value: T, ttl?: number): void` -- stores with optional TTL (milliseconds). If no TTL, uses `defaultTTL`. If neither, no expiry.
   - `get(key: string): T | undefined` -- returns value if not expired, removes and returns `undefined` if expired (lazy expiration)
   - `has(key: string): boolean` -- checks existence AND expiration
   - `delete(key: string): boolean` -- removes entry, calls `onEvict` if set
   - `clear(): void` -- removes all entries, calls `onEvict` for each
   - `size(): number` -- returns count of non-expired entries
   - When `maxSize` is reached on `set`, evict the oldest entry (LRU by insertion order)

3. `src/cache/index.ts` -- Barrel export file re-exporting the class and types

**Setup**: A minimal `setup/src/index.ts` exists as an entry point, and a `setup/package.json` with TypeScript dependency.

#### Requirements Checklist (for this task)

**Correctness**:
- [ ] `set` + `get` round-trips for basic values (string, number, object)
- [ ] Expired entries return `undefined` from `get`
- [ ] `has` returns `false` for expired entries
- [ ] `size` does not count expired entries
- [ ] `maxSize` eviction removes the oldest entry (first inserted)
- [ ] `onEvict` callback fires on `delete`, `clear`, and maxSize eviction
- [ ] `defaultTTL` applies when no per-key TTL is provided

**Code Quality**:
- [ ] Proper generic typing on `Cache<T>` -- no `any` types
- [ ] Clean separation: types in `types.ts`, implementation in `cache.ts`, exports in `index.ts`
- [ ] Private internal storage (not exposed as public properties)
- [ ] Consistent code style (semicolons, quotes, indentation)

**Completeness**:
- [ ] All three files created at correct paths
- [ ] All six methods implemented (`set`, `get`, `has`, `delete`, `clear`, `size`)
- [ ] Barrel export in `index.ts` re-exports both the class and the type interfaces
- [ ] `CacheOptions` and `CacheEntry` types match the specification exactly

**Error Handling**:
- [ ] `set` with negative TTL treated as immediate expiry or throws
- [ ] `get` on non-existent key returns `undefined` (not throws)
- [ ] `delete` on non-existent key returns `false` (not throws)
- [ ] `maxSize` of 0 or negative is handled (throws or defaults to unlimited)

---

### Requirement 6: Medium-02 -- Refactor Extract Module

**User Story:** As an evaluation operator, I want a medium-difficulty refactoring benchmark task, so that I can test a model's ability to decompose a monolithic file into clean modules while preserving all functionality.

#### Task Specification

**Difficulty**: Medium | **Type**: Refactoring | **Estimated Time**: 15m

**Scenario**: A single `src/monolith.ts` file (approximately 200 lines) contains a task runner with three concerns mixed together:

1. **Task parsing** -- parses task definitions from a configuration object
2. **Task scheduling** -- determines execution order based on dependencies (topological sort)
3. **Task execution** -- runs tasks in order, tracking status and timing

The model must extract these into three separate modules while preserving the existing public API:

- `src/task-runner/parser.ts` -- `parseTasks(config: TaskConfig): Task[]`
- `src/task-runner/scheduler.ts` -- `scheduleTasks(tasks: Task[]): Task[]` (returns topologically sorted)
- `src/task-runner/executor.ts` -- `executeTasks(tasks: Task[]): Promise<ExecutionResult[]>`
- `src/task-runner/types.ts` -- shared type definitions (`Task`, `TaskConfig`, `ExecutionResult`, etc.)
- `src/task-runner/index.ts` -- barrel export that preserves the original public API surface

The original `src/monolith.ts` must be deleted.

**Setup**: `setup/src/monolith.ts` contains the monolithic implementation.

#### Requirements Checklist (for this task)

**Correctness**:
- [ ] `parseTasks` produces the same output as the original parsing logic for all input shapes
- [ ] `scheduleTasks` produces a valid topological order (dependencies before dependents)
- [ ] `scheduleTasks` detects circular dependencies (throws or returns error)
- [ ] `executeTasks` runs tasks in the provided order and returns timing and status per task
- [ ] The barrel export (`index.ts`) exposes the same public API as the original `monolith.ts`

**Code Quality**:
- [ ] Each module has a single responsibility (parser does not schedule, scheduler does not execute)
- [ ] Shared types extracted to `types.ts` (not duplicated across modules)
- [ ] No circular imports between the extracted modules
- [ ] Import paths are clean (relative imports within the `task-runner/` directory)

**Completeness**:
- [ ] All five files created: `parser.ts`, `scheduler.ts`, `executor.ts`, `types.ts`, `index.ts`
- [ ] Original `monolith.ts` is deleted
- [ ] All functionality from the original file is accounted for (nothing dropped)
- [ ] All type definitions moved to `types.ts`

**Error Handling**:
- [ ] Circular dependency detection preserved from original (if present) or added
- [ ] Invalid task config input handled in `parseTasks` (malformed config object)
- [ ] Task execution failures in `executeTasks` do not crash the runner (per-task error capture)

---

### Requirement 7: Hard-01 -- Cross-Cutting Change

**User Story:** As an evaluation operator, I want a hard-difficulty benchmark task, so that I can test a model's ability to make coordinated changes across multiple files that share a cross-cutting concern.

#### Task Specification

**Difficulty**: Hard | **Type**: Feature | **Estimated Time**: 30m

**Scenario**: An existing codebase has four service files that each do their own ad-hoc console logging. The model must:

1. **Create a structured logger** (`src/logger.ts`):
   - `Logger` class with configurable log levels: `debug`, `info`, `warn`, `error`
   - Structured JSON output: `{ timestamp: string, level: string, service: string, message: string, data?: unknown }`
   - `createLogger(serviceName: string, options?: LoggerOptions): Logger` factory function
   - `LoggerOptions`: `{ level?: LogLevel; output?: (entry: LogEntry) => void }` -- `output` defaults to `console.log(JSON.stringify(entry))` but is injectable for testing
   - `LogLevel` type: `"debug" | "info" | "warn" | "error"` with level filtering (setting level to "warn" suppresses debug and info)

2. **Refactor all four services** to use the structured logger instead of direct `console.log`/`console.warn`/`console.error` calls:
   - `src/user-service.ts` -- user CRUD operations (3 log calls)
   - `src/order-service.ts` -- order processing (4 log calls)
   - `src/payment-service.ts` -- payment handling (5 log calls)
   - `src/logger.ts` -- replace existing naive logger (just re-exports console.log) with the structured implementation

3. **Preserve all existing functionality** -- the services must behave identically except for log output format.

**Setup**: All four service files plus the naive `logger.ts` are provided in `setup/src/`. Each service has different patterns of console usage that must be converted.

#### Requirements Checklist (for this task)

**Correctness**:
- [ ] `createLogger("user-service")` returns a Logger instance with service name embedded
- [ ] `logger.info("message")` outputs valid JSON with timestamp, level, service, message fields
- [ ] Level filtering works: `Logger({ level: "warn" })` suppresses debug and info calls
- [ ] All `console.log` calls in services replaced with appropriate `logger.info`/`logger.debug` calls
- [ ] All `console.warn` calls replaced with `logger.warn`
- [ ] All `console.error` calls replaced with `logger.error`
- [ ] No `console.log`/`console.warn`/`console.error` calls remain in any service file

**Code Quality**:
- [ ] `Logger` class uses proper TypeScript types (LogLevel, LogEntry, LoggerOptions)
- [ ] Injectable output function enables testing without console capture
- [ ] Each service creates its own logger instance via `createLogger` (not a shared global)
- [ ] Logger module has no dependencies on service modules (no circular imports)
- [ ] Log call sites include meaningful context data (e.g., `logger.info("User created", { userId })`)

**Completeness**:
- [ ] `src/logger.ts` fully replaced with structured implementation
- [ ] All four service files updated to use structured logger
- [ ] Type definitions for `LogLevel`, `LogEntry`, `LoggerOptions` exported
- [ ] Factory function `createLogger` exported
- [ ] Barrel export or direct imports work correctly

**Error Handling**:
- [ ] Logger constructor handles missing/invalid options gracefully (defaults apply)
- [ ] `output` function errors do not crash the service (logger swallows output errors)
- [ ] Service error paths still log errors with appropriate level and context data
- [ ] Invalid log level in options defaults to "info" or throws a clear error

---

### Requirement 8: config.md Specification

**User Story:** As an evaluation operator, I want a config.md that documents the benchmark suite structure and controls evaluation run parameters, so that the Evaluation Supervisor can load tasks programmatically and I can customize which tasks to include.

#### Acceptance Criteria

1. WHEN the Evaluation Supervisor reads `config.md` THEN it SHALL find:
   - A task manifest listing all benchmark tasks with their difficulty and type
   - Difficulty weight configuration (how scores from different tiers are weighted in the aggregate)
   - Instructions for adding project-specific benchmark tasks (the extension point)

2. WHEN a run is configured THEN the config SHALL specify:
   - Default difficulty weights: `easy: 1.0`, `medium: 1.5`, `hard: 2.0` (hard tasks count more in aggregate score)
   - Task inclusion list (all tasks by default, but can be filtered by difficulty or task ID)
   - Scoring dimensions (the four standard dimensions listed in Requirement 2)

3. WHEN a user wants to add project-specific benchmark tasks THEN the config SHALL document:
   - Extension directory convention: `benchmark-suite/tasks/custom-{NN}-{slug}/`
   - Custom tasks follow the same `task.md` format as generic tasks
   - Custom tasks appear in the manifest after generic tasks
   - Custom tasks can define additional scoring dimensions beyond the standard four (appended, not replacing)

#### config.md Structure

```markdown
# Benchmark Suite Configuration

## Task Manifest

| Task ID                          | Difficulty | Type        | Est. Time |
|----------------------------------|------------|-------------|-----------|
| easy-01-single-file-bugfix       | easy       | bugfix      | 5m        |
| easy-02-add-utility-function     | easy       | feature     | 8m        |
| medium-01-multi-file-feature     | medium     | feature     | 20m       |
| medium-02-refactor-extract-module| medium     | refactoring | 15m       |
| hard-01-cross-cutting-change     | hard       | feature     | 30m       |

## Difficulty Weights

[Weights for aggregate scoring -- hard tasks should count more.]

| Difficulty | Weight |
|------------|--------|
| easy       | 1.0    |
| medium     | 1.5    |
| hard       | 2.0    |

## Scoring Dimensions

[The four standard dimensions every task is scored on.]

| Dimension      | Description                                    |
|----------------|------------------------------------------------|
| Correctness    | Functional accuracy against specification      |
| Code Quality   | TypeScript best practices, typing, readability |
| Completeness   | All requirements addressed, nothing missing    |
| Error Handling | Invalid inputs, edge cases, failure modes      |

## Extending with Project-Specific Tasks

[How to add custom benchmark tasks for your project.]

### Convention
- Place custom tasks in: `benchmark-suite/tasks/custom-{NN}-{slug}/`
- Follow the same `task.md` format as generic tasks
- Custom tasks appear in the manifest after generic tasks
- Custom tasks can define additional scoring dimensions

### Adding a Custom Task
1. Create `benchmark-suite/tasks/custom-01-your-task/task.md`
2. Follow the task.md template from this suite
3. Add setup files to `setup/` if needed
4. Add the task to the manifest table above
```

---

### Requirement 9: Extensibility Design

**User Story:** As a future developer extending the benchmark suite, I want clear extension points and conventions, so that I can add project-specific benchmark tasks without modifying the generic task definitions.

#### Acceptance Criteria

1. WHEN project-specific tasks are added THEN they SHALL:
   - Live in directories prefixed with `custom-` to distinguish from generic tasks
   - Follow the identical `task.md` format (Metadata, Description, Setup Instructions, Requirements Checklist, Scoring Guide)
   - Be loadable by the same Evaluation Supervisor loader that reads generic tasks (no code changes needed)

2. WHEN the Evaluation Supervisor loads tasks THEN it SHALL:
   - Scan all subdirectories of `benchmark-suite/tasks/` (both generic and custom)
   - Identify task type by directory prefix (`easy-`, `medium-`, `hard-`, `custom-`)
   - Custom tasks have difficulty specified in their `task.md` Metadata table (not inferred from prefix)

3. WHEN results are aggregated THEN custom tasks SHALL:
   - Be scored using the same four standard dimensions
   - Have any additional custom dimensions scored separately and reported in a "Custom Dimensions" section
   - Not affect the aggregate scores of generic tasks (reported separately)

---

## Non-Functional Requirements

### Portability Requirements

- **Project Agnosticism**: All benchmark tasks MUST work in any JavaScript/TypeScript repository. No imports from or references to nitro-fueled internals, Electron APIs, or project-specific libraries.
- **Node.js Compatibility**: Setup files and task descriptions assume a Node.js + TypeScript environment. No browser-specific APIs.
- **Self-Contained Setup**: Each task's `setup/` directory contains everything needed. No external dependencies beyond TypeScript and standard Node.js APIs.

### Maintainability Requirements

- **Independent Tasks**: Each benchmark task is fully self-contained. Adding, removing, or modifying one task does not affect any other task.
- **Consistent Format**: All tasks follow the identical `task.md` template. Format deviations are grounds for rejection in code review.
- **Versioned Content**: Benchmark tasks are committed to the repository. Changes to task content are tracked in git like any other source file.

### Quality Requirements for Benchmark Task Content

- **Deterministic Scoring**: A reviewer scoring the same implementation twice MUST produce scores within +/-1 point on each dimension. Criteria must be specific enough to eliminate subjective interpretation.
- **Calibrated Difficulty**: Easy tasks should be completable by a capable model in under 10 minutes. Medium tasks in 15-25 minutes. Hard tasks in 25-40 minutes.
- **Realistic Scenarios**: Tasks should represent real-world development activities, not contrived puzzles or leetcode-style problems.

### Scalability Requirements

- **Extensible Without Modification**: Adding new tasks requires only adding new directories, not modifying existing files (except adding to the manifest in `config.md`).
- **Suite Growth**: The structure supports growing from 5 to 50+ tasks without organizational changes.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|---|---|---|---|
| Evaluation Operator (user running /auto-pilot --evaluate) | High | End user | Can run a complete evaluation cycle against all benchmark tasks |
| Evaluation Supervisor (TASK_2026_124) | High | Consumer | Can programmatically load all tasks from the directory structure |
| Review Workers (TASK_2026_126) | High | Consumer | Can score implementations against specific, unambiguous criteria |
| Build Workers (model under test) | Medium | Executor | Task descriptions are clear enough for autonomous implementation |

### Secondary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|---|---|---|---|
| Future task authors | Medium | Extender | Extension point is documented and easy to follow |
| nitro-fueled CLI users (init) | Low | Recipient | Benchmark suite ships with scaffold without conflicts |

---

## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation Strategy |
|---|---|---|---|---|
| Benchmark tasks too vague for consistent scoring | Medium | Critical | 8 | Each criterion is a binary pass/fail check; scoring guide maps check counts to 1-10 ranges |
| Setup files contain subtle errors that confuse models | Medium | High | 6 | Setup files must be valid TypeScript that compiles without errors; bugs are intentional and documented |
| Tasks not project-agnostic (accidental dependency) | Low | High | 4 | Code review checklist item: verify zero project-specific imports |
| Difficulty calibration wrong (easy tasks too hard, etc.) | Medium | Medium | 4 | Run each task through one model before finalizing; adjust estimated times based on results |
| Scoring dimensions too few to differentiate models | Low | Medium | 3 | Four dimensions cover the primary quality axes; custom dimensions handle edge cases |

---

## Setup File Specifications

The following setup files must be created with intentionally designed content. These are not placeholder files -- they are the test fixtures that models will operate on.

### easy-01-single-file-bugfix: setup/src/string-utils.ts

Must contain three functions with specific, documented bugs:
- `truncate`: off-by-one error (does not account for "..." length)
- `capitalize`: fails on multiple consecutive spaces
- `slugify`: does not handle special/accented characters

Must also contain `setup/src/string-utils.test.ts` with test cases that fail against the buggy code but pass against correct implementations.

### medium-01-multi-file-feature: setup files

- `setup/src/index.ts`: minimal entry point (empty or with a placeholder export)
- `setup/package.json`: minimal package.json with TypeScript as a devDependency

### medium-02-refactor-extract-module: setup/src/monolith.ts

Must be approximately 200 lines containing:
- Task interface and config type definitions (mixed in with logic)
- `parseTasks` function that reads a config object
- `scheduleTasks` function with topological sort
- `executeTasks` async function with timing and status tracking
- A single exported `runTasks(config)` function that calls all three in sequence

The code must be working but poorly organized (all in one file, no separation of concerns).

### hard-01-cross-cutting-change: setup files

- `setup/src/logger.ts`: naive logger that just re-exports `console.log`
- `setup/src/user-service.ts`: user CRUD with 3 direct console calls
- `setup/src/order-service.ts`: order processing with 4 direct console calls
- `setup/src/payment-service.ts`: payment handling with 5 direct console calls
- `setup/tsconfig.json`: standard TypeScript config

Each service file must be a realistic, working service (not stubs) with different patterns of console usage.

---

## Quality Gates

- [ ] All requirements follow SMART criteria
- [ ] Acceptance criteria use WHEN/THEN/SHALL format
- [ ] Stakeholder analysis complete
- [ ] Risk assessment with mitigation strategies
- [ ] Five benchmark tasks specified (easy x2, medium x2, hard x1)
- [ ] Each task has four scoring dimensions with specific criteria
- [ ] config.md structure fully specified
- [ ] Extension point documented (custom- prefix convention)
- [ ] Setup file content specified for all tasks requiring setup
- [ ] All tasks are project-agnostic (no nitro-fueled-specific code)
- [ ] Scoring rubric enables deterministic 1-10 mapping
