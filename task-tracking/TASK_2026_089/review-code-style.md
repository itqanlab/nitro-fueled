# Code Style Review — TASK_2026_089

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Commit:** `e07be02` — feat(cli): migrate apps/cli from Commander to @oclif/core
**Files reviewed:** apps/cli/src/index.ts, apps/cli/src/base-command.ts, apps/cli/src/commands/{init,run,status,create,config,dashboard,update}.ts, apps/cli/package.json, apps/cli/project.json

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 1     |

The Oclif migration is structurally sound. Access modifiers are consistently applied to all class members across all seven command classes. No `any` types were introduced. No unused Commander-era interfaces remain. The main concerns are `as` type assertions in two command files, silently swallowed catch blocks in three files, bare `string` for status/category fields in `status.ts`, and file size limit violations across several command files.

---

## Issues

### [HIGH] `as` type assertions — `config.ts`, `dashboard.ts`

**Convention:** No `as` type assertions — use type guards or generics.

**`apps/cli/src/commands/config.ts`**

Line 65:
```ts
if (!UNLOADABLE_PROVIDERS.includes(lower as UnloadableProvider)) {
```

Line 73:
```ts
const provider = lower as UnloadableProvider;
```

`lower` is `string`. The `as UnloadableProvider` cast forces the type instead of narrowing it. TypeScript's `includes()` on a `readonly` tuple requires a matching value type — the correct fix is a type predicate:

```ts
function isUnloadableProvider(s: string): s is UnloadableProvider {
  return (UNLOADABLE_PROVIDERS as readonly string[]).includes(s);
}
```

Note: `as const` on line 22 is not flagged — `as const` is a const assertion, not a type assertion, and is idiomatic TypeScript.

**`apps/cli/src/commands/dashboard.ts`**

Line 25:
```ts
const body = await resp.json() as Record<string, unknown>;
```

`Response.json()` returns `Promise<unknown>` in strict TypeScript. Use a type guard to narrow instead of asserting:

```ts
const raw: unknown = await resp.json();
if (typeof raw !== 'object' || raw === null) return false;
const body = raw as Record<string, unknown>; // still an assertion, move to proper guard
```

---

### [HIGH] Empty/silent catch blocks — `run.ts`, `dashboard.ts`, `update.ts`

**Convention:** Never swallow errors — at minimum, log them. No empty catch blocks.

**`apps/cli/src/commands/run.ts`** — line 385:
```ts
try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
```
Comment explains intent, but the error is silently discarded. Use `console.debug` or a no-op that does not suppress completely (or annotate with `_err` to signal intent).

**`apps/cli/src/commands/dashboard.ts`** — line 143:
```ts
try { process.kill(child.pid, signal); } catch { /* already exited */ }
```
Same pattern as above.

**`apps/cli/src/commands/dashboard.ts`** — lines 26–29 (`checkLegacyHealthOnPort`):
```ts
} catch {
  return false;
}
```
Catches any fetch error and returns `false` without logging. A network failure and a healthy-but-busy server look identical to the caller.

**`apps/cli/src/commands/update.ts`** — lines 37–39 (`getCurrentChecksum`):
```ts
} catch {
  return null;
}
```
Silently swallows file-read or hash errors. Returning `null` is fine, but a `console.debug` or `console.warn` should log the skipped path and error for diagnosability.

---

### [MEDIUM] Bare `string` type for status/category fields — `status.ts`

**Convention:** String literal unions for status/type/category fields — never bare `string`.

**`apps/cli/src/commands/status.ts`** — `WorkerEntry` interface (lines 8–15):
```ts
interface WorkerEntry {
  status: string;  // should be a union, e.g. 'RUNNING' | 'STOPPED' | ...
  health: string;  // should be a union, e.g. 'HEALTHY' | 'DEGRADED' | 'UNKNOWN'
}
```
These fields represent categorical states parsed from `orchestrator-state.md`. A string literal union (or at minimum a named type alias) should be used so invalid values are caught at compile time.

