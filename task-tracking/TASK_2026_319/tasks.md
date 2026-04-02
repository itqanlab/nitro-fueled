# TASK_2026_319 — Tasks

## Status: IMPLEMENTED

## Tasks Completed

### Task 1: Add `session_evaluations` table to schema.ts
- File: `packages/mcp-cortex/src/db/schema.ts`
- Added `SESSION_EVALUATIONS_TABLE` constant with the full DDL
- Added `idx_session_evaluations_session` to the `INDEXES` array
- Added `db.exec(SESSION_EVALUATIONS_TABLE)` inside `initDatabase()` after `TASK_SUBTASKS_TABLE`

### Task 2: Add `handleEvaluateSession` to sessions.ts
- File: `packages/mcp-cortex/src/tools/sessions.ts`
- Implements 4-dimension scoring (Quality 35%, Efficiency 30%, Process 20%, Outcome 15%)
- Validates session_id via `normalizeSessionId`, returns early if invalid or session not found
- Queries reviews, workers, phases, handoffs tables for signal data
- Inserts result into `session_evaluations` table
- Returns full score_card, signals breakdown, and evaluation_id

### Task 3: Register `evaluate_session` tool in index.ts
- File: `packages/mcp-cortex/src/index.ts`
- Added `handleEvaluateSession` to the sessions import line
- Registered tool after `get_session_telemetry` with description and inputSchema
