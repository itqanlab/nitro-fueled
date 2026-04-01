# Development Tasks - TASK_2026_338

## Batch 1: Implement SupervisorEngine core loop — COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Append SupervisorEngine class to engine.ts

**File**: packages/mcp-cortex/src/supervisor/engine.ts
**Status**: COMPLETE

Appended the SupervisorEngine class (≈400 new lines) after the existing prompt builder
utility in engine.ts. The class:
- Extends EventEmitter, wires all 4 Wave 1 modules
- Injectable SpawnFn for testability
- Deterministic setInterval loop: health→budget→reconcile→spawn
- Startup recovery via recoverStaleSession
- Orphan guard on stop()
- Fixed _queryAllActiveTasks() to include COMPLETE/CANCELLED tasks so resolver
  can correctly evaluate dependency terminal statuses

### Task 1.2: Append SupervisorEngine tests to engine.spec.ts

**File**: packages/mcp-cortex/src/supervisor/engine.spec.ts
**Status**: COMPLETE

Appended 14 SupervisorEngine tests (491 new lines) covering all 4 acceptance criteria.
Custom lightweight DB setup avoids a pre-existing schema.ts index ordering bug.

### Task 1.3: Create index.ts

**File**: packages/mcp-cortex/src/supervisor/index.ts
**Status**: COMPLETE

Re-exports all Wave 1 module functions and types plus SupervisorEngine.
