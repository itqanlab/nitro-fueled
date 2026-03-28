# Task: Extract libs/worker-core from session-orchestrator

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | REFACTORING  |
| Priority   | P1-High      |
| Complexity | Medium       |
| Model      | default      |
| Testing    | optional     |

## Description

Create a new Nx library package at `libs/worker-core` containing the reusable business logic from `apps/session-orchestrator`. Extract `src/types.ts` (worker and session types) and all files from `src/core/` (file-watcher.ts, iterm-launcher.ts, jsonl-watcher.ts, opencode-launcher.ts, print-launcher.ts, process-launcher.ts, token-calculator.ts, worker-registry.ts) into the new lib. Create `libs/worker-core/src/index.ts` that re-exports all public symbols. Set up `libs/worker-core/package.json` (name: `@nitro-fueled/worker-core`), `project.json` for Nx, and `tsconfig.json`. The library must be independently buildable with `nx build worker-core`.

## Dependencies

- TASK_2026_073 — provides the libs/ directory and updated workspace structure

## Acceptance Criteria

- [ ] `libs/worker-core` package created with `package.json`, `project.json`, `tsconfig.json`, `src/index.ts`
- [ ] All `core/` files and `types.ts` moved from `apps/session-orchestrator/src/` to `libs/worker-core/src/`
- [ ] `libs/worker-core/src/index.ts` exports all public types and classes
- [ ] `nx build worker-core` succeeds with no TypeScript errors
- [ ] Original files removed from `apps/session-orchestrator/src/core/` and `src/types.ts`

## References

- apps/session-orchestrator/src/core/
- apps/session-orchestrator/src/types.ts

## File Scope

- libs/worker-core/package.json
- libs/worker-core/project.json
- libs/worker-core/tsconfig.json
- libs/worker-core/src/index.ts
- libs/worker-core/src/core/ (8 migrated files)
- apps/session-orchestrator/package.json
