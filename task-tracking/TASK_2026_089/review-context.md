# Review Context — TASK_2026_089

## Task Scope
- Task ID: 2026_089
- Task type: DEVOPS
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - apps/cli/package.json (added @oclif/core, removed commander, added oclif config block)
  - apps/cli/project.json (added run-cli target)
  - apps/cli/src/index.ts (replaced Commander parseAsync with Oclif run())
  - apps/cli/src/base-command.ts (created — BaseCommand extending @oclif/core Command)
  - apps/cli/src/commands/init.ts (converted to Oclif class)
  - apps/cli/src/commands/run.ts (converted to Oclif class)
  - apps/cli/src/commands/status.ts (converted to Oclif class)
  - apps/cli/src/commands/create.ts (converted to Oclif class)
  - apps/cli/src/commands/config.ts (converted to Oclif class)
  - apps/cli/src/commands/dashboard.ts (converted to Oclif class)
  - apps/cli/src/commands/update.ts (converted to Oclif class)
  - apps/cli/src/utils/ (all 23 utility files unchanged)

## Git Diff Summary

Implementation commit: `e07be02` — `feat(cli): migrate apps/cli from Commander to @oclif/core`

Files changed (11 files, 678 insertions, 660 deletions):

- **apps/cli/package.json**: Removed `commander` dep, added `@oclif/core: ^4.10.3`. Added `oclif` config block with `bin: "nitro-fueled"`, `dirname: "nitro-fueled"`, `commands: "./dist/commands"`, `topics.config` description.
- **apps/cli/project.json**: Changed `start` target from `nx:run-script` to `nx:run-commands` running `node dist/index.js`. Added new `run-cli` target running `node dist/index.js {args.command}`.
- **apps/cli/src/base-command.ts** (new file, 15 lines): Abstract `BaseCommand` extending `@oclif/core` `Command`. Overrides `catch()` and `finally()` lifecycle hooks, delegating to super.
- **apps/cli/src/index.ts**: Replaced entire Commander setup (42 lines) with 3-line Oclif entry point using `run()`, `handle()`, `flush()`.
- **apps/cli/src/commands/config.ts**: Removed `ConfigOptions` interface and `registerConfigCommand()` function. Replaced with `export default class Config extends BaseCommand`. Flags converted to `Flags.boolean()`/`Flags.string()`. Logic body unchanged.
- **apps/cli/src/commands/create.ts**: Removed `CreateOptions` interface and `registerCreateCommand()`. Added `export default class Create extends BaseCommand` with `strict = false`, `usage`, `examples`. Renamed `prompt` local var to `claudePrompt` to avoid conflict.
- **apps/cli/src/commands/dashboard.ts**: Removed `DashboardOptions` interface and `registerDashboardCommand()`. Added `export default class Dashboard extends BaseCommand`. `--no-open` flag converted to `Flags.boolean({ allowNo: true })`. Logic body unchanged.
- **apps/cli/src/commands/init.ts**: Renamed `InitOptions` to `InitFlags`. Flag access changed from `opts.skipMcp` → `opts['skip-mcp']`, `opts.mcpPath` → `opts['mcp-path']`, `opts.skipAgents` → `opts['skip-agents']` (kebab-case). Converted to Oclif class.
- **apps/cli/src/commands/run.ts**: Converted to Oclif class (similar pattern).
- **apps/cli/src/commands/status.ts**: Removed Commander wrapper, converted to `export default class Status extends BaseCommand`.
- **apps/cli/src/commands/update.ts**: Removed `UpdateOptions` interface. Split `fs` imports (existsSync on line 1, copyFileSync/mkdirSync on line 3). Flag access changed from `opts.dryRun` → `flags['dry-run']`, `opts.regen` → `flags.regen`. Converted to Oclif class.

## Project Conventions

From CLAUDE.md relevant to TypeScript CLI files:
- **Conventional commits with scopes** — git commits must follow conventional commit format
- **Do NOT start git commit/push without explicit user instruction**
- TypeScript is used throughout `apps/cli/`

From review-general.md relevant to TypeScript:
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare.
- **No `any` type ever** — use `unknown` + type guards, or proper generics.
- **No `as` type assertions** — use type guards or generics.
- **String literal unions for status/type/category fields** — never bare `string`.
- **No unused imports or dead code** — if exported but never imported, remove it.
- **Never swallow errors** — at minimum, log them. No empty catch blocks.
- **File Size Limits**: Components max 150 lines, Services/stores max 200 lines.
- **kebab-case** for file names.
- **PascalCase** for classes, interfaces, types, enums.
- **camelCase** for variables, functions, methods.

## Style Decisions from Review Lessons

From review-general.md relevant to this TypeScript CLI migration:
- **Explicit access modifiers on ALL class members** — every method and static property in Oclif command classes must have `public`, `private`, or `protected`. (T03, T04, T07, T09)
- **No `any` type ever** — any untyped catch variables or generic parameters need explicit types. (T01)
- **No unused imports or dead code** — Commander-era types/interfaces that were removed must be fully gone. (T01, T04, T08)
- **Error messages must be human-readable** — not raw exception strings. Wrap at boundaries. (T08, T09)
- **Never swallow errors** — no empty catch blocks; the `BaseCommand.catch()` override calls `super.catch()` which is acceptable delegation, but check other command files.
- **`tsconfig.json` must not disable `noImplicitAny` or `strictNullChecks`** — verify the tsconfig enables `strict: true`. (TASK_2026_086)
- **Missing imports in entry files are compilation blockers** — verify all Oclif command classes are properly discoverable via the `commands` directory config, not explicitly imported in index.ts.

## Scope Boundary (CRITICAL)

Reviewers MUST only flag and fix issues in these files:
- apps/cli/package.json
- apps/cli/project.json
- apps/cli/src/index.ts
- apps/cli/src/base-command.ts
- apps/cli/src/commands/init.ts
- apps/cli/src/commands/run.ts
- apps/cli/src/commands/status.ts
- apps/cli/src/commands/create.ts
- apps/cli/src/commands/config.ts
- apps/cli/src/commands/dashboard.ts
- apps/cli/src/commands/update.ts
- apps/cli/src/utils/ (all utility files — review for unchanged-ness only, no fixes)

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 5
- Minor: 10
