# Handoff — TASK_2026_256

## Files Changed
- packages/mcp-cortex/src/tools/tasks.ts (modified, +35 lines — added handleGetBacklogSummary export)
- packages/mcp-cortex/src/index.ts (modified, +10 lines — import + tool registration)

## Commits
- (pending)

## Decisions
- Added `handleGetBacklogSummary` directly in tasks.ts alongside `handleGetTasks` — no new file needed for a 35-line function.
- Status-only path: single GROUP BY query on status, returns flat object. Worst-case response is ~186 chars (12 statuses × ~15 chars each + total).
- Priority path: nested breakdown with `by_priority` key, still compact (no long strings).
- Input uses `z.enum(['priority']).optional()` — only valid value is 'priority', keeping the interface tight.

## Known Risks
- Response size for `group_by=priority` could grow if many priority values exist in the DB, but in practice the priority enum has 4 values (P0-Critical..P3-Low) so worst case is still well under 500 chars.
