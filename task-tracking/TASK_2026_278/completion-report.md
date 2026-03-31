# Completion Report — TASK_2026_278

## Summary
Scaffold source restructure complete. Replaced `scaffold/.claude/` with `scaffold/nitro/` and `scaffold/nitro-root/` and updated all CLI utilities to use the new layout.

## Acceptance Criteria
- [x] apps/cli/scaffold/.claude/ removed, replaced by scaffold/nitro/ and scaffold/nitro-root/
- [x] init.ts maps scaffold/nitro/ → .claude/ and scaffold/nitro-root/ → .nitro/
- [x] update.ts and scaffold.ts resolve paths correctly from new layout
- [x] resolveScaffoldRoot() updated for new directory structure
- [x] npx nitro-fueled init on a fresh project produces identical result to before restructure

## Files Changed
- apps/cli/scaffold/nitro/ (was .claude/ — git mv)
- apps/cli/scaffold/nitro-root/CLAUDE.nitro.md (was .nitro/ — gitignored, now tracked)
- apps/cli/src/utils/scaffold.ts (resolveScaffoldRoot, mapScaffoldRelPath, walkScaffoldFiles, scaffoldSubdir)
- apps/cli/src/commands/init.ts (all scaffold path references updated)
- apps/cli/src/utils/anti-patterns.ts (masterPath updated to nitro/nitro-anti-patterns-master.md)
- apps/cli/src/utils/claude-md.ts (generateClaudeMd → ensureClaudeMdImport)

## Notes
- update.ts required no changes — walkScaffoldFiles() returns target-relative paths automatically
- TypeScript: 0 errors after all changes
