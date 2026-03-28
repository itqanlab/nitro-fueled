# Code Style Review — TASK_2026_090

**Reviewer:** nitro-code-style-reviewer
**Scope:** Oclif migration — `init.ts`, `run.ts`, `status.ts`, `base-command.ts`
**Commit reviewed:** e07be02
**Date:** 2026-03-28

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0     |
| Serious  | 4     |
| Minor    | 4     |

No blocking issues. Four serious findings — all convention violations that should be fixed. Four minor findings noted below.

---

## Blocking Issues

None.

---

## Serious Issues

### S1 — `status.ts:8` — Bare `string` on `WorkerEntry.status`

```typescript
interface WorkerEntry {
  ...
  status: string;   // ← violation
  health: string;
}
```

**Convention:** "String literal unions for status/type/category fields — never bare string."

`status` is a category field with a small known set of values (e.g., `'RUNNING'`, `'IDLE'`). It must use a string literal union. The parser at lines 84–96 populates this from a Markdown table, and the `displayFull` function at line 206 emits it directly. Without a union type, no compiler guard prevents unexpected strings from silently corrupting output.

---

### S2 — `status.ts:21` — Bare `string` on `PlanInfo.phases[*].status`

```typescript
interface PlanInfo {
  ...
  phases: Array<{ name: string; status: string; taskCount: number; completeCount: number }>;
}
```

**Convention:** Same as S1.

`status` here is populated from plan Markdown (line 140: `phaseStatus`) and used in display output. It must be a string literal union (e.g., `'IN_PROGRESS' | 'COMPLETE' | 'NOT_STARTED'`).

---

### S3 — `run.ts:385` — Swallowed error with no log

```typescript
try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
```

**Convention:** "Never swallow errors — at minimum, log them. No empty catch blocks."

The comment `/* already exited */` explains the expected case but the `catch` block contains no `console.warn` or `console.error`. If `process.kill` fails for an unexpected reason (e.g., permission denied, invalid PID), that failure is silently dropped. At minimum, a `console.warn` should be present. The comment alone does not satisfy the convention.

---

### S4 — `status.ts:46-49` and `status.ts:111-115` — Catch blocks log warning but discard the error value

```typescript
// status.ts:46
} catch {
  console.error(`Warning: Could not read ${statePath}`);
  return [];
}

// status.ts:111
} catch {
  console.error(`Warning: Could not read ${planPath}`);
  return null;
}
```

**Convention:** "Never swallow errors — at minimum, log them."

Both catch blocks log a static warning message but discard the caught error entirely (no `err` binding, no `String(err)` or `err.message` appended). The root cause is invisible in logs. Should be `catch (err: unknown) { console.error(`Warning: Could not read ${path}: ${String(err)}`); }`.

---

## Minor Issues

### M1 — `status.ts:11` — Bare `string` on `WorkerEntry.health`

```typescript
interface WorkerEntry {
  ...
  health: string;
}
```

`health` is a category field. If it has known values (e.g., `'OK'`, `'WARN'`, `'ERROR'`) it should use a string literal union for the same reasons as S1. If the value set is truly open-ended, document why.

---

### M2 — `run.ts:384` — Non-null assertion operator (`!`) on `dashboardProcess`

```typescript
if (dashboardProcess !== null) {
  process.on('exit', () => {
    if (dashboardProcess!.pid !== undefined) {     // ← non-null assertion
      try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* ... */ }
    }
  });
}
```

**Convention spirit:** "No `as` type assertions — use type guards or generics."

The non-null assertion (`!`) is used because the closure captures the outer `dashboardProcess` variable (typed `ChildProcess | null`), even though the surrounding `if (dashboardProcess !== null)` check has already narrowed it. The idiomatic fix is to capture the narrowed value before the callback:

```typescript
const proc = dashboardProcess;  // narrowed to ChildProcess
process.on('exit', () => { ... proc.pid ... });
```

This is minor since the `!` is technically safe here given the null check above, but it leaves a subtle type-system hole.

---

### M3 — `init.ts:131` — `handleAntiPatterns` function does two things

```typescript
/**
 * Detects the project stack and generates a stack-aware anti-patterns.md.
 */
function handleAntiPatterns(cwd: string, scaffoldRoot: string, overwrite: boolean): DetectedStack[] {
```

**Convention:** "A function that needs 'and' to describe it must be split."

The docblock itself says "detects the project stack **and** generates a stack-aware anti-patterns.md." This is pre-existing logic moved as-is from Commander to Oclif, not newly introduced in this PR. Flag for future cleanup rather than blocking this migration.

---

### M4 — `init.ts` — 505-line file

The review context acknowledges this: "init.ts is ~505 lines (large command file with many helpers) — this is a command module, not a component or service." Convention limits (150 for components, 200 for services) don't strictly apply here. Noted for awareness; not a blocking concern given the command module context.

---

## Files With No Issues

- `apps/cli/src/base-command.ts` — clean. Access modifiers correct, no `any`, no `as`, no swallowed errors.
- `apps/cli/src/commands/run.ts` — clean except S3 and M2 noted above.
- `apps/cli/src/commands/status.ts` — clean except S1, S2, S4, M1 noted above.
- `apps/cli/src/commands/init.ts` — clean except M3, M4 noted above.

---

## Verdict

**Conditional pass.** Four serious findings (S1–S4) should be resolved before merge. S1 and S2 are straightforward type-union additions; S3 and S4 require adding error logging to catch blocks. No behavioral or security concerns introduced by this migration.
