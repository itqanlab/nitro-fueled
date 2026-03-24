# Code Style Review - TASK_2026_012

**Reviewer**: Code Style Reviewer Agent
**Date**: 2026-03-24
**File Under Review**: `packages/cli/src/commands/create.ts`
**Comparison Files**: `run.ts`, `status.ts`, `init.ts`, `utils/preflight.ts`

---

## Summary

| Metric          | Value           |
| --------------- | --------------- |
| Overall Score   | 5/10            |
| Verdict         | PASS_WITH_NOTES |
| Blocking Issues | 1               |
| Serious Issues  | 2               |
| Minor Issues    | 2               |
| NITs            | 1               |
| Lines Reviewed  | 111             |

The command works, but it re-implements shared utilities that already exist in the codebase, creating a maintenance landmine. `run.ts` properly imports `preflightChecks` from `utils/preflight.ts`; `create.ts` copy-pastes two of those checks inline and also duplicates the entire child-process spawn + signal-forwarding block from `run.ts`. This is the textbook definition of "it works today, breaks in 6 months when someone fixes a bug in only one copy."

---

## Findings

### BLOCKING-01: Duplicated utility functions that already exist in shared module

**Severity**: BLOCKING
**File**: `packages/cli/src/commands/create.ts:11-37`
**Comparison**: `packages/cli/src/utils/preflight.ts:10-46`

**Problem**: `isClaudeAvailable()` (lines 11-18) is a character-for-character duplicate of the private function in `preflight.ts` (lines 10-17). `isWorkspaceInitialized()` (lines 20-37) duplicates the `.claude/` and `task-tracking/` checks from `preflightChecks()` (lines 25-39 of `preflight.ts`).

`run.ts` already uses the shared `preflightChecks()` utility. `create.ts` bypasses it entirely and rolls its own copies. This means:

- Bug fixes to `preflight.ts` (e.g., adding a new prerequisite check) will not apply to `create.ts`.
- Error messages can drift between commands (they are identical today, but there is no mechanism to keep them synchronized).
- A developer reading `run.ts` will expect `create.ts` to follow the same pattern and be confused when it does not.

**Fix**: Extract `isClaudeAvailable()` as a named export from `preflight.ts`. For workspace checks, either export a lightweight `workspaceChecks()` function (without the registry/MCP parts that `create` does not need), or refactor `preflightChecks()` to accept options controlling which checks to run. Then import and use them in `create.ts`.

```typescript
// In preflight.ts - export the building blocks
export function isClaudeAvailable(): boolean { ... }
export function checkWorkspaceInitialized(cwd: string): boolean { ... }

// In create.ts - use them
import { isClaudeAvailable, checkWorkspaceInitialized } from '../utils/preflight.js';
```

---

### SERIOUS-01: Duplicated spawn + signal-forwarding boilerplate

**Severity**: SERIOUS
**File**: `packages/cli/src/commands/create.ts:39-76`
**Comparison**: `packages/cli/src/commands/run.ts:140-180`

**Problem**: `spawnClaudeSession()` in `create.ts` and `spawnSupervisor()` in `run.ts` share the same structural pattern:
1. Log the command being run
2. `spawn('claude', [...args], { cwd, stdio: 'inherit' })`
3. Register SIGINT/SIGTERM forwarding
4. Handle `close` event with exit code propagation
5. Handle `error` event with error message

The only differences are: (a) the args array (`['-p', prompt]` vs `['--dangerously-skip-permissions', '-p', prompt]`), and (b) the log label ("Claude session" vs "Supervisor"). This is ~38 lines of duplicated logic.

**Tradeoff**: If a future review lesson (like the existing TASK_2026_010 signal-forwarding rule) leads to a fix in one copy, the other copy will be missed. The signal-forwarding pattern is non-trivial enough that inconsistencies could cause orphan processes.

**Recommendation**: Extract a `spawnClaude(cwd, args, label)` utility into `utils/spawn.ts` (or similar). Both commands call it with their specific args:

```typescript
// create.ts
spawnClaude(cwd, ['-p', prompt], 'Claude session');

// run.ts
spawnClaude(cwd, ['--dangerously-skip-permissions', '-p', prompt], 'Supervisor');
```

---

### SERIOUS-02: Split import from same module

**Severity**: SERIOUS
**File**: `packages/cli/src/commands/create.ts:2-3`

**Problem**: Two separate import statements from the same module:

```typescript
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
```

This violates standard import hygiene. No other command file in this codebase has split imports from the same module. `run.ts` line 1 imports `spawn` alone; `preflight.ts` line 2 imports `execSync` alone -- but neither imports both, because their responsibilities are properly separated (which circles back to BLOCKING-01).

**Fix**: Merge into a single import:

```typescript
import { spawn, execSync } from 'node:child_process';
```

However, if BLOCKING-01 is addressed (extracting `isClaudeAvailable` to preflight.ts), `create.ts` would no longer need `execSync` at all, and the split import disappears naturally.

