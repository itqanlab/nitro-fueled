# Development Tasks - TASK_2026_330

## Batch 1: Implement router module — COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Create packages/mcp-cortex/src/supervisor/router.ts

**File**: packages/mcp-cortex/src/supervisor/router.ts
**Status**: COMPLETE

Pure TypeScript module implementing `routeModel()` with:
- Model override (highest priority)
- Tier override (preferred_tier: light/balanced/heavy)
- History-based weighted scoring (success_rate 40%, cost_efficiency 30%, duration_efficiency 30%)
- Worker-type defaults when no history
- Provider availability filtering

### Task 1.2: Create packages/mcp-cortex/src/supervisor/router.spec.ts

**File**: packages/mcp-cortex/src/supervisor/router.spec.ts
**Status**: COMPLETE

22 unit tests covering:
- No history → worker-type defaults for all worker types
- History-based scoring selects highest-scored available provider
- Tier override takes precedence over history
- Model override takes highest precedence
- Unavailable providers excluded from all selection paths
