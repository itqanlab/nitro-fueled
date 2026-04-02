# Handoff — TASK_2026_284

## Files Changed
- apps/cli/src/utils/merge.ts (new, ~170 lines) — threeWayMerge + aiAssistMerge utilities
- apps/cli/src/utils/manifest.ts (modified) — CoreFileEntry gains scaffoldContent?, buildCoreFileEntry stores base content
- apps/cli/src/commands/update.ts (modified) — --ai-merge flag, merge outcomes, processScaffoldFiles wired to merge

## Commits
(pending — part of implementation commit)

## Decisions
- Scaffold content stored inline in manifest.json (capped at 200 KB) rather than in separate .nitro-fueled/bases/ dir — simpler, no extra file management
- AI merge uses `spawnSync('claude', ['--print'])` with stdin pipe — reuses Claude CLI already required by the tool, no Anthropic SDK dependency added
- Conflict outcome leaves file untouched (user must resolve manually) — safe default
- Old manifest entries without scaffoldContent fall back to 'skipped' — no regression for existing installs

## Known Risks
- LCS diff is O(mn) — fine for typical agent files (<500 lines) but slow for very large files; mitigated by 200 KB content cap
- AI merge quality depends on Claude availability and prompt quality; failure mode is explicit (returns 'conflict')
