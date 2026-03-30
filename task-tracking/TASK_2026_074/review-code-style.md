# Code Style Review — TASK_2026_074

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Task:** Extract libs/worker-core from session-orchestrator
**Commit:** b039b03

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 3     |
| Low      | 1     |
| **Total**| **7** |

No issues found outside File Scope.

---

## High Severity

### S01 — Missing `public` access modifiers on class methods

**Convention:** Explicit access modifiers on ALL class members — `public`, `private`, `protected`. Never bare.

All private members are correctly annotated. All public class methods are missing explicit `public`.

**`libs/worker-core/src/core/event-queue.ts`**
- Line 13: `enqueue(event: EmittedEvent): void` — missing `public`
- Line 27: `drain(): EmittedEvent[]` — missing `public`

**`libs/worker-core/src/core/file-watcher.ts`**
- Line 37: `subscribe(workerId, workingDirectory, conditions)` — missing `public`
- Line 106: `drainEvents(): WatchEvent[]` — missing `public`
- Line 113: `closeAll(): void` — missing `public`

**`libs/worker-core/src/core/jsonl-watcher.ts`**
- Line 44: `start(): void` — missing `public`
- Line 50: `stop(): void` — missing `public`
- (Note: `feedMessage` at line 275 correctly has `public` — inconsistent with `start`/`stop`)

**`libs/worker-core/src/core/worker-registry.ts`**
- Line 59: `register(opts)` — missing `public`
- Line 96: `get(workerId)` — missing `public`
- Line 100: `getBySessionId(sessionId)` — missing `public`
- Line 107: `list(filter?)` — missing `public`
- Line 114: `updateStatus(workerId, status)` — missing `public`
- Line 119: `updateSession(workerId, sessionId)` — missing `public`
- Line 124: `updateJsonlPath(workerId, jsonlPath)` — missing `public`
- Line 129: `updateTokens(workerId, tokens)` — missing `public`
- Line 134: `updateCost(workerId, cost)` — missing `public`
- Line 139: `updateProgress(workerId, update)` — missing `public`
- Line 144: `remove(workerId)` — missing `public`

---

### S02 — `as` type assertions

**Convention:** No `as` type assertions — use type guards or generics.

**`libs/worker-core/src/core/jsonl-watcher.ts`**
- Line 195: `const resultMsg = msg as Record<string, unknown>` — should narrow via type guard on `msg.type === 'result'`
- Line 197: `const usage = resultMsg.usage as Record<string, number> | undefined` — cascading `as` chain
- Line 210: `const assistant = msg as JsonlAssistantMessage` — should narrow via type guard after `msg.type === 'assistant'` check
- Line 251: `const input = block.input as Record<string, string> | undefined` — should use type guard or proper typed accessor
- Line 326: `typeof (parsed as Record<string, unknown>).sessionId !== 'string'` — use a proper type guard function
- Line 327: `return (parsed as SessionMeta).sessionId` — safe to narrow after the guard but use explicit type narrowing instead

**`libs/worker-core/src/core/worker-registry.ts`**
- Line 34: `...(worker as Partial<Worker>)` and trailing `} as Worker` — double cast to work around `unknown`; use a proper type guard for `isWorker`
- Line 37: `(err as NodeJS.ErrnoException).code` — use `instanceof` check: `if (err instanceof Error && 'code' in err)`

**`libs/worker-core/src/core/process-launcher.ts`**
- Line 50: `JSON.parse(trimmed) as Record<string, unknown>` — assign to `unknown` then narrow
- Line 61: `JSON.parse(stdoutBuffer.trim()) as Record<string, unknown>` — same pattern

**`apps/session-orchestrator/src/index.ts`**
- Line 169: `data as Record<string, unknown> | undefined` — `data` is already `z.record(z.string(), z.unknown()).optional()` from Zod; cast is unnecessary

**`apps/session-orchestrator/src/tools/spawn-worker.ts`**
- Line 101: `msg as JsonlMessage` — `msg` is `Record<string, unknown>` from `onMessage` callback; assign to `unknown` first and narrow
- Line 147: `msg as JsonlMessage` — same pattern, same fix

---

### S03 — Silently swallowed catch blocks

**Convention:** Never swallow errors — at minimum, log them. No empty catch blocks.

