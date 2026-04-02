# Development Tasks - TASK_2026_270

## Batch 1: Launcher-aware spawn_worker and get_available_providers — COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Add launcher param to handleSpawnWorker in workers.ts

**File**: packages/mcp-cortex/src/tools/workers.ts
**Notes**: Added `launcher?: string` to args interface. When `launcher === 'codex'` → sets provider = 'codex'; when `launcher === 'opencode'` → sets provider = 'opencode'; when 'claude-code' or absent → keeps provider-based selection (defaults to 'claude').
**Status**: COMPLETE

### Task 1.2: Register launcher param in spawn_worker MCP tool schema

**File**: packages/mcp-cortex/src/index.ts
**Notes**: Added `launcher: z.enum(['claude-code', 'codex', 'opencode']).optional()` to the spawn_worker inputSchema. Updated tool description.
**Status**: COMPLETE

### Task 1.3: Normalize launcher names in get_available_providers

**File**: packages/mcp-cortex/src/tools/providers.ts
**Notes**: Added toClientLauncherName() function mapping 'claude' → 'claude-code' and 'glm' → 'claude-code'. Applied to all ProviderResult entries including disabled providers.
**Status**: COMPLETE

### Task 1.4: Unit tests for launcher param in spawn_worker

**File**: packages/mcp-cortex/src/tools/workers.spec.ts
**Notes**: Added 3 tests: launcher=codex sets provider=codex; absent launcher defaults to claude; launcher=claude-code explicitly sets claude provider. All 20 tests pass.
**Status**: COMPLETE
