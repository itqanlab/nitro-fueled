# Development Tasks - TASK_2026_250

## Batch 1: Session Cost Breakdown — COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Add CostBreakdown type to cortex.types.ts

**File**: apps/dashboard-api/src/dashboard/cortex.types.ts
**Status**: COMPLETE

Added `CostBreakdown` interface with `supervisor_cost`, `worker_cost_by_model`, and `total_cost` fields.
Extend `CortexSessionSummary` with `cost_breakdown: CostBreakdown | null`.
Added `supervisor_cost_usd` and `worker_costs_json` to `RawSession` for the new DB columns.

### Task 1.2: Extend SESSION_COLS and querySessionSummary

**File**: apps/dashboard-api/src/dashboard/cortex-queries-task.ts
**Status**: COMPLETE

Added `supervisor_cost_usd` and `worker_costs_json` to `SESSION_COLS`.
Updated `querySessionSummary` to compute `cost_breakdown` from workers' `cost_json` and the session's stored breakdown columns, mirroring the logic in the MCP `get_session_summary` tool.
Handles null data gracefully (defaults to 0 when columns are missing).
