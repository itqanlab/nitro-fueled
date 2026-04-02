# Handoff — TASK_2026_152

## Files Changed
- `.claude/skills/auto-pilot/SKILL.md` (modified, +18 lines) — HARD RULES updates for Rules #1, #2, #4, #7; Load-on-Demand batch-load rule; Data Access Rules pre-flight row
- `.claude/skills/auto-pilot/references/parallel-mode.md` (modified, +18 lines) — New Pre-Flight Exit Gate section
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` (modified, synced from source)
- `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` (modified, synced from source)

## Commits
- (pending): fix(auto-pilot): strengthen HARD RULES and add pre-flight exit gate for TASK_2026_152

## Decisions
- Added explicit "banned pattern" lists under each HARD RULE rather than just prose descriptions — lists are mechanically verifiable and less ambiguous
- Placed Pre-Flight Exit Gate at the very top of parallel-mode.md so it's the first thing read when loading the reference
- Synced scaffold copies to match source exactly per project convention (`.claude/` and `apps/cli/scaffold/.claude/` must stay byte-for-byte identical)

## Known Risks
- The changes are behavioral spec (markdown) only — no executable code was modified, so there's no runtime regression risk
- Future contributors may add new banned patterns or rules; the explicit list format makes it easy to extend
- The scaffold sync was done manually via `cp` — if `npm run prepare-scaffold` is run later it may overwrite these changes (but should produce identical output since the source files are authoritative)
