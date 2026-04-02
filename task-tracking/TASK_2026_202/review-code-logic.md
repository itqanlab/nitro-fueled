# Code Logic Review — TASK_2026_202

| Category | Finding | Verdict |
|----------|----------|---------|
| **Logic Correctness** | Drain request flow correctly sets drain_requested flag in DB via SupervisorDbService.setDrainRequested(), SessionRunner checks flag on every tick and returns early to stop spawning new workers, active workers complete naturally | PASS |
| **Logic Correctness** | drainSession() in SessionManagerService correctly finds runner, sets drain flag, returns boolean (no runner deletion - handled by SessionRunner when workers finish) | PASS |
| **Logic Correctness** | SessionRunner.getStatus() correctly populates drainRequested field from DB via getDrainRequested() | PASS |
| **Logic Correctness** | deriveEndStatus() correctly returns 'stopped' when loop_status='stopped' AND drain_requested=true, distinguishing drained sessions from natural completions | PASS |
| **Logic Correctness** | Frontend drainSession() correctly calls PATCH /sessions/:id/stop with empty body to trigger graceful drain | PASS |
| **Logic Correctness** | Frontend showConfirmDialog/isDraining signals correctly manage drain UI flow (confirmation → request → banner display) | PASS |
| **Logic Correctness** | Status color mapping includes 'stopped' → 'gold' in both session-detail and sessions-list components | PASS |
| **Completeness** | All layers updated consistently: DB schema (drain_requested column), types (SessionStatusResponse.drainRequested, SessionEndStatus includes 'stopped'), backend controller/service, frontend API/component | PASS |
| **Completeness** | UI includes confirmation dialog, drain banner showing active worker count, End Session button (only for running sessions) | PASS |
| **Completeness** | End Session button correctly hidden for 'stopped' sessions via condition `d.statusLabel === 'running' && !isDraining()` | PASS |
| **Completeness** | Drain banner condition `isDraining()` displays correctly when drain requested; documented limitation that no real-time updates exist (user must refresh) | PASS |
| **No Stubs** | All drain-related methods are fully implemented with no TODO/FIXME comments or placeholder code | PASS |
| **Type Safety** | SessionActionResponse.action union includes 'draining', matching backend response | PASS |
| **Type Safety** | SessionStatusResponse includes drainRequested: boolean field | PASS |
| **Type Safety** | RawSession.drain_requested (number) correctly converted to CortexSession.drainRequested (boolean) via `row.drain_requested === 1` | PASS |

## Minor Notes (Non-blocking)

1. **Type Consistency (Low Severity)**: RawSession.drain_requested is typed as `number` but CortexSession.drainRequested is `boolean`. The mapSession function correctly handles this conversion with `row.drain_requested === 1`, so logic is sound. This is a minor type inconsistency between raw DB layer and public-facing types.

2. **Optimistic UI State Persistence (Documented)**: When drain completes, the `isDraining` signal remains true until page refresh. This is acceptable given the documented limitation in handoff.md: "No real-time websocket/polling for drain state — user must refresh to see final stopped state."

## Overall Assessment

The graceful session drain implementation is logically correct and complete. The drain request properly sets a flag that prevents new worker spawns while allowing active workers to complete naturally. All layers (database, backend types/services, frontend API/components) are consistently updated. No stub implementations found. The implementation follows the design decisions documented in handoff.md.

| Overall Verdict | PASS |
