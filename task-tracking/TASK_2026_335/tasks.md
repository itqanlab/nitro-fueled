# Development Tasks - TASK_2026_335

## Batch 1: Dependency Resolver Module - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Implement resolver.ts

**File**: packages/mcp-cortex/src/supervisor/resolver.ts
**Status**: COMPLETE

Pure TypeScript module with:
- `buildAdjacencyList`: builds adjacency map from task deps JSON
- `detectCycles`: iterative DFS cycle detection
- `resolveUnblockedTasks`: filters CREATED tasks with all-terminal deps, sorted by priority
- `markNewlyUnblocked`: returns IDs of tasks unblocked after a specific task completes

### Task 1.2: Implement resolver.spec.ts

**File**: packages/mcp-cortex/src/supervisor/resolver.spec.ts
**Status**: COMPLETE

27 Vitest unit tests covering:
- No deps (immediate unblock)
- Linear chain
- Diamond dependencies
- Cycle detection (self-loop, 2-node, 3-node)
- Mixed statuses
- Priority sorting (P0 > P1 > P2 > P3)
- Malformed JSON deps
- markNewlyUnblocked edge cases