**`apps/cli/src/commands/status.ts`** — `PlanInfo.phases[].status` (lines 20–21):
```ts
phases: Array<{ name: string; status: string; taskCount: number; completeCount: number }>;
```
`status` here represents phase state (e.g., `IN_PROGRESS`, `COMPLETE`) and should use a string literal union or align with `TaskStatus`.

---

### [MEDIUM] File size limits exceeded — `init.ts`, `run.ts`, `status.ts`, `update.ts`, `config.ts`

**Convention:** Services/stores max 200 lines.

| File | Lines | Over by |
|------|-------|---------|
| `apps/cli/src/commands/init.ts` | 505 | 305 |
| `apps/cli/src/commands/run.ts` | 392 | 192 |
| `apps/cli/src/commands/status.ts` | 316 | 116 |
| `apps/cli/src/commands/update.ts` | 299 | 99 |
| `apps/cli/src/commands/config.ts` | 223 | 23 |

These files were large prior to the migration. The Oclif conversion did not meaningfully increase their size, but the convention applies to all files in scope. Each command file contains multiple standalone functions that could be split into private helper modules (e.g., `init-helpers.ts`, `run-helpers.ts`).

---

### [MEDIUM] Duplicate imports from the same module — `update.ts`

**Convention:** Group imports logically; multiple `import` statements from the same module are redundant and violate standard TypeScript style.

**`apps/cli/src/commands/update.ts`**

Lines 1 and 3:
```ts
import { existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';
```

Two separate `import` statements from `'node:fs'`. These should be merged:
```ts
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
```

The review context notes this split was introduced during the migration. Every other command file correctly uses a single `import` per module.

---

### [LOW] Non-null assertion operator (`!`) — `run.ts`

**Convention:** Not explicitly listed, but `!` is functionally equivalent to `as T` — it bypasses type safety.

**`apps/cli/src/commands/run.ts`** — lines 384–386:
```ts
if (dashboardProcess!.pid !== undefined) {
  try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
}
```

`dashboardProcess` is typed `ChildProcess | null`. The `!` asserts it is non-null, but the surrounding `if (dashboardProcess !== null)` check on line 379 already narrows it. TypeScript should infer the non-null type inside that block without requiring `!`. This suggests the closure captures the outer-scope reference and loses the narrowing — but the fix is to capture the narrowed value in a local `const`, not to use `!`.

---

## Files with No Issues

| File | Status |
|------|--------|
| `apps/cli/src/index.ts` | Clean — correct Oclif entry point pattern, no classes |
| `apps/cli/src/base-command.ts` | Clean — `protected override` modifiers correct, no `any`, no `as` |
| `apps/cli/src/commands/create.ts` | Clean — access modifiers, `strict = false` correctly `public static override` |
| `apps/cli/package.json` | Clean — `oclif` config block correctly structured |
| `apps/cli/project.json` | Clean — `run-cli` target added correctly |

---

## Positive Observations

- **Consistent access modifiers**: Every `static` property (`description`, `flags`, `args`, `strict`, `usage`, `examples`) and `run()` method across all seven command classes carries an explicit `public` modifier. No bare members.
- **`override` keyword**: All overridden Oclif properties use `override` — enforces `noImplicitOverride` correctness.
- **`unknown` in catch blocks**: All catch clauses with typed errors use `err: unknown` (e.g., `init.ts:404`, `run.ts:375`, `update.ts:239`). No `any` in catch.
- **Commander artifacts fully removed**: No `registerXxxCommand()` functions, no `Command` from `commander`, no `parseAsync()` remain.
- **Flag access pattern**: All flag access correctly uses Oclif's `this.parse(Xxx)` destructuring. No Commander-style option object remnants.
- **`InitFlags` interface correctly renamed** from `InitOptions` and accurately reflects kebab-case Oclif flag names.