---

### MINOR-01: Import grouping does not match sibling commands

**Severity**: MINOR
**File**: `packages/cli/src/commands/create.ts:1-5`

**Problem**: The import block has no blank-line separation between Node built-ins and third-party imports:

```typescript
import { existsSync } from 'node:fs';        // Node built-in
import { spawn } from 'node:child_process';   // Node built-in
import { execSync } from 'node:child_process'; // Node built-in (duplicate source)
import { resolve } from 'node:path';          // Node built-in
import type { Command } from 'commander';     // Third-party
```

Compare with `run.ts`:

```typescript
import { spawn } from 'node:child_process';     // Node built-in
import type { Command } from 'commander';        // Third-party  (blank line would be ideal)
import type { RegistryRow } from '../utils/registry.js';  // Local
import { preflightChecks } from '../utils/preflight.js';  // Local
```

Neither file has blank lines between groups, so this is technically consistent across the codebase. However, the project's general import order rule (documented in the review-lessons) calls for blank lines between groups. None of the CLI commands follow this rule -- worth tracking as a codebase-wide nit rather than a create-specific issue.

---

### MINOR-02: `isWorkspaceInitialized` prints errors internally but caller also sets exit code

**Severity**: MINOR
**File**: `packages/cli/src/commands/create.ts:20-37, 92-95`

**Problem**: `isWorkspaceInitialized()` prints error messages via `console.error` (lines 25-27, 31-33), then the caller also sets `process.exitCode = 1` (line 93). Meanwhile, `isClaudeAvailable()` does NOT print errors -- the caller prints them (lines 98-99). This inconsistency in who is responsible for error output makes the code harder to reason about.

In `preflight.ts`, error printing is consistently done inside the check function, and the caller only checks the return value. `create.ts` is split: one function prints, the other does not.

**Recommendation**: Pick one pattern and apply it consistently. The `preflight.ts` approach (function handles its own error output) is cleaner for CLI code where the function knows the specific failure reason.

---

### NIT-01: Console log of empty string

**Severity**: NIT
**File**: `packages/cli/src/commands/create.ts:41`

**Problem**: `console.log('')` for a blank line. This is consistent with `run.ts` (line 145) so it is a codebase convention, not a bug. Just noting that `console.log()` (no argument) achieves the same result and is marginally cleaner.

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                                 |
| ------------------------------ | ------ | ----------------------------------------------------------------------- |
| Shared utility reuse           | FAIL   | Duplicates `preflight.ts` functions instead of importing them           |
| DRY (spawn boilerplate)        | FAIL   | Near-identical spawn+signal logic duplicated from `run.ts`              |
| Import organization            | FAIL   | Split import from same module; no group separation                      |
| Naming conventions             | PASS   | `camelCase` functions, `PascalCase` interface, `kebab-case` file        |
| Error handling                 | PASS   | Errors set `process.exitCode` rather than calling `process.exit()`      |
| TypeScript strictness          | PASS   | No `any`, no `as` assertions, proper typing                            |
| Command registration pattern   | PASS   | Follows `registerXxxCommand(program)` pattern from siblings            |
| Signal forwarding              | PASS   | SIGINT/SIGTERM forwarded to child, cleaned up on exit                   |
| File size                      | PASS   | 111 lines, well within 150-line limit                                   |

---

## Technical Debt Assessment

**Introduced**: Two copies of `isClaudeAvailable()`, one copy of workspace-init checks, and one copy of the spawn+signal pattern now exist independently from their shared/sibling counterparts. Any future fix to these patterns requires updating 2 files minimum, with no compile-time enforcement that both are updated.

**Mitigated**: None. This file adds new capability but does not consolidate existing patterns.

**Net Impact**: Negative. The duplication creates a maintenance multiplier on 3 distinct code patterns.

---

## Verdict

**Verdict**: PASS_WITH_NOTES
**Confidence**: HIGH
**Key Concern**: Duplicated utility code (BLOCKING-01 + SERIOUS-01) that will cause bug-fix divergence across commands.

The command's logic is correct and the feature works as designed. The `--quick` flag handling, description joining, and prompt construction are clean and well-structured. But the copy-paste approach to shared logic is a debt accelerator. BLOCKING-01 should be addressed before this code ages; the longer it sits, the more likely the copies will diverge silently.

---

## What Excellence Would Look Like

A 9/10 implementation would:

1. Import `isClaudeAvailable` and a workspace-check function from `utils/preflight.ts` instead of duplicating them.
2. Extract the spawn+signal-forwarding pattern into a shared `utils/spawn.ts` utility, used by both `create.ts` and `run.ts`.
3. Have `create.ts` be ~30-40 lines: imports, option interface, prompt construction logic, and the `registerCreateCommand` export. All infrastructure concerns (checks, spawning) delegated to shared utilities.
4. Include blank lines between import groups per the project's documented convention.
