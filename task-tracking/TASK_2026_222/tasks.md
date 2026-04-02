# Development Tasks - TASK_2026_222

## Batch 1: Schema Extension and Tool Files - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Extend schema.ts with 4 new tables

**File**: packages/mcp-cortex/src/db/schema.ts
**Status**: COMPLETE

Added `agents`, `workflows`, `launchers`, and `compatibility` table definitions, corresponding indexes, `seedDefaultWorkflow()` function, and wired all into `initDatabase()`.

### Task 1.2: Create agent-tools.ts

**File**: packages/mcp-cortex/src/tools/agent-tools.ts
**Status**: COMPLETE

CRUD handlers: `handleListAgents`, `handleGetAgent`, `handleCreateAgent`, `handleUpdateAgent`, `handleDeleteAgent`.

### Task 1.3: Create workflow-tools.ts

**File**: packages/mcp-cortex/src/tools/workflow-tools.ts
**Status**: COMPLETE

CRUD handlers: `handleListWorkflows`, `handleGetWorkflow`, `handleCreateWorkflow`, `handleUpdateWorkflow`, `handleDeleteWorkflow`. Default-workflow protection and transactional default clearing.

### Task 1.4: Create launcher-tools.ts

**File**: packages/mcp-cortex/src/tools/launcher-tools.ts
**Status**: COMPLETE

CRUD handlers: `handleListLaunchers`, `handleGetLauncher`, `handleRegisterLauncher`, `handleUpdateLauncher`, `handleDeregisterLauncher`. Upsert semantics for register.

### Task 1.5: Create compatibility-tools.ts

**File**: packages/mcp-cortex/src/tools/compatibility-tools.ts
**Status**: COMPLETE

Handlers: `handleLogCompatibility`, `handleQueryCompatibility`. Query returns records + aggregate summary (success_rate, avg_duration_ms, avg_cost).

### Task 1.6: Register tools in index.ts

**File**: packages/mcp-cortex/src/index.ts
**Status**: COMPLETE

Imported all 4 new tool files and registered 17 new MCP tools (5 agent, 5 workflow, 5 launcher, 2 compatibility).
