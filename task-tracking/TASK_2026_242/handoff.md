# Handoff — TASK_2026_242

## Files Changed
- .claude/skills/auto-pilot/references/parallel-mode.md (modified, +55 -10)

## Commits
- (see implementation commit)

## Decisions
- Added "Startup IMPLEMENTED Orphan Detection" block at the end of Step 1 (after the 5 DB-call steps). Kept it as best-effort / log-only since the normal Step 3/4 queue routing already picks up IMPLEMENTED tasks on startup — this just adds observability.
- Added "Pre-Exit IMPLEMENTED Orphan Guard" as a mandatory subsection of Step 8. The guard runs before ALL stop conditions, including --limit-reached. If orphaned IMPLEMENTED tasks exist and slots are available, it overrides the stop and spawns review workers + continues the loop. If slots are zero, it records a HANDOFF_WARNING event and allows the stop.
- Fixed a duplicate "Fallback path (`cortex_available = false`)" heading by renaming the Step 8 stop fallback to "Step 8 stop — fallback path".

## Known Risks
- The guard uses data already fetched in Step 8's re-query (`get_tasks` + `list_workers`), so no extra DB calls are introduced. The risk of false positives (spawning a duplicate review worker) is mitigated by the existing Duplicate Spawn Guard in Step 5.
- The "slots == 0" path at pre-exit is rare in practice (no active workers + no slots doesn't make sense in isolation). It's included for completeness when --limit fires mid-batch with all slots consumed.
