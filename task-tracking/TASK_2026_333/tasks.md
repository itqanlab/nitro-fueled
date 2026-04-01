# Development Tasks - TASK_2026_333

## Batch 1: Wire SupervisorEngine into CLI run command - COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Build mcp-cortex supervisor module and expose exports

**File**: packages/mcp-cortex/package.json
**Status**: COMPLETE

Add `exports` field to expose `./supervisor` and `./process/spawn` sub-paths with proper
type declarations, enabling cross-package imports from the CLI without tsconfig rootDir
violations.

### Task 1.2: Add @itqanlab/nitro-cortex as CLI dependency

**File**: apps/cli/package.json
**Status**: COMPLETE

Add workspace dep so TypeScript can resolve `@itqanlab/nitro-cortex/supervisor` and
`@itqanlab/nitro-cortex/process/spawn` imports.

### Task 1.3: Create engine-output.ts terminal formatter

**File**: apps/cli/src/utils/engine-output.ts (new, 121 lines)
**Status**: COMPLETE

Attaches to SupervisorEngine EventEmitter and renders colored ANSI progress output:
worker spawned/killed events, task transitions, cycle stats, and final session summary.

### Task 1.4: Update run.ts to wire SupervisorEngine

**File**: apps/cli/src/commands/run.ts (modified)
**Status**: COMPLETE

- Added `--engine` flag to both batch and single-task modes
- `runWithEngine()`: opens cortex DB, creates session, builds spawnFn, starts engine, polls until queue empty or task terminal, prints summary
- `buildSpawnFn()`: inserts worker DB row, calls spawnWorkerProcess, wires exit→DB status update
- Graceful SIGINT/SIGTERM: calls engine.stop() (runs orphan guard), then exits
- Existing AI supervisor path preserved as default; engine path activated by `--engine` flag
