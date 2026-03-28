# Review Context — TASK_2026_090

## Task Scope
- Task ID: 2026_090
- Task type: REFACTORING
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - `apps/cli/src/commands/init.ts`
  - `apps/cli/src/commands/run.ts`
  - `apps/cli/src/commands/status.ts`
  - `apps/cli/src/base-command.ts`

## Git Diff Summary

The implementation commit is **e07be02** (`feat(cli): migrate apps/cli from Commander to @oclif/core`).
The task's docs commit c5e231b verified no further changes were needed.

### Summary of changes per file:

**`apps/cli/src/base-command.ts`** (new file):
- Created `BaseCommand` abstract class extending `@oclif/core`'s `Command`
- Provides `catch()` and `finally()` overrides that delegate to super

**`apps/cli/src/commands/init.ts`**:
- Replaced Commander.js import (`import type { Command } from 'commander'`) with `@oclif/core` Flags + BaseCommand
- Renamed interface `InitOptions` → `InitFlags` with kebab-case keys (`mcpPath` → `'mcp-path'`, `skipMcp` → `'skip-mcp'`, `skipAgents` → `'skip-agents'`)
- Replaced `registerInitCommand(program: Command)` function with `export default class Init extends BaseCommand`
- Added static `flags` definition using `Flags.string()`, `Flags.boolean()`
- Logic moved into `public async run(): Promise<void>` method

**`apps/cli/src/commands/run.ts`**:
- Replaced Commander.js import with `@oclif/core` Args + Flags + BaseCommand
- Renamed interface `RunOptions` → `RunFlags` with kebab-case keys
- Replaced `registerRunCommand(program: Command)` with `export default class Run extends BaseCommand`
- Fixed variable name collision: local `prompt` variable renamed to `autoPilotPrompt` (was shadowing the module-level `prompt()` function)
- Added `args` definition with `taskId` positional arg

**`apps/cli/src/commands/status.ts`**:
- Replaced Commander.js import with `@oclif/core` Flags + BaseCommand
- Replaced `registerStatusCommand(program: Command)` with `export default class Status extends BaseCommand`
- Added static `flags` with `brief: Flags.boolean()`

## Project Conventions

From CLAUDE.md:
- **Git**: conventional commits with scopes
- **Agent naming**: all agents use the `nitro-` prefix
- TypeScript source in `apps/cli/src/`
- No Commander.js imports should remain in these files

## Style Decisions from Review Lessons

From `.claude/review-lessons/review-general.md`:

### TypeScript Conventions
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare. (T03, T04, T07, T09)
- **No `any` type ever** — use `unknown` + type guards, or proper generics.
- **No `as` type assertions** — use type guards or generics.
- **String literal unions for status/type/category fields** — never bare `string`.
- **No unused imports or dead code** — if exported but never imported, remove it.
- **Falsy checks skip zero values** — use `!== undefined` or `!= null`.

### File Size Limits
- **Components: max 150 lines. Services/repositories/stores: max 200 lines.**
- Note: `init.ts` is ~505 lines (large command file with many helpers) — this is a command module, not a component or service. Reviewers should note this but consider context.

### Error Handling
- **Never swallow errors** — at minimum, log them. No empty catch blocks.

### TypeScript Return Semantics
- **Hard-coded defaults must be co-located with the type they initialize.**
- **String literal union members must not embed spaces in discriminant values.**

### Function Responsibility
- **A function that needs "and" to describe it must be split.**

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `apps/cli/src/commands/init.ts`
- `apps/cli/src/commands/run.ts`
- `apps/cli/src/commands/status.ts`
- `apps/cli/src/base-command.ts`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 6
- Minor: 10
