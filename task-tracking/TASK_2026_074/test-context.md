# Test Context — TASK_2026_074

## Task Info
- Task ID: 2026_074
- Task type: REFACTORING
- Testing override: optional

## Detected Frameworks
- Primary: none
- E2E: none

## Test Types Required
- Unit Tests: no (no framework detected)
- Integration Tests: no (no framework detected)
- E2E Tests: no (no framework detected)

## File Scope
**Created:**
- libs/worker-core/package.json
- libs/worker-core/project.json
- libs/worker-core/tsconfig.json
- libs/worker-core/src/index.ts
- libs/worker-core/src/types.ts (moved from apps/session-orchestrator/src/types.ts)
- libs/worker-core/src/core/event-queue.ts (moved)
- libs/worker-core/src/core/file-watcher.ts (moved)
- libs/worker-core/src/core/iterm-launcher.ts (moved)
- libs/worker-core/src/core/jsonl-watcher.ts (moved)
- libs/worker-core/src/core/opencode-launcher.ts (moved)
- libs/worker-core/src/core/print-launcher.ts (moved)
- libs/worker-core/src/core/process-launcher.ts (moved)
- libs/worker-core/src/core/token-calculator.ts (moved)
- libs/worker-core/src/core/worker-registry.ts (moved)

**Modified:**
- apps/session-orchestrator/package.json
- apps/session-orchestrator/src/index.ts
- apps/session-orchestrator/src/tools/spawn-worker.ts
- apps/session-orchestrator/src/tools/subscribe-worker.ts
- apps/session-orchestrator/src/tools/get-pending-events.ts

**Removed:**
- apps/session-orchestrator/src/core/ (all 9 files migrated to libs/worker-core)
- apps/session-orchestrator/src/types.ts (migrated to libs/worker-core)

## Test Command
none — no test framework detected
