# Review Context — TASK_2026_075

## Task Scope
- Task ID: 2026_075
- Task type: REFACTORING
- Files in scope: (these are the ONLY files reviewers may touch)
  - apps/session-orchestrator/src/index.ts
  - apps/session-orchestrator/src/tools/get-pending-events.ts
  - apps/session-orchestrator/src/tools/spawn-worker.ts
  - apps/session-orchestrator/src/tools/subscribe-worker.ts
  - apps/session-orchestrator/package.json

**Note:** The Build Worker (GLM glm-4.7) verified the refactor was already complete — no source file changes were made in TASK_2026_075 itself. The implementation commit `2df181a` only updated `task-tracking/TASK_2026_075/status` and `task-tracking/TASK_2026_075/task.md`. The actual import migration was performed in commit `b039b03` (TASK_2026_074 refactor). This review verifies the current state of the files against the task's acceptance criteria.

## Git Diff Summary

The import migration diff (from commit `b039b03`) shows what changed in these files:

### apps/session-orchestrator/package.json
- Replaced `"chokidar": "^4.0.3"` with `"@nitro-fueled/worker-core": "*"` in dependencies

### apps/session-orchestrator/src/index.ts
- Replaced 5 separate local imports (`./core/worker-registry.js`, `./core/jsonl-watcher.js`, `./core/iterm-launcher.js`, `./core/print-launcher.js`, `./core/opencode-launcher.js`, `./core/file-watcher.js`, `./core/event-queue.js`, `./types.js`) with a single consolidated import block from `@nitro-fueled/worker-core`
- `HealthStatus` type import also moved to `@nitro-fueled/worker-core`

### apps/session-orchestrator/src/tools/get-pending-events.ts
- Replaced 3 local imports (`../core/file-watcher.js`, `../core/event-queue.js`, `../types.js`) with a single `@nitro-fueled/worker-core` import

### apps/session-orchestrator/src/tools/spawn-worker.ts
- Replaced 7 local imports (core launchers, registry, types) with 2 consolidated imports from `@nitro-fueled/worker-core`

### apps/session-orchestrator/src/tools/subscribe-worker.ts
- Replaced 2 local imports with a single `@nitro-fueled/worker-core` import

## Project Conventions
(From CLAUDE.md — relevant to TypeScript files)
- Git: conventional commits with scopes
- All agents use `nitro-` prefix
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED

## Style Decisions from Review Lessons
(From .claude/review-lessons/review-general.md — relevant to TypeScript)

- **No `any` type ever** — use `unknown` + type guards, or proper generics
- **`tsconfig.json` must not disable `noImplicitAny` or `strictNullChecks`** — enable `"strict": true`
- **No `as` type assertions** — if the type system fights you, the type is wrong
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare
- **No unused imports or dead code** — if exported but never imported, remove it
- **kebab-case** for file names
- **camelCase** for variables, functions, methods
- **PascalCase** for classes, interfaces, types, enums
- **Model types from shared types library** — never import from the database library in handlers or renderer
- **No double re-exports** — either named exports or wildcard in barrel, not both
- **Never swallow errors** — at minimum, log them. No empty catch blocks
- **Imports: model types from shared types library** — import from `@nitro-fueled/worker-core`, not local paths
- **File size limits**: Components max 150 lines, Services max 200 lines

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/session-orchestrator/src/index.ts
- apps/session-orchestrator/src/tools/get-pending-events.ts
- apps/session-orchestrator/src/tools/spawn-worker.ts
- apps/session-orchestrator/src/tools/subscribe-worker.ts
- apps/session-orchestrator/package.json

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 5
- Minor: 6

### Serious (5)
1. [Style] `index.ts:168` — `as` type assertion on `data` — redundant, suppresses type mismatch
2. [Style] `spawn-worker.ts:101,147` — `msg as JsonlMessage` — masks upstream type mismatch in onMessage callback
3. [Style] `index.ts` — 259 lines, exceeds 200-line service limit (inline tool handlers not extracted)
4. [Security] `subscribe-worker.ts:6-21` — no path traversal protection on `path` field in watch conditions
5. [Security] `index.ts:153` — `emit_event` label allows arbitrary chars; inconsistent with `subscribe_worker` label regex

### Minor (6)
1. [Style] `index.ts:9,23` — two import statements from same module; merge with inline `type` modifier
2. [Style] `spawn-worker.ts:33-34` — single-char vars `p` and `m`; use `provider` and `model`
3. [Security] `spawn-worker.ts:9` — no max length on prompt field; could cause cost/memory inflation
4. [Security] `index.ts:168` — `data as Record<...>` casts external input without type guard before enqueue
5. [Security] `index.ts:154` — no size limit on `emit_event` data payload (key count, key length, depth)
6. [Security] `subscribe-worker.ts:56` — `String(err)` may leak internal filesystem paths in error messages
