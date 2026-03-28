# Task: Migrate init + run + status commands to Oclif

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Migrate the `init`, `run`, and `status` commands from the Commander.js pattern (functions registered on a `program` object) to Oclif command classes. Each command becomes a standalone class in `apps/cli/src/commands/` that extends `BaseCommand`. The public CLI interface (flag names, argument positions, help text) must be identical to the current Commander implementation. The `--commit` flag on `init` must be preserved. All existing logic moves into the `run()` method of each class — no behavioral changes. The Commander-style `registerXCommand` wrapper functions are deleted from each file.

## Dependencies

- TASK_2026_089 — provides the Oclif scaffold and BaseCommand class

## Acceptance Criteria

- [ ] `InitCommand`, `RunCommand`, `StatusCommand` created as Oclif command classes in `src/commands/`
- [ ] All flags preserved with identical names and behaviors (e.g., `--commit` on init)
- [ ] `nitro-fueled init --help`, `nitro-fueled run --help`, `nitro-fueled status --help` output correct flag descriptions
- [ ] `nitro-fueled init` executes scaffold behavior correctly in a test directory
- [ ] No Commander imports or `registerXCommand` patterns remain in these 3 files

## References

- apps/cli/src/commands/init.ts (old packages/cli)
- apps/cli/src/commands/run.ts (old packages/cli)
- apps/cli/src/commands/status.ts (old packages/cli)

## File Scope

**Verified (no changes needed)**: Commands already migrated to Oclif:
- `apps/cli/src/commands/init.ts` - `export default class Init extends BaseCommand`
- `apps/cli/src/commands/run.ts` - `export default class Run extends BaseCommand`
- `apps/cli/src/commands/status.ts` - `export default class Status extends BaseCommand`
- `apps/cli/src/base-command.ts` - Base class extending `@oclif/core` Command

All files use Oclif patterns (Flags, Args from `@oclif/core`), no Commander.js imports remain.
