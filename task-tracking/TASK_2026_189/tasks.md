# Development Tasks - TASK_2026_189

## Batch 1: Audit and fix JSON.parse safety - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Audit all JSON.parse calls in packages/mcp-cortex/src/

**Status**: COMPLETE

Audited 30 JSON.parse calls across 10 source files. Found only 1 unguarded call (wave.ts:33) and 2 silent catches that should log warnings (context.ts).

### Task 1.2: Wrap unguarded JSON.parse in wave.ts

**File**: packages/mcp-cortex/src/tools/wave.ts
**Status**: COMPLETE

Added try/catch around `JSON.parse(task.dependencies)` with safe default (empty array) and console.error logging.

### Task 1.3: Add warning logs to silent catches in context.ts

**File**: packages/mcp-cortex/src/tools/context.ts
**Status**: COMPLETE

Added console.error warnings to previously silent catch blocks for file_scope and dependencies parsing.

### Task 1.4: Verify build passes

**Status**: COMPLETE

`npm run build` passes with zero errors.
