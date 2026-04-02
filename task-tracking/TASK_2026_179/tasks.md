# Development Tasks - TASK_2026_179

## Batch 1: Replace console.log/error with structured loggers — COMPLETE

**Developer**: nitro-backend-developer (dashboard-api), nitro-systems-developer (CLI + MCP)

### Task 1.1: dashboard-api — NestJS Logger

**Files**: apps/dashboard-api/src/main.ts, apps/dashboard-api/src/dashboard/orchestration/flow-metadata.service.ts
**Status**: COMPLETE

### Task 1.2: CLI — Create logger utility and replace calls

**Files**: apps/cli/src/utils/logger.ts (new), apps/cli/src/commands/*.ts, apps/cli/src/utils/*.ts
**Status**: COMPLETE

### Task 1.3: MCP Cortex — Create stderr logger and replace calls

**Files**: packages/mcp-cortex/src/utils/logger.ts (new), packages/mcp-cortex/src/index.ts, packages/mcp-cortex/src/tools/*.ts, packages/mcp-cortex/src/process/*.ts
**Status**: COMPLETE
