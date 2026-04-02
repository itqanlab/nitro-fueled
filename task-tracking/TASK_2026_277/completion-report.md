# Completion Report — TASK_2026_277

## Files Created
- apps/cli/scaffold/nitro-root/CLAUDE.nitro.md (42 lines)

## Files Modified
- apps/cli/src/utils/claude-md.ts — replaced `generateClaudeMd` with `ensureClaudeMdImport`
- apps/cli/src/commands/init.ts — scaffold `.nitro/`, call `ensureClaudeMdImport`, remove CLAUDE.md from generatedFiles
- apps/cli/src/utils/scaffold.ts — fix `resolveScaffoldRoot` for `nitro/` scaffold structure, add `mapScaffoldRelPath`, add `destSubdir` to `scaffoldSubdir`

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | N/A (reviews skipped per user instruction) |
| Code Logic | N/A |
| Security | N/A |

## Findings Fixed
- N/A (reviews skipped)

## New Review Lessons Added
- none

## Integration Checklist
- [x] `ensureClaudeMdImport` exported and imported in init.ts
- [x] Scaffold file at `apps/cli/scaffold/nitro-root/CLAUDE.nitro.md` tracked in git
- [x] `resolveScaffoldRoot` fixed to check `nitro/agents` (matching actual scaffold structure)
- [x] `mapScaffoldRelPath` maps `nitro-root/` → `.nitro/` for update command's `walkScaffoldFiles`
- [x] CLAUDE.md removed from `generatedFiles` in manifest — user-owned
- [x] `.nitro/CLAUDE.nitro.md` auto-tracked as coreFile via `scaffoldedFiles` path

## Verification Commands
```bash
grep -n "ensureClaudeMdImport" apps/cli/src/commands/init.ts
grep -n "ensureClaudeMdImport" apps/cli/src/utils/claude-md.ts
ls apps/cli/scaffold/nitro-root/
grep -n "nitro-root" apps/cli/src/commands/init.ts
grep -n "mapScaffoldRelPath\|nitro-root" apps/cli/src/utils/scaffold.ts
```

## Notes
- Implementation was accidentally committed by TASK_2026_178 worker (parallel execution, staged files picked up). Code is correct and committed.
- The scaffold file at `nitro-root/CLAUDE.nitro.md` was also committed by TASK_2026_279 worker (coincidental staging during parallel runs).
- init.ts was also updated to use `nitro/agents` (instead of `.claude/agents`) with the new `destSubdir` parameter — fixing a pre-existing broken reference.
