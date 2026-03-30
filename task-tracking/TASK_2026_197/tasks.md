# Development Tasks - TASK_2026_197

## Batch 1: Prevent COMPLETE status overflow - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Add bounded `limit` handling in task queries

**File**: `packages/mcp-cortex/src/tools/tasks.ts`
**Status**: COMPLETE

### Task 1.2: Expose `limit` in MCP tool schemas

**File**: `packages/mcp-cortex/src/index.ts`
**Status**: COMPLETE

### Task 1.3: Add regression tests for `limit`

**File**: `packages/mcp-cortex/src/tools/tasks.spec.ts`
**Status**: COMPLETE

### Task 1.4: Update supervisor guidance to avoid `get_tasks(status: "COMPLETE")`

**File**: `.claude/skills/auto-pilot/references/cortex-integration.md`, `.claude/skills/auto-pilot/references/parallel-mode.md`, `apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md`, `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`
**Status**: COMPLETE
