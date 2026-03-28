# Development Tasks - TASK_2026_074

## Batch 1: Create libs/worker-core package - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Create libs/worker-core package config files

**File**: libs/worker-core/package.json, libs/worker-core/tsconfig.json, libs/worker-core/project.json
**Status**: COMPLETE

### Task 1.2: Migrate types.ts to libs/worker-core/src/types.ts

**File**: libs/worker-core/src/types.ts
**Status**: COMPLETE

### Task 1.3: Migrate core/ files to libs/worker-core/src/core/

**File**: libs/worker-core/src/core/ (9 files: event-queue.ts, file-watcher.ts, iterm-launcher.ts, jsonl-watcher.ts, opencode-launcher.ts, print-launcher.ts, process-launcher.ts, token-calculator.ts, worker-registry.ts)
**Status**: COMPLETE

### Task 1.4: Create libs/worker-core/src/index.ts with all public exports

**File**: libs/worker-core/src/index.ts
**Status**: COMPLETE

### Task 1.5: Update apps/session-orchestrator to import from @nitro-fueled/worker-core

**File**: apps/session-orchestrator/src/index.ts, apps/session-orchestrator/src/tools/*.ts
**Status**: COMPLETE

### Task 1.6: Update apps/session-orchestrator/package.json dependency

**File**: apps/session-orchestrator/package.json
**Status**: COMPLETE

### Task 1.7: Remove original core/ and types.ts from apps/session-orchestrator/src/

**File**: apps/session-orchestrator/src/core/ (removed), apps/session-orchestrator/src/types.ts (removed)
**Status**: COMPLETE

### Task 1.8: Verify nx build worker-core and nx build session-orchestrator succeed

**File**: N/A (build verification)
**Status**: COMPLETE
