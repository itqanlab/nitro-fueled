# Task: Migrate create + dashboard + config + update commands to Oclif

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Migrate the remaining 4 CLI commands (`create`, `dashboard`, `config`, `update`) from Commander.js to Oclif command classes following the same pattern established in TASK_2026_090. Each command becomes a class extending `BaseCommand`. Preserve all flags, argument handling, interactive prompts, and logic. After all 4 commands are migrated, replace the old Commander-based `src/index.ts` entry point with the Oclif `run()` entry. Verify the complete CLI: all 7 commands respond to `--help` correctly and execute their core logic without runtime errors.

## Dependencies

- TASK_2026_090 — provides the Oclif command pattern for init/run/status to follow

## Acceptance Criteria

- [ ] `CreateCommand`, `DashboardCommand`, `ConfigCommand`, `UpdateCommand` created as Oclif command classes
- [ ] All flags and arguments match the existing Commander implementation's public interface
- [ ] Old Commander `src/index.ts` entry point replaced with `@oclif/core` `run()` entry
- [ ] `nitro-fueled --help` lists all 7 commands with descriptions
- [ ] `nitro-fueled config --help` and `nitro-fueled update --help` show correct flag descriptions

## References

- apps/cli/src/commands/create.ts (old packages/cli)
- apps/cli/src/commands/dashboard.ts (old packages/cli)
- apps/cli/src/commands/config.ts (old packages/cli)
- apps/cli/src/commands/update.ts (old packages/cli)

## File Scope

- apps/cli/src/commands/create.ts
- apps/cli/src/commands/dashboard.ts
- apps/cli/src/commands/config.ts
- apps/cli/src/commands/update.ts
- apps/cli/src/index.ts
