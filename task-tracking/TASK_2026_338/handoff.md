# Handoff — TASK_2026_338

## Files Changed
- packages/mcp-cortex/src/supervisor/engine.ts (modified, +412 lines)
- packages/mcp-cortex/src/supervisor/engine.spec.ts (modified, +491 lines)
- packages/mcp-cortex/src/supervisor/index.ts (new, 37 lines)

## Commits
- (see implementation commit)

## Decisions
- SupervisorEngine is appended to the existing engine.ts which already contained the prompt builder utility, not a new file, as noted in the task description comment
- `spawnFn` is required (not optional) in EngineConfig — makes the dependency explicit and keeps engine testable without real subprocess spawning
- `_queryAllActiveTasks()` queries tasks WHERE status != 'ARCHIVE' (not just CREATED/IN_PROGRESS) — the resolver needs complete/cancelled task statuses to evaluate dependency chains
- Test DB uses a custom schema setup to avoid a pre-existing `initDatabase()` index ordering bug (idx_tasks_parent created before ALTER TABLE adds parent_task_id)
- Workers in tests use `pid = process.pid` to survive startup recovery (which kills workers with null/dead PIDs)
- Startup recovery test uses `concurrencyLimit: 0` to prevent a fresh spawn from overwriting the CREATED status assertion

## Known Risks
- `_claimTask` is a simple SQL UPDATE without DB-level locking beyond SQLite's serialized writes — adequate for single-process use, would need revisiting for multi-process scenarios
- The engine emits `cycle:end` even if an exception occurs mid-cycle (caught in try/catch) — callers should handle partial cycle stats gracefully
