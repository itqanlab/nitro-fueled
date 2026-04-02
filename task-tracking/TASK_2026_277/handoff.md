# Handoff — TASK_2026_277

## Files Changed
- apps/cli/scaffold/.nitro/CLAUDE.nitro.md (new, 42 lines)
- apps/cli/src/utils/claude-md.ts (rewritten, 37 lines)
- apps/cli/src/commands/init.ts (modified, +14 -7)
- apps/cli/src/utils/scaffold.ts (modified, +30 -7)

## Commits
- (pending — to be committed)

## Decisions
- `.nitro/CLAUDE.nitro.md` placed directly in scaffold as `.nitro/` subdir (not `nitro-root/`). The `walkScaffoldFiles` mapping falls through to default (unchanged path) for `.nitro/` prefix, so update command handles it correctly without additional mapping.
- `generateClaudeMd` replaced by `ensureClaudeMdImport` — non-destructive: appends import line if missing, creates with import line if absent, skips if already present.
- CLAUDE.md removed from `generatedFiles` in manifest — it's now user-owned, not nitro-managed.
- scaffold.ts `resolveScaffoldRoot` fixed to check `nitro/agents` (not `.claude/agents`) since scaffold was already reorganized to `nitro/` structure in a previous task. The `walkScaffoldFiles` function updated to map `nitro/X` → `.claude/X` for the update command.

## Known Risks
- init.ts's explicit `scaffoldSubdir` calls still reference `.claude/agents`, `.claude/skills` etc. paths — these were already broken before this task (scaffold moved to `nitro/`). Pre-existing issue, out of scope for this task.
- The `mapScaffoldRelPath` has a `nitro-root/` mapping that is now dead code (file moved to `.nitro/`), but it's harmless.
