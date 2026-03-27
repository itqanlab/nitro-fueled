# Task: `update` Command — Manifest-Based Safe Updates

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P0-Critical |
| Complexity | Medium      |

## Description

Add `npx nitro-fueled update` command that safely updates core agents, skills, and commands to the latest version without overwriting user customizations.

### How it works

Uses the manifest written by `init` (TASK_2026_052) to know what nitro-fueled installed vs what the user has modified. For each core file:

1. **Unchanged** (current checksum matches manifest checksum) → auto-replace with new version, update manifest
2. **User-modified** (checksum differs from manifest) → show a diff, ask user to choose: skip / overwrite / view diff
3. **New file in update** (not in current manifest) → copy automatically, add to manifest

Generated files (AI agents, anti-patterns) are NEVER auto-updated — they are project-specific. User can regenerate them with `--regen` flag.

### Command interface

```
npx nitro-fueled update                  # Update all core files
npx nitro-fueled update --regen          # Also regenerate AI agents + anti-patterns
npx nitro-fueled update --dry-run        # Show what would change, no writes
npx nitro-fueled update -y               # Accept all auto-updates, skip modified
```

### Update output

```
nitro-fueled update
===================
Current version: 1.0.0
Latest version:  1.2.3

Checking core files...
  ✓ .claude/agents/nitro-planner.md           auto-updated (unchanged)
  ✓ .claude/skills/orchestration/SKILL.md     auto-updated (unchanged)
  ~ .claude/agents/nitro-review-lead.md       modified by you — skipped
      → run with --show-diff to review changes
  + .claude/agents/nitro-retrospective.md     new in v1.2.3 — added

Updated: 18 files
Skipped (modified): 1 file
New files added: 1 file

Generated files (not touched):
  .claude/agents/nitro-react-developer.md     (use --regen to regenerate)
  .claude/anti-patterns.md                    (use --regen to regenerate)

Manifest updated to v1.2.3
```

### Implementation

1. **`packages/cli/src/commands/update.ts`** — main command
2. **`packages/cli/src/utils/manifest.ts`** (from TASK_2026_052) — `readManifest`, `writeManifest`, `computeChecksum`
3. **`packages/cli/src/utils/scaffold.ts`** — `getLatestScaffoldFiles()` returns map of path → content from bundled scaffold
4. Diff display: use `diff` stdlib or inline line-by-line comparison

## Dependencies

- TASK_2026_052 (Manifest) must be COMPLETE — `manifest.ts` utilities are required
- TASK_2026_051 (Rename `nitro-*`) must be COMPLETE — manifest keys use new agent names

## Parallelism

**Do NOT run in parallel with any other task.** Modifies `scaffold.ts` and `index.ts` which are touched by other CLI tasks.
Run after TASK_2026_051 completes (Wave 4).

## Acceptance Criteria

- [ ] `npx nitro-fueled update` runs without error
- [ ] Unchanged core files are auto-updated silently
- [ ] Modified core files are reported and skipped (not overwritten)
- [ ] `--dry-run` shows plan without writing any files
- [ ] `--regen` triggers re-run of AI workspace analysis and anti-patterns generation
- [ ] Manifest is updated to new version after successful update
- [ ] New files introduced in the new version are added automatically
- [ ] Generated files are never touched by default
- [ ] TypeScript compiles cleanly

## File Scope

- `packages/cli/src/commands/update.ts` (new)
- `packages/cli/src/utils/manifest.ts` (extends TASK_2026_052)
- `packages/cli/src/utils/scaffold.ts`
- `packages/cli/src/index.ts`
