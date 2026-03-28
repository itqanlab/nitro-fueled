# Task: Scaffold Oclif CLI app (apps/cli)

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | DEVOPS       |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Generate a new Oclif CLI project at `apps/cli` using `@oclif/core`. Configure the Nx `project.json` with build and run targets. Set up the `oclif` config block in `package.json` (name: `@itqanlab/nitro-fueled`, bin: `nitro-fueled`, commands directory: `./dist/commands`, topics). Create the `BaseCommand` class extending `Command` from `@oclif/core`. The Oclif entry point (`src/index.ts`) uses `@oclif/core`'s `run()`. Copy all 23 utility files from `apps/cli` (old `packages/cli`) `src/utils/` into the new `apps/cli/src/utils/` preserving all filenames and logic exactly — no refactoring of utility code in this task. The published package name (`@itqanlab/nitro-fueled`) and bin name (`nitro-fueled`) must remain unchanged.

## Dependencies

- TASK_2026_073 — provides the apps/ directory and updated workspace structure

## Acceptance Criteria

- [ ] `apps/cli` exists with valid `project.json`, Oclif-configured `package.json`, `tsconfig.json`
- [ ] `package.json` `oclif` block defines `bin`, `commands`, `topics`
- [ ] `BaseCommand` class created extending `@oclif/core` `Command` with shared flag/arg helpers
- [ ] All 23 utility files from old `packages/cli/src/utils/` present in `apps/cli/src/utils/` with no logic changes
- [ ] `node dist/index.js --help` prints the CLI name and placeholder command list without errors

## References

- apps/cli/src/utils/ (old packages/cli)
- apps/cli/package.json (old packages/cli)

## File Scope

- apps/cli/project.json
- apps/cli/package.json
- apps/cli/tsconfig.json
- apps/cli/src/index.ts
- apps/cli/src/base-command.ts
- apps/cli/src/utils/ (all 23 utility files copied)
