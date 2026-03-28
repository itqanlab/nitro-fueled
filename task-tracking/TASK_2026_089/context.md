# Context — TASK_2026_089

## User Intent

Migrate `apps/cli` from Commander.js to `@oclif/core`. The existing project already has:
- 7 commands in `src/commands/` (Commander-based `registerXxxCommand` pattern)
- 23 utility files in `src/utils/` (no changes needed)
- `project.json`, `tsconfig.json`, `package.json` (need updates)

## Strategy

DEVOPS — package configuration + command migration

## What Needs to Change

1. **package.json**: Replace `commander` with `@oclif/core`, add `oclif` config block
2. **project.json**: Add Oclif-aware build/run targets
3. **tsconfig.json**: Verify compatibility (already Node16/ESM, should work)
4. **src/base-command.ts**: Create `BaseCommand` class extending `@oclif/core` `Command`
5. **src/index.ts**: Replace Commander `program.parseAsync()` with Oclif `run()`
6. **src/commands/*.ts**: Convert each command from Commander `registerXxx` function to Oclif class

## What Stays the Same

- All 23 utility files in `src/utils/` — zero changes
- Business logic inside each command's action handler — zero refactoring
- Published package name (`@itqanlab/nitro-fueled`) and bin name (`nitro-fueled`)

## Key Oclif Patterns

- Entry point: `import { run, handle, flush } from '@oclif/core'; await run(...).catch(handle).finally(flush)`
- Commands: `export default class Init extends BaseCommand { static flags = {...}; async run() {...} }`
- Oclif auto-discovers commands from `./dist/commands` directory
- `Flags.boolean()`, `Flags.string()` for options; `Args.string()` for positional args