**`libs/worker-core/src/core/file-watcher.ts`**
- Line 127: `watcher.close().catch(() => {})` — chokidar close errors silently dropped; should log to `process.stderr`

**`libs/worker-core/src/core/process-launcher.ts`**
- Line 52: `catch { /* Not valid JSON — skip */ }` — JSON parse error on a streamed line; should at minimum write to stderr at debug level
- Line 62: `catch { /* Not valid JSON — ignore */ }` — same; flushed buffer remainder silently discarded
- Line 101–102: `catch { /* already dead */ }` — `child.kill('SIGKILL')` failure silently dropped; log at stderr
- Line 110–112: `catch { /* already dead */ }` — `process.kill(pid, 0/SIGKILL)` failure silently dropped; log at stderr

---

## Medium Severity

### S04 — File name convention: `types.ts` should be `types.model.ts`

**Convention:** File suffixes must follow convention — `.model.ts` for types.

**`libs/worker-core/src/types.ts`**

The file contains exclusively interfaces and type aliases (no classes, no functions). Per convention, shared type definition files should use the `.model.ts` suffix. The correct name is `libs/worker-core/src/types.model.ts`, with all internal cross-imports updated accordingly.

---

### S05 — Bare `string` used for discriminant / status / type fields

**Convention:** String literal unions for status/type/category fields — never bare `string`.

**`libs/worker-core/src/types.ts`**
- Line 64: `stop_reason: string | null` in `JsonlAssistantMessage` — `stop_reason` is a status field. Known values include `'end_turn'`, `'max_tokens'`, `'stop_sequence'`, `'tool_use'`. Should be typed as a string literal union with a fallback (`string`) only if the open set is required.
- Line 91: `| { type: string }` catch-all in `JsonlMessage` union — the `type` field is the discriminant. The catch-all arm should be typed with a named interface `JsonlUnknownMessage { type: string }` or `{ type: Exclude<string, 'assistant' | 'user' | 'system' | 'progress'> }` to make the intent explicit and enforce future exhaustive narrowing.
- Line 93: `type: string` in `JsonlContentBlock` — the `type` field in content blocks acts as a discriminant (`'tool_use'`, `'text'`, `'tool_result'`, etc.). Known variants should be enumerated as a string literal union.

---

### S06 — Dead field: `watcher` in `JsonlWatcher` never assigned

**Convention:** No unused imports or dead code.

**`libs/worker-core/src/core/jsonl-watcher.ts`**
- Line 39: `private watcher: ReturnType<typeof watch> | null = null;` — this field is declared and checked in `stop()` (`this.watcher?.close()`) but never assigned a non-null value anywhere in the class. The `stop()` close call is always a no-op.
- Line 1: `import { watch } from 'chokidar';` — `watch` is imported solely to provide the type for the dead `watcher` field above. If the field is removed, this import becomes unused.

Action: Either assign `watcher` in `start()` (likely the original intent before polling replaced chokidar watching), or remove the field and the import entirely.

---

## Low Severity

### S07 — Implicit `any` from `JSON.parse` assigned directly to typed variables

**Convention:** No `any` type ever — use `unknown` + type guards.

**`libs/worker-core/src/core/jsonl-watcher.ts`**
- Line 173: `const msg: JsonlMessage = JSON.parse(lines[i]);` — `JSON.parse` returns `any`. Assigning `any` to a typed variable is an implicit cast, bypassing the type system. The correct pattern is `const msg: unknown = JSON.parse(lines[i])` followed by a proper type guard before use. This is lower severity than explicit `as` assertions but violates the same convention.

---

## Files With No Issues

- `libs/worker-core/package.json` — clean
- `libs/worker-core/project.json` — clean
- `libs/worker-core/tsconfig.json` — clean
- `libs/worker-core/src/core/iterm-launcher.ts` — clean (no class members to annotate; no `as` assertions; errors are either returned as `false` or re-thrown with readable messages)
- `libs/worker-core/src/core/opencode-launcher.ts` — clean
- `libs/worker-core/src/core/print-launcher.ts` — clean
- `libs/worker-core/src/core/token-calculator.ts` — clean
- `apps/session-orchestrator/package.json` — clean
- `apps/session-orchestrator/src/tools/subscribe-worker.ts` — clean
- `apps/session-orchestrator/src/tools/get-pending-events.ts` — clean
