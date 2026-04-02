# Handoff — TASK_2026_251

## Files Changed
- packages/mcp-cortex/src/tools/tasks.ts (modified, +97 lines)
- packages/mcp-cortex/src/index.ts (modified, +14 lines)
- packages/mcp-cortex/src/tools/tasks.spec.ts (modified, +75 lines)

## Commits
- (see implementation commit)

## Decisions
- `fields` accepted as JSON string per item (consistent with `update_task`'s existing `fields: z.string()` contract — callers already use `JSON.stringify()`)
- Pre-parse all fields strings before entering the DB transaction so per-item parse errors surface as result items, not a hard abort
- Single DB transaction: valid updates commit atomically; invalid items (bad task_id, bad JSON, bad column, not found) are skipped without rolling back valid ones
- Status files and registry.md written outside the transaction (best-effort, same pattern as `handleUpdateTask`)
- Response shape: `{ succeeded, failed, results[] }` — callers can check summary counts without iterating

## Known Risks
- The `fields` JSON string pattern means callers must `JSON.stringify()` their update objects (consistent with `update_task`, but less ergonomic than native objects). This is a deliberate consistency choice.
