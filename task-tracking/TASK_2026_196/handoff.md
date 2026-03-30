# Handoff — TASK_2026_196

## Summary

Fixed the supervisor's task selection priority so that CREATED (build) tasks are selected before IMPLEMENTED (review) tasks by default, with a configurable `--priority` flag offering three strategies.

## Changes Made

### `.claude/skills/auto-pilot/SKILL.md`
- Added `--priority` row to Configuration table (default: `build-first`)
- Updated Primary Responsibilities item 2 to mention "priority strategy (default: build-first)"
- Changed Key Principle 12 from "Review Workers take priority" to "Build-first by default" with override instructions

### `.claude/skills/auto-pilot/references/parallel-mode.md`
- Rewrote Step 4 (Select Spawn Candidates) to partition candidates into `build_candidates` and `review_candidates` sets
- Added explicit slot-allocation logic for all three strategies:
  - `build-first`: CREATED tasks fill slots first, remaining go to IMPLEMENTED. Guarantees ≥1 build slot.
  - `review-first`: IMPLEMENTED tasks fill slots first, remaining go to CREATED. Guarantees ≥1 review slot.
  - `balanced`: Reserve ≥1 slot each when both sets are non-empty; alternate remaining slots.
- Updated fallback path to apply same strategy instead of hardcoded "prefer review"

### `.claude/commands/nitro-auto-pilot.md`
- Added `--priority` parameter to Parameters table
- Added usage examples for `--priority review-first` and `--priority balanced`
- Added `--priority` parsing in Step 2 argument parsing section
- Updated dry-run example to show Build before Review (reflects new default)

### Scaffold sync
- Mirrored all three files to `apps/cli/scaffold/.claude/`

## Decisions

- Used `--priority` flag with three enum values rather than separate `--review-first` / `--balanced` flags — single flag is easier to parse, validate, and extend.
- In `balanced` mode with `slots = 1` and both candidate sets non-empty, builds get the slot — aligns with the build-first principle that starting new work is the default tiebreaker.
- Did not change the single-task mode behavior — single-task routes to the correct worker type based on the task's current status, independent of priority strategy.

## Known Risks

- The dry-run example in `nitro-auto-pilot.md` now shows build-first ordering, which differs from what existing users may expect. This is intentional and aligns with the new default.
- No runtime TypeScript code was changed — the supervisor is an AI agent following behavioral specs. The priority logic is enforced by the agent reading the updated Step 4 instructions.

## Files Changed

| File | Change |
|------|--------|
| `.claude/skills/auto-pilot/SKILL.md` | Config table, responsibilities, key principle |
| `.claude/skills/auto-pilot/references/parallel-mode.md` | Step 4 rewrite with 3 strategies |
| `.claude/commands/nitro-auto-pilot.md` | Flag docs, usage, parsing, dry-run example |
| `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` | Scaffold sync |
| `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` | Scaffold sync |
| `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` | Scaffold sync |
| `task-tracking/TASK_2026_196/handoff.md` | This file |
| `task-tracking/TASK_2026_196/status` | IMPLEMENTED |
