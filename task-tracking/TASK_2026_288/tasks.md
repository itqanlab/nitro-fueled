# Development Tasks - TASK_2026_288

## Batch 1: Implement MCP artifact CRUD tools - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Create artifacts.ts with 7 write/read pairs + get_task_artifacts

**File**: packages/mcp-cortex/src/tools/artifacts.ts (new, ~290 lines)
**Status**: COMPLETE

Implemented all artifact handler functions following the handoffs.ts pattern:
- handleWriteReview / handleReadReviews (task_reviews table)
- handleWriteTestReport / handleReadTestReport (task_test_reports table)
- handleWriteCompletionReport / handleReadCompletionReport (task_completion_reports table)
- handleWritePlan / handleReadPlan (task_plans table)
- handleWriteTaskDescription / handleReadTaskDescription (task_descriptions table)
- handleWriteContext / handleReadContext (task_contexts table)
- handleWriteSubtasks / handleReadSubtasks (task_subtasks table — full replace semantics)
- handleGetTaskArtifacts (convenience — all artifacts in one call)

Each write handler validates task_id existence inside a transaction before inserting.
Shared helpers: requireTask(), ok(), err(), notFound().

### Task 1.2: Register 16 tools in index.ts

**File**: packages/mcp-cortex/src/index.ts (modified, +140 lines)
**Status**: COMPLETE

Added import of all handlers from artifacts.ts and registered all 16 tools with
zod schemas and descriptions.
