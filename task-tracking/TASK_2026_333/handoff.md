# Handoff — TASK_2026_333

## Files Changed
- apps/cli/src/commands/run.ts (modified, +256 lines net)
- apps/cli/src/utils/engine-output.ts (new, 121 lines)
- apps/cli/package.json (modified, +1 dependency)
- packages/mcp-cortex/package.json (modified, +11 lines — exports field)

## Commits
- (see implementation commit)

## Decisions
- Preserved the existing AI supervisor (spawnClaude) as default batch path; engine mode requires explicit `--engine` flag. This avoids breaking existing workflows while the engine matures.
- "Queue done" in single-task engine mode is defined as: task leaves CREATED/IN_PROGRESS state. This covers IMPLEMENTED, FAILED, BLOCKED — the engine handles build workers only (review phase is a future task).
- Used ANSI escape codes directly in engine-output.ts rather than adding chalk/ora as deps, keeping the CLI dependency footprint minimal.
- spawnWorkerProcess is imported from @itqanlab/nitro-cortex/process/spawn (not inlined) since it handles provider-specific spawn logic (claude, glm, opencode, codex).
- Updated workers table `updated_at` column in exit callback; this column exists in the schema migrations.

## Known Risks
- The workers table insert in buildSpawnFn uses `updated_at` in the onExit update — this column is added via migration; older DBs without migration applied may fail silently (caught and logged).
- Single-task engine mode does NOT run review workers (engine only spawns build workers). The task will stop at IMPLEMENTED, not COMPLETE. This is expected behavior until review worker spawning is wired.
- The poll interval for "queue done" is hardcoded to 5s regardless of the `--interval` flag value. The engine itself uses the interval flag for its internal cycle.
