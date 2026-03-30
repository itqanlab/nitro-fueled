# Code Style Review — TASK_2026_094

## Verdict
REQUEST_CHANGES

## Score
6/10

## Findings

### SERIOUS: `as` type assertion in emit_event handler
- File: apps/session-orchestrator/src/index.ts
- Line: 168
- Issue: `data: data as Record<string, unknown> | undefined` uses an explicit `as` type assertion. The Zod schema on line 154 already types `data` as `Record<string, unknown> | undefined` — the assertion is redundant and violates the "no `as` assertions" convention.
- Fix: Remove the cast. The inferred type from `z.record(z.string(), z.unknown()).optional()` is already `Record<string, unknown> | undefined`. Assign directly: `data: data,` or simply `data,`.

### SERIOUS: Missing explicit access modifiers on EventQueue class methods
- File: libs/worker-core/src/core/event-queue.ts
- Line: 13 (`enqueue`), 27 (`drain`)
- Issue: Both public methods are declared without an explicit access modifier. The convention requires explicit `public`, `private`, or `protected` on ALL class members. `enqueue` and `drain` are missing `public`.
- Fix: Change to `public enqueue(event: EmittedEvent): void` and `public drain(): EmittedEvent[]`.

### SERIOUS: `get_pending_events` return shape in MCP reference table documents `triggered_at` instead of `emitted_at` for emitted events
- File: .claude/skills/auto-pilot/SKILL.md
- Line: ~1799
- Issue: The documented return type is `-> { events: Array<{ worker_id, event_label, triggered_at, condition? }> }`. The field `triggered_at` is a WatchEvent field — EmittedEvent uses `emitted_at`. Workers and the supervisor parsing this documentation will use the wrong field name when reading emitted events. The inline comment on the following lines correctly distinguishes the two shapes (source: 'emit_event' vs condition field), but the union return shape is wrong.
- Fix: Update the documented return shape to reflect both event shapes accurately, e.g.: `-> { events: Array<WatchEvent | EmittedEvent> }` with a field breakdown below, or use a union: `Array<{ worker_id, event_label, triggered_at, condition } | { worker_id, event_label, emitted_at, data?, source: 'emit_event' }>`.

### MINOR: Repeated `as const` assertions throughout index.ts
- File: apps/session-orchestrator/src/index.ts
- Line: 62, 79, 92, 126, 143, 174, 211, 237 (and others)
- Issue: `type: 'text' as const` is used in every MCP tool return. While `as const` is idiomatically distinct from type-narrowing assertions, the project convention states "no `as` assertions". The idiomatic alternative is to define a typed helper or use a typed constant for the content shape.
- Fix: Extract a helper: `const textContent = (text: string) => ({ type: 'text' as const, text })` defined once at the top of the file, replacing all inline `{ type: 'text' as const, text: ... }` occurrences. This contains the single `as const` to one location.

### MINOR: index.ts exceeds 200-line service file size limit
- File: apps/session-orchestrator/src/index.ts
- Line: 259 (total)
- Issue: The file is 259 lines — 59 lines over the 200-line maximum for services. The file registers 8 MCP tools inline plus a `getHealth` helper function, all in a single module.
- Fix: Extract `getHealth` and the `list_workers` / `get_worker_stats` / `get_worker_activity` / `kill_worker` tool handlers to separate files under `tools/` (matching the existing pattern of `tools/spawn-worker.ts`, `tools/subscribe-worker.ts`, `tools/get-pending-events.ts`). The `emit_event` handler is small enough to stay inline or move to `tools/emit-event.ts`.

### MINOR: emit_event handler is not `async` while all other handlers are
- File: apps/session-orchestrator/src/index.ts
- Line: 156
- Issue: `({ worker_id, label, data }) => {` — synchronous arrow function. Every other `server.tool(...)` handler in the file uses `async (args) => { ... }`. The inconsistency is not a bug (the operation is synchronous), but it breaks visual uniformity and makes the signature stand out unexpectedly.
- Fix: Add `async` prefix for consistency: `async ({ worker_id, label, data }) => {`.
