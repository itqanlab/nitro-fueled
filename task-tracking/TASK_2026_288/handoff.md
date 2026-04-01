# Handoff — TASK_2026_288

## Files Changed
- packages/mcp-cortex/src/tools/artifacts.ts (new, ~290 lines)
- packages/mcp-cortex/src/index.ts (modified, +140 lines)

## Commits
- (see implementation commit)

## Decisions
- write_subtasks uses full-replace semantics (DELETE + INSERT in one transaction) rather than append. This matches the "write full batch list" description and avoids stale subtask entries from previous runs.
- read_reviews returns ALL reviews for a task (not just latest) because a task can have multiple review types (style, logic, security). All other read_* tools return only the latest record.
- requireTask() is a shared helper that runs a SELECT inside the calling transaction to atomically validate FK + insert, preventing race conditions (follows the handoffs.ts pattern).
- Shared ok(), err(), notFound() helpers keep each handler ~10 lines, avoiding boilerplate repetition.
- All write handlers use db.transaction() for atomic FK validation + insert.

## Known Risks
- write_subtasks does a full DELETE + re-insert. If a caller sends a partial list by mistake, existing subtasks are lost. The tool description warns about this.
- The task_subtasks table in this module is separate from the subtask_tools.ts subtask-trees feature (which uses a tasks table with parent_task_id). These are different schemas — task_subtasks is the flat artifact table from TASK_2026_287, subtask-tools.ts handles hierarchical task decomposition.
