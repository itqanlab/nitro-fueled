# Task: Refactor session-orchestrator app to consume worker-core

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P1-High      |
| Complexity | Simple       |
| Model      | default      |
| Testing    | skip         |

## Description

Update `apps/session-orchestrator` to import from `@nitro-fueled/worker-core` instead of the now-deleted local `src/core/` and `src/types.ts` paths. Add `@nitro-fueled/worker-core` as a workspace dependency in `apps/session-orchestrator/package.json`. Update all import statements in `src/index.ts` and the 3 tool handler files (`src/tools/get-pending-events.ts`, `src/tools/spawn-worker.ts`, `src/tools/subscribe-worker.ts`). Verify the MCP server starts correctly after the refactor.

## Dependencies

- TASK_2026_074 — provides the @nitro-fueled/worker-core lib this task imports from

## Acceptance Criteria

- [ ] `@nitro-fueled/worker-core` added to session-orchestrator's `package.json` dependencies
- [ ] All imports in `src/index.ts` and `src/tools/` updated to use `@nitro-fueled/worker-core`
- [ ] No remaining imports from `./core/` or local `./types` in session-orchestrator
- [ ] `nx build session-orchestrator` succeeds with no TypeScript errors
- [ ] MCP server starts without runtime errors (`node dist/index.js`)

## References

- apps/session-orchestrator/src/index.ts
- apps/session-orchestrator/src/tools/

## File Scope

(N/A - refactor was already complete; no changes needed)
- apps/session-orchestrator/src/index.ts — already using @nitro-fueled/worker-core imports
- apps/session-orchestrator/src/tools/get-pending-events.ts — already using @nitro-fueled/worker-core imports
- apps/session-orchestrator/src/tools/spawn-worker.ts — already using @nitro-fueled/worker-core imports
- apps/session-orchestrator/src/tools/subscribe-worker.ts — already using @nitro-fueled/worker-core imports
- apps/session-orchestrator/package.json — already has @nitro-fueled/worker-core dependency
