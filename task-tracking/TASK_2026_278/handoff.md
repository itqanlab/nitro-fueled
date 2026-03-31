# Handoff — TASK_2026_278

## Files Changed
- apps/cli/scaffold/nitro/ (renamed from scaffold/.claude/, committed in prior session)
- apps/cli/scaffold/nitro-root/CLAUDE.nitro.md (new, moved from scaffold/.nitro/ which was gitignored)
- apps/cli/src/utils/scaffold.ts (modified: resolveScaffoldRoot checks nitro/agents, new mapScaffoldRelPath(), walkScaffoldFiles applies mapping, scaffoldSubdir gets optional destSubdir)
- apps/cli/src/commands/init.ts (modified: all scaffoldSubdir calls updated to nitro/ source + .claude/ dest; nitro-root → .nitro mapping added; anti-patterns-master path updated)
- apps/cli/src/utils/anti-patterns.ts (modified: masterPath now resolves from nitro/nitro-anti-patterns-master.md)
- apps/cli/src/utils/claude-md.ts (modified: generateClaudeMd replaced by ensureClaudeMdImport)

## Commits
- (implementation commit — see git log for TASK_2026_278)

## Decisions
- scaffold/nitro/ maps to .claude/ in target; scaffold/nitro-root/ maps to .nitro/ in target
- mapScaffoldRelPath() encapsulates the mapping logic for reuse in walkScaffoldFiles and any future callers
- anti-patterns file renamed to nitro-anti-patterns-master.md (TASK_2026_279 prefix convention)
- update.ts required no changes — walkScaffoldFiles() now returns target-relative paths automatically

## Known Risks
- nitro-root/ directory had .nitro/ as gitignored predecessor; CLAUDE.nitro.md content was preserved
- resolveScaffoldRoot() probe checks for nitro/agents existence — if agent dir is ever removed/renamed, detection breaks
