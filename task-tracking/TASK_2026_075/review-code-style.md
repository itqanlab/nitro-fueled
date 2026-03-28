# Code Style Review — TASK_2026_075

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Task:** Refactor session-orchestrator to consume @nitro-fueled/worker-core
**Scope:** Verify import migration; no source changes were made in this task itself (commit b039b03 performed the actual migration)

---

## Summary

The import migration is correct — all local `./core/` and `./types` imports have been replaced with `@nitro-fueled/worker-core` imports. No remaining local core paths exist. The refactor goal is achieved.

Style issues found fall into three categories: `as` type assertions, file size limit exceeded, and minor naming/import organization issues.

**Overall verdict: NEEDS MINOR FIXES** — 2 real `as` assertions must be resolved before merge; remaining items are low-severity.

---

## Issues

### HIGH — `as` Type Assertions (rule: "No `as` type assertions")

#### Issue 1 — `index.ts:168`: Unnecessary `as` cast on `data`

```typescript
data: data as Record<string, unknown> | undefined,
```

**File:** `apps/session-orchestrator/src/index.ts:168`

The Zod schema for `data` is `z.record(z.string(), z.unknown()).optional()`, which already infers as `Record<string, unknown> | undefined`. The `as` cast is redundant and suppresses any future type mismatch. Remove it — if inference fails, fix the type, not the assertion.

---

#### Issue 2 — `spawn-worker.ts:101,147`: `msg as JsonlMessage`

```typescript
// Line 101
onMessage: (msg) => {
  if (workerRef.id) watcher.feedMessage(workerRef.id, msg as JsonlMessage);
},

// Line 147
onMessage: (msg) => {
  if (workerRef.id) watcher.feedMessage(workerRef.id, msg as JsonlMessage);
},
```

**File:** `apps/session-orchestrator/src/tools/spawn-worker.ts:101,147`

Both `launchWithOpenCode` and `launchWithPrint` pass `msg` to `onMessage` with a broader type than `JsonlMessage`, requiring a cast at the call site. The correct fix is to type the `onMessage` callback parameter as `JsonlMessage` in `worker-core` so the cast is unnecessary. As it stands, this silences a type mismatch instead of fixing it.

Note: this is an out-of-scope root cause (the `onMessage` signature lives in `worker-core`), but the assertions exist in in-scope files and must be flagged.

---

### MEDIUM — File Size Limit Exceeded

#### Issue 3 — `index.ts`: 259 lines, limit is 200

**File:** `apps/session-orchestrator/src/index.ts` (259 lines)

Service file size limit is 200 lines. `index.ts` contains 7 inline tool handlers (`list_workers`, `get_worker_stats`, `get_worker_activity`, `emit_event`, `kill_worker`, `getHealth`). The `spawn_worker`, `subscribe_worker`, and `get_pending_events` tools have already been extracted to `./tools/` — the remaining inline tools should follow the same pattern.

Specifically, the `list_workers`, `get_worker_stats`, `get_worker_activity`, `emit_event`, and `kill_worker` handlers (lines 53–238) and the `getHealth` function (lines 243–250) should be extracted to separate files under `src/tools/`.

---

### LOW — Separate `import type` from Same Module

#### Issue 4 — `index.ts:23`: Split import from `@nitro-fueled/worker-core`

```typescript
// Lines 9-19
import {
  WorkerRegistry,
  JsonlWatcher,
  killProcess,
  ...
} from '@nitro-fueled/worker-core';

// Line 23 — separate import from the same module
import type { HealthStatus } from '@nitro-fueled/worker-core';
```

**File:** `apps/session-orchestrator/src/index.ts:9,23`

Two import statements from the same module. The `type` import should be merged with the value import block using inline `type` modifier:

```typescript
import {
  WorkerRegistry,
  JsonlWatcher,
  ...
  type HealthStatus,
} from '@nitro-fueled/worker-core';
```

---

### LOW — Single-Character Variable Names

#### Issue 5 — `spawn-worker.ts:33-34`: `p` and `m` are not descriptive

```typescript
const p: Provider = args.provider ?? 'claude';
const m = args.model ?? DEFAULT_MODEL;
```

**File:** `apps/session-orchestrator/src/tools/spawn-worker.ts:33-34`

Single-character names reduce readability, especially when `p` is used throughout the function in non-obvious contexts (e.g., `provider: p` on lines 69, 127, 155). Names should be `provider` and `model` to match their domain meaning. This also avoids the shadowing risk with `p` conflicting with the `provider` field name in later object literals.

---

### INFO — `as const` Usage (not a violation)

Throughout all files, `type: 'text' as const` appears in return objects (e.g., `index.ts:63`, `get-pending-events.ts:29`, `spawn-worker.ts:75`, `subscribe-worker.ts:43`). While the project rule says "No `as` type assertions", `as const` is a fundamentally different construct — it narrows a value to its literal type without subverting the type system. This is idiomatic TypeScript and not equivalent to an `as SomeType` cast. No action required, but noted for team alignment.

---

### INFO — `package.json` Wildcard Version

```json
"@nitro-fueled/worker-core": "*"
```

**File:** `apps/session-orchestrator/package.json:17`

Using `"*"` in an Nx workspace resolves via the workspace's package resolution. This works but is less explicit than `"workspace:*"` (Yarn/PNPM workspaces protocol). If this project uses npm workspaces, `"*"` is acceptable. No action required unless workspace tooling is changed.

---

## Issue Summary Table

| # | File | Line(s) | Severity | Issue |
|---|------|---------|----------|-------|
| 1 | `index.ts` | 168 | HIGH | `as` type assertion on `data` — redundant, remove it |
| 2 | `spawn-worker.ts` | 101, 147 | HIGH | `msg as JsonlMessage` — masks upstream type mismatch |
| 3 | `index.ts` | 1–259 | MEDIUM | File is 259 lines, exceeds 200-line service limit |
| 4 | `index.ts` | 9, 23 | LOW | Two import statements from same module; merge with inline `type` |
| 5 | `spawn-worker.ts` | 33–34 | LOW | Single-char variable names `p` and `m` — use `provider` and `model` |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| `@nitro-fueled/worker-core` added to `package.json` dependencies | ✅ Present at line 17 |
| All imports in `src/index.ts` use `@nitro-fueled/worker-core` | ✅ Confirmed — no local `./core/` imports |
| All imports in `src/tools/` use `@nitro-fueled/worker-core` | ✅ Confirmed across all 3 tool files |
| No remaining imports from `./core/` or `./types` | ✅ None found |
| Style conventions met | ⚠️ 2 HIGH issues, 3 LOW issues |
