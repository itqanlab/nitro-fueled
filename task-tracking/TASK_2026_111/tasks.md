# Development Tasks - TASK_2026_111

## Batch 1: Two-Phase Provider Resolver Engine - IMPLEMENTED

**Developer**: nitro-backend-developer

### Task 1.1: Add `resolveProviderForTier` to complexity-estimator.ts

**File**: apps/cli/src/utils/complexity-estimator.ts
**Status**: IMPLEMENTED

### Task 1.2: Update create.ts to embed Phase 1 provider/model suggestion

**File**: apps/cli/src/commands/create.ts
**Status**: IMPLEMENTED

### Task 1.3: Add `launchWithCodex` to worker-core

**File**: libs/worker-core/src/core/codex-launcher.ts (new)
**Status**: IMPLEMENTED

### Task 1.4: Update worker-core types.ts to add 'codex' to Provider and LauncherMode

**File**: libs/worker-core/src/types.ts
**Status**: IMPLEMENTED

### Task 1.5: Export codex launcher from worker-core index.ts

**File**: libs/worker-core/src/index.ts
**Status**: IMPLEMENTED

### Task 1.6: Add Phase 2 re-validation to spawn-worker.ts

**File**: apps/session-orchestrator/src/tools/spawn-worker.ts
**Status**: IMPLEMENTED
