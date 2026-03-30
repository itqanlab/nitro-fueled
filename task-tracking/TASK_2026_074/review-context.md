# Review Context — TASK_2026_074

## Task Scope
- Task ID: 2026_074
- Task type: REFACTORING
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]

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
- apps/session-orchestrator/package.json (added @nitro-fueled/worker-core dep, removed chokidar)
- apps/session-orchestrator/src/index.ts (updated imports)
- apps/session-orchestrator/src/tools/spawn-worker.ts (updated imports)
- apps/session-orchestrator/src/tools/subscribe-worker.ts (updated imports)
- apps/session-orchestrator/src/tools/get-pending-events.ts (updated imports)

**Removed:**
- apps/session-orchestrator/src/core/ (all 9 files migrated to libs/worker-core)
- apps/session-orchestrator/src/types.ts (migrated to libs/worker-core)

## Git Diff Summary

Implementation commit: `b039b03` — `refactor(worker-core): extract libs/worker-core from apps/session-orchestrator`

### Files Changed

- **apps/session-orchestrator/package.json**: Replaced `chokidar` dependency with `@nitro-fueled/worker-core: "*"`.
- **apps/session-orchestrator/src/index.ts**: Consolidated all imports from local `./core/*` and `./types.js` into a single import from `@nitro-fueled/worker-core`.
- **apps/session-orchestrator/src/tools/get-pending-events.ts**: Updated imports from local paths to `@nitro-fueled/worker-core`.
- **apps/session-orchestrator/src/tools/spawn-worker.ts**: Updated imports — types and launcher functions all consolidated to `@nitro-fueled/worker-core`.
- **apps/session-orchestrator/src/tools/subscribe-worker.ts**: Updated imports from local paths to `@nitro-fueled/worker-core`.
- **libs/worker-core/package.json**: New package manifest — name `@nitro-fueled/worker-core`, ESM, build via `tsc`, depends on `chokidar`.
- **libs/worker-core/project.json**: Nx project config — `projectType: library`, build via `nx:run-script`, test placeholder.
- **libs/worker-core/src/core/event-queue.ts**: Moved — in-memory event queue (MAX_QUEUE_SIZE=1000), `enqueue` + `drain`.
- **libs/worker-core/src/core/file-watcher.ts**: Moved — chokidar-based file watcher for worker subscriptions.
- **libs/worker-core/src/core/iterm-launcher.ts**: Moved — iTerm session launch/kill logic.
- **libs/worker-core/src/core/jsonl-watcher.ts**: Moved — JSONL log watcher + session/path resolution.
- **libs/worker-core/src/core/opencode-launcher.ts**: Moved — OpenCode launcher.
- **libs/worker-core/src/core/print-launcher.ts**: Moved — Print launcher.
- **libs/worker-core/src/core/process-launcher.ts**: Moved — Process launching utilities.
- **libs/worker-core/src/core/token-calculator.ts**: Moved (+ minor change) — token calculation logic.
- **libs/worker-core/src/core/worker-registry.ts**: Moved — in-memory worker registry.
- **libs/worker-core/src/index.ts**: New barrel file — re-exports all public symbols from `types.ts` and all core modules.
- **libs/worker-core/src/types.ts**: Moved from `apps/session-orchestrator/src/types.ts` — all shared worker types.
- **libs/worker-core/tsconfig.json**: New TypeScript config — ESNext target, Node16 modules, strict mode, declaration output to `dist/`.

## Project Conventions

From CLAUDE.md (relevant to TypeScript/Node packages):
- Git: conventional commits with scopes
- Agent naming uses `nitro-` prefix — not applicable to this library package
- Do NOT start git commit/push without explicit user instruction (N/A for autonomous review)

From general TypeScript conventions:
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare.
- **No `any` type ever** — use `unknown` + type guards, or proper generics.
- **No `as` type assertions** — use type guards or generics.
- **String literal unions for status/type/category fields** — never bare `string`.
- **No unused imports or dead code** — if exported but never imported, remove it.
- **kebab-case** for file names
- **camelCase** for variables, functions, methods
- **PascalCase** for classes, interfaces, types, enums
- **File suffixes must follow convention** — `.model.ts` for types, `.service.ts` for services

## Style Decisions from Review Lessons

From review-general.md (relevant to TypeScript and library packaging):
- **No `any` type ever** (T01)
- **Explicit access modifiers on ALL class members** (T03, T04, T07, T09)
- **No `as` type assertions** (T03, T05, T07, T09)
- **No unused imports or dead code** (T01, T04, T08)
- **No double re-exports** — either named exports or wildcard in barrel, not both (T07)
- **No duplicate type definitions** — if a type exists in shared, import it. Don't redefine (T07)
- **Never swallow errors** — at minimum, log them. No empty catch blocks.
- **Error messages must be human-readable** — not raw exception strings.
- **Shared interface files duplicated across packages must be kept byte-for-byte identical** — when a type is defined in multiple places, fields must match exactly (T cross-package)
- **Missing imports in entry files are compilation blockers, not style issues**

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- libs/worker-core/package.json
- libs/worker-core/project.json
- libs/worker-core/tsconfig.json
- libs/worker-core/src/index.ts
- libs/worker-core/src/types.ts
- libs/worker-core/src/core/event-queue.ts
- libs/worker-core/src/core/file-watcher.ts
- libs/worker-core/src/core/iterm-launcher.ts
- libs/worker-core/src/core/jsonl-watcher.ts
- libs/worker-core/src/core/opencode-launcher.ts
- libs/worker-core/src/core/print-launcher.ts
- libs/worker-core/src/core/process-launcher.ts
- libs/worker-core/src/core/token-calculator.ts
- libs/worker-core/src/core/worker-registry.ts
- apps/session-orchestrator/package.json
- apps/session-orchestrator/src/index.ts
- apps/session-orchestrator/src/tools/spawn-worker.ts
- apps/session-orchestrator/src/tools/subscribe-worker.ts
- apps/session-orchestrator/src/tools/get-pending-events.ts

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 5 (Style: 3 High-severity convention violations; Security: 2 command-injection issues in iTerm mode)
- Minor: 14 (Style: 3 Medium + 1 Low; Logic: 3 Minor; Security: 7 Minor)

Note: Some findings overlap across reviewers (e.g., `as` type assertions flagged by both Style and Security). Counts reflect raw per-reviewer findings without deduplication.
