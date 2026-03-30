# Code Logic Review — TASK_2026_090

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Task**: Migrate init + run + status commands to Oclif
**Scope**: `apps/cli/src/base-command.ts`, `apps/cli/src/commands/init.ts`, `apps/cli/src/commands/run.ts`, `apps/cli/src/commands/status.ts`

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 1 |
| Minor    | 3 |
| Info     | 1 |

**Verdict**: No blocking issues. Code is logically correct with complete implementations. One serious finding requires investigation regarding an undocumented status value.

---

## Findings

### SERIOUS-01: Undocumented status value in STATUS_ORDER

**File**: `apps/cli/src/commands/status.ts:24-27`
**Lines**: 24-28

```typescript
const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  'IN_PROGRESS', 'FIXING', 'CREATED', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'BLOCKED', 'FAILED', 'CANCELLED',
];
```

**Issue**: The `STATUS_ORDER` array includes `'FIXING'` which is not documented in CLAUDE.md's task states list (CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED).

**Impact**: Either:
1. A new status exists that's not documented (documentation gap), or
2. Dead code referencing a status that doesn't exist (logic error)

**Recommendation**: Verify if `FIXING` is a valid task status. If yes, update CLAUDE.md. If no, remove from STATUS_ORDER.

---

### MINOR-01: Confusing exit semantics for COMPLETE status

**File**: `apps/cli/src/commands/run.ts:307-310`
**Lines**: 307-310

```typescript
if (task.status === 'COMPLETE') {
  console.warn(`Warning: Task ${taskId} is already COMPLETE.`);
  process.exitCode = 1;
  return;
}
```

**Issue**: Uses `console.warn` (implying non-fatal condition) but sets `exitCode = 1` (indicating failure). The behavior is intentional (prevent re-running completed tasks) but the mixed signals may confuse CI/CD pipelines or scripts checking exit codes.

**Impact**: Low. Behavior is correct; presentation is slightly inconsistent.

**Recommendation**: Either change to `console.error` to match the exit code, or document that this is a deliberate "soft failure".

---

### MINOR-02: BaseCommand methods delegate without additional logic

**File**: `apps/cli/src/base-command.ts:8-14`
**Lines**: 8-14

```typescript
protected override async catch(err: Error & { exitCode?: number }): Promise<void> {
  await super.catch(err);
}

protected override async finally(err: Error | undefined): Promise<void> {
  await super.finally(err);
}
```

**Issue**: Both methods only delegate to `super` with no custom behavior. These appear to be scaffold placeholders.

**Impact**: None — code works correctly. These provide extension points for future customization.

**Recommendation**: Either add a comment explaining these are intentional hooks for future use, or remove if not needed.

---

### MINOR-03: Silent error suppression in process cleanup

**File**: `apps/cli/src/commands/run.ts:384-386`
**Lines**: 384-386

```typescript
process.on('exit', () => {
  if (dashboardProcess!.pid !== undefined) {
    try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
  }
});
```

**Issue**: Empty catch block suppresses all errors, not just the expected "process already exited" case.

**Impact**: Low. `process.kill` only throws ESRCH (no such process) or EPERM (permission denied). In cleanup context, both are acceptable to ignore.

**Recommendation**: Acceptable as-is. Comment accurately describes the intent.

---

### INFO-01: init.ts exceeds 200-line guideline

**File**: `apps/cli/src/commands/init.ts`
**Lines**: 1-506

**Issue**: File is 506 lines, exceeding the 200-line guideline for services.

**Context**: As noted in review-context.md, this is a command module (not a service) containing multiple helper functions for the init workflow. The file is cohesive — all functions serve the single `init` command.

**Impact**: None — acceptable for command modules with complex workflows.

**Recommendation**: No action needed. File organization is logical.

---

## Logic Verification

### Business Logic Correctness

| Area | Status | Notes |
|------|--------|-------|
| Task ID validation | ✓ | Regex `^TASK_\d{4}_\d{3}$` correctly validates format |
| Task shorthand expansion | ✓ | Properly pads to 3 digits with current year |
| Status filtering | ✓ | Correctly rejects BLOCKED/CANCELLED/FAILED/COMPLETE for re-run |
| Batch option validation | ✓ | Concurrency requires positive int, retries allows 0+, interval requires valid unit |
| Flag conflict detection | ✓ | Batch-only flags rejected in single-task mode |
| Scaffold overwrite logic | ✓ | Respects --overwrite flag, prompts user when .claude/ exists |
| Manifest preservation | ✓ | Reads existing manifest to preserve entries on re-init |
| MCP config detection | ✓ | Skips configuration if already present |

### Data Flow Verification

| Flow | Status | Notes |
|------|--------|-------|
| init → scaffold → manifest | ✓ | Files tracked correctly, manifest updated |
| run → preflight → spawn | ✓ | All checks pass before spawning workers |
| status → registry → display | ✓ | Registry regenerated before parsing |
| Worker table parsing | ✓ | Column indices match documented schema (0-6 used of 8) |
| Plan parsing | ✓ | Regex extraction handles missing sections gracefully |

### Edge Cases Handled

- Empty registry → proper messaging based on file existence
- Claude CLI unavailable → graceful degradation with user messaging
- MCP already configured → skip configuration step
- No files to commit → returns success with informative message
- Dashboard service failure → non-fatal, Supervisor proceeds
- Task ID 000 via shorthand → allowed (valid format, whether task exists is separate check)

### No Stubs or Placeholders

All implementations are complete. No TODO comments, placeholder returns, or incomplete branches detected.

---

## Access Modifier Compliance

All class members have explicit access modifiers as required by review-general.md:

| Class | Members | Status |
|-------|---------|--------|
| BaseCommand | catch, finally | `protected override` ✓ |
| Init | description, flags, run | `public static override` / `public async` ✓ |
| Run | description, args, flags, run | `public static override` / `public async` ✓ |
| Status | description, flags, run | `public static override` / `public async` ✓ |

---

## Conclusion

The Oclif migration is logically sound. All business logic from the Commander.js implementation has been correctly preserved. The one serious finding (FIXING status) requires investigation but does not block the migration — it may simply be documentation that needs updating.

No blocking issues. Code is ready for integration pending SERIOUS-01 resolution.
