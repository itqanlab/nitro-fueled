# Plan — TASK_2026_277: CLAUDE.md Split

## Strategy
FEATURE — direct implementation (clear scope, no ambiguity)

## Architecture

### Problem
Currently `generateClaudeMd` writes full nitro conventions into CLAUDE.md which is user-owned. On update, CLAUDE.md is in `generatedFiles` so update skips it but treats it as nitro-owned.

### Solution
Split into two files:
- `.nitro/CLAUDE.nitro.md` — nitro-managed, contains conventions (coreFile, updated by `nitro-fueled update`)
- `CLAUDE.md` — user-owned, contains only the import line `@./.nitro/CLAUDE.nitro.md`

### Changes

**1. New: `apps/cli/scaffold/.nitro/CLAUDE.nitro.md`**
Static scaffold template with nitro conventions (content from current generateClaudeMd).

**2. Modified: `apps/cli/src/utils/claude-md.ts`**
- Replace `generateClaudeMd(cwd, overwrite)` with `ensureClaudeMdImport(cwd)`
- Logic: if CLAUDE.md missing → create with import line only; if exists → append import line if not present

**3. Modified: `apps/cli/src/commands/init.ts`**
- Add `.nitro/` to `scaffoldFiles()` function
- Call `ensureClaudeMdImport` instead of `generateClaudeMd`
- Remove CLAUDE.md from `generatedFileInfos` (it's user-owned, not generated)
- `.nitro/CLAUDE.nitro.md` lands in `scaffoldedFiles` → auto-tracked in coreFiles
- Update `printSummary` to show `.nitro/CLAUDE.nitro.md` instead of CLAUDE.md

**4. No changes needed to `update.ts`**
`walkScaffoldFiles` will automatically pick up `.nitro/CLAUDE.nitro.md`. Since it won't be in generatedFiles, it'll be processed as a coreFile (auto-updated if unchanged). CLAUDE.md not in scaffold → never touched by update.

## Files Scope
- `apps/cli/scaffold/.nitro/CLAUDE.nitro.md` (new)
- `apps/cli/src/utils/claude-md.ts` (modified)
- `apps/cli/src/commands/init.ts` (modified)
