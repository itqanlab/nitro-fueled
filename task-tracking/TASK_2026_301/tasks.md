# Development Tasks - TASK_2026_301

## Batch 1: Audit and fix telemetry screens — COMPLETE

**Developer**: orchestrator (direct)

### Task 1.1: Audit PhaseTimingComponent

**File**: apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts
**Status**: COMPLETE

Verified getCortexPhaseTimings() wiring. Found bug: `toSignal` used `{ initialValue: null }` — when the HTTP request errors and catchError emits null, the signal stays at null (same value as initialValue), so the effect never re-fires and loading never clears. Fixed by removing initialValue (signal starts as undefined), updating effect to use `undefined` check per the pattern established in TASK_2026_300.

### Task 1.2: Audit TaskTraceComponent

**File**: apps/dashboard/src/app/views/task-trace/task-trace.component.ts
**Status**: COMPLETE

Verified getCortexTaskTrace() wiring. Found two bugs:
1. `tasksSignal` used `{ initialValue: null }` — tasksLoading never cleared on HTTP error
2. `traceSignal` used `of(null)` for the no-task case and `{ initialValue: null }` — on trace HTTP error, the signal emits null (same as the initial null), so the effect doesn't re-fire and traceLoading stays true forever

Fixed both:
- tasksSignal: removed initialValue, effect now checks `!== undefined`
- traceSignal: no-task case now emits `undefined`, initialValue set to `undefined`, traceLoading now checks `=== undefined` instead of `=== null`
- viewModelComputed uses `?? null` to coerce undefined → null before passing to adaptTaskTrace
