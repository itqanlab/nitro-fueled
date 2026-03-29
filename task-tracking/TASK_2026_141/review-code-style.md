# Code Style Review - TASK_2026_141

## Review Summary

| Metric          | Value          |
| --------------- | -------------- |
| Overall Score   | 5/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3              |
| Serious Issues  | 4              |
| Minor Issues    | 3              |
| Files Reviewed  | 4              |

## The 5 Critical Questions

### 1. What could break in 6 months?

`cortex-hydrate.ts` is 359 lines — 79% over the 200-line service limit. As the hydration scope
grows (more entity types, edge-case handling), this file will absorb every change with no
structural resistance. The single `runCortexStep` entry point hides four distinct operations
(task sync, session hydrate, handoff hydrate, status reconcile) behind a `mode` switch. The next
developer adding a new mode will be editing an already-oversized file.

The `ColumnInfoRow` interface on `cortex-db-init.ts:15` and the `TaskRow` interface on
`cortex-hydrate.ts:152` are defined inline inside function bodies. Interfaces defined at function
scope are invisible to the module's callers and cannot be reused. When a second caller needs the
same shape, they will redefine it — or worse, use `as any`.

### 2. What would confuse a new team member?

`dropHydratableTables` (`cortex-hydrate.ts:297-301`) deletes from `tasks`, `handoffs`, and
`events` but not `sessions`. The function name says nothing about this asymmetry. A developer
reading the `rebuild` mode will assume a full drop and will not notice sessions are preserved.
The user-facing message in `db-rebuild.ts:14` does say "sessions and workers tables are
preserved" — but the abstraction boundary is leaky: callers must read the implementation to
understand what the function leaves intact.

The `runCortexStep` `mode` union (`'init-or-migrate' | 'rebuild'`) has asymmetric semantics for
the reconcile path: `init-or-migrate` on an existing DB does ONLY reconcile (no import at all),
but `rebuild` always does full import regardless of DB state. This is not apparent from the
function name or its doc comment until the caller reads the implementation.

### 3. What's the hidden complexity cost?

`syncTasksFromFiles` (`cortex-hydrate.ts:65-135`) executes a transaction that contains
`readFileSync` calls per iteration (`taskPath`, `statusPath`). File I/O inside a SQLite
transaction is not a correctness problem, but it couples the transaction's hold time to
filesystem latency. In a project with hundreds of task folders, the read loop holds a write
transaction for the full scan duration. This is a minor risk today, but the pattern will
worsen as task count grows.

`INDEXES` in `cortex-db-init.ts:160-180` is a plain `const` array (not a named constant with
`SCREAMING_SNAKE_CASE` and `readonly`). It follows the naming convention superficially but is
missing `readonly` to communicate immutability intent.

### 4. What pattern inconsistencies exist?

**Duplicate `node:fs` import block in `update.ts`.** Lines 1-3 import `existsSync` from
`node:fs`, then line 3 imports `copyFileSync` and `mkdirSync` from `node:fs` again. This is a
direct violation of the import-consolidation pattern every other command file follows. `init.ts`
imports all `node:fs` symbols in a single destructuring statement on line 1.

**Inline interface definitions inside function bodies** (`ColumnInfoRow` at
`cortex-db-init.ts:15`, `TaskRow` at `cortex-hydrate.ts:152`) conflict with the project rule
that interfaces go at module scope (or in `.model.ts` files). Every other interface in the CLI
codebase (`Manifest`, `CoreFileEntry`, `FileResult`, `InitFlags`) is declared at file scope.

**`INDEXES` naming.** The review-general lesson (`SCREAMING_SNAKE_CASE` for const domain objects)
is satisfied by the name, but the declaration is missing `as const` or `readonly` annotation.
Contrast with `VALID_STATUSES` at line 140, which correctly uses `new Set(...)` — that object is
genuinely immutable. `INDEXES` is a mutable `Array` and there is no guard against accidental
mutation.

**`cortex-db-init.ts` file size.** At 211 lines it exceeds the 200-line service limit by 6%.
This is marginal but still a violation. The schema DDL strings are the inflating factor.

### 5. What would I do differently?

- Extract the four hydration sub-steps (`syncTasksFromFiles`, `hydrateSessions`,
  `hydrateHandoffs`, `reconcileStatusFiles`) into their own module (`cortex-sync.ts` or
  `cortex-reconcile.ts`) and reduce `cortex-hydrate.ts` to the entry-point + types layer.
  This gets both files under 200 lines and separates concerns cleanly.
- Hoist `ColumnInfoRow` and `TaskRow` to module scope, or share them in a lightweight
  `cortex-types.ts` model file.
- Consolidate the two `node:fs` import lines in `update.ts` into one.
- Rename `dropHydratableTables` to `dropTaskAndHandoffData` (or add a comment listing
  exactly which tables are and are not touched) to remove the asymmetry surprise.

---

## Blocking Issues

### Issue 1: `cortex-hydrate.ts` exceeds file size limit by 80%

- **File**: `apps/cli/src/utils/cortex-hydrate.ts` (359 lines)
- **Problem**: The 200-line service limit is documented as the hardest limit for utility/service
  files. At 359 lines this file is almost double the limit. It contains four distinct
  sub-operations (task sync, session hydrate, handoff hydrate, status reconcile) that each have
  independent logic, state, and failure modes.
- **Impact**: Every future hydration change touches this file. Cognitive load is high. The file
  size rule exists precisely to prevent this kind of aggregation.
- **Fix**: Extract `syncTasksFromFiles`, `reconcileStatusFiles`, `hydrateSessions`,
  `hydrateHandoffs` into a sibling file (`cortex-sync.ts`). Keep `cortex-hydrate.ts` as the
  public API (entry point, types, `runCortexStep`). Both files will fall well under 200 lines.

### Issue 2: Inline interface definitions inside function bodies

- **File**: `apps/cli/src/utils/cortex-db-init.ts:15`, `apps/cli/src/utils/cortex-hydrate.ts:152`
- **Problem**: `interface ColumnInfoRow` is defined inside `applyMigrations`, and `interface
  TaskRow` is defined inside `reconcileStatusFiles`. TypeScript technically allows this, but it
  means neither interface is visible at module scope, cannot be exported, and cannot be reused
  without copying. Every other interface in the CLI codebase is declared at file scope. This
  breaks the project's "one interface, module scope" pattern.
- **Impact**: When a second caller needs `TaskRow` they will define it independently, producing
  two definitions of the same shape that can silently diverge.
- **Fix**: Move both interfaces to module scope. They are private; no export is needed. Place
  them above the function that uses them.

### Issue 3: Duplicate `node:fs` import in `update.ts`

- **File**: `apps/cli/src/commands/update.ts:1-3`
- **Problem**: Two separate `import ... from 'node:fs'` statements exist on lines 1 and 3.
  `existsSync` is imported on line 1; `copyFileSync` and `mkdirSync` are imported on line 3.
  Every other command in the codebase (e.g. `init.ts:1`) uses a single destructured import from
  `node:fs`. Duplicate same-source imports are dead code smell and violate import consolidation.
- **Impact**: Cosmetic but directly violates the import-order rule. It also suggests the Step 5.5
  insertion was done without reviewing the existing import block.
- **Fix**: Merge into one statement:
  `import { existsSync, copyFileSync, mkdirSync } from 'node:fs';`

---

## Serious Issues

### Issue 1: `cortex-db-init.ts` file size exceeds limit

- **File**: `apps/cli/src/utils/cortex-db-init.ts` (211 lines, limit 200)
- **Problem**: The 200-line limit is exceeded. The inflating factor is the inline DDL strings. At
  211 lines this is a minor breach, but it sets the trajectory: every new table added to the
  schema pushes this further over the limit with no natural extraction point.
- **Tradeoff**: The DDL being inline makes it easy to review the full schema in one place. But
  the limit exists. The schema strings could be extracted to a companion `cortex-schema.ts`
  constant file.
- **Recommendation**: Extract the DDL strings to a `const SCHEMA` map in a sibling
  `cortex-schema.ts`. `cortex-db-init.ts` becomes the exec loop only, dropping to ~50 lines.

### Issue 2: `INDEXES` array is mutable

- **File**: `apps/cli/src/utils/cortex-db-init.ts:160`
- **Problem**: `const INDEXES = [...]` is a plain mutable array. It is iterated directly in the
  `for` loop at line 181. `VALID_STATUSES` (cortex-hydrate.ts:140) uses `new Set` which is also
  mutable, but at least conveys domain-object intent. The review-general rule calls for
  `SCREAMING_SNAKE_CASE` for const domain objects — the name is right but the type has no
  immutability signal.
- **Tradeoff**: `as const` on a string array makes TypeScript treat each element as a string
  literal. That is fine here since the values are not used as types elsewhere.
- **Recommendation**: Add `as const` to communicate that the array is a fixed registry:
  `const INDEXES = [...] as const;`. This prevents accidental `push` or `splice`.

### Issue 3: `dropHydratableTables` asymmetry is not encoded in the type

- **File**: `apps/cli/src/utils/cortex-hydrate.ts:297-301`
- **Problem**: The function deletes tasks, handoffs, and events but silently leaves sessions and
  workers intact. The name `dropHydratableTables` implies all hydratable tables, but sessions are
  also hydrated in `hydrateSessions`. The distinction (sessions are preserved across rebuilds)
  is a deliberate design choice documented only in the `db-rebuild.ts` console output. Nothing
  in the function's name or signature communicates this contract.
- **Tradeoff**: Renaming is a minor change; the logic is correct as written.
- **Recommendation**: Rename to `clearImportedData` or add a JSDoc: `/** Clears tasks, handoffs,
  and events rows. Sessions and workers are intentionally preserved. */`

### Issue 4: `syncTasksFromFiles` transaction wraps filesystem I/O

- **File**: `apps/cli/src/utils/cortex-hydrate.ts:95-133`
- **Problem**: `db.transaction()` at line 95 wraps the entire file scan loop. Each iteration
  calls `readFileSync` (lines 107-109) and `JSON.stringify` before the `upsert.run()` call. The
  transaction holds a write lock on the DB for the full duration of all file reads. For most
  projects this is acceptable, but it couples DB lock time to FS latency and task count.
- **Tradeoff**: This mirrors the sync.ts source it was inlined from, so the pattern is
  intentional. The risk is low today.
- **Recommendation**: Document the known tradeoff with a comment above the transaction so future
  maintainers understand why file reads are inside it (atomicity — all tasks imported or none)
  rather than assuming it was an oversight.

---

## Minor Issues

- **`cortex-hydrate.ts:293-295`**: `resolveDbPath` is a one-liner wrapper around `resolve`. It
  adds a name but no logic. Reasonable for readability, but worth noting it is not needed since
  `runCortexStep` is the only caller and the one-liner could be inlined there.

- **`update.ts:274-298`**: Step 5.5 is numbered "5.5" in the comment. The review-general lesson
  explicitly calls out that sub-letter / decimal step numbers in command docs are a pattern
  defect. The comment is internal (not in a SKILL.md), but it still sets a precedent. Use
  sequential numbering or a named section heading.

- **`cortex-hydrate.ts:10`**: The section divider comment style (`// ─── Public types ───`) is
  used throughout the file but does not appear in any other util file in the codebase. It is
  readable but is an inconsistency with the rest of the project's util files which do not use
  box-drawing characters.

---

## File-by-File Analysis

### `cortex-db-init.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: The schema DDL is accurate and idempotent. The `applyMigrations` helper is well
scoped. The file exceeds the 200-line limit by 6% — not catastrophic but real. The inline
`ColumnInfoRow` interface is the more important defect.

**Specific Concerns**:
1. Line 15: `interface ColumnInfoRow` defined inside function body — blocking (moved to module
   scope required).
2. Line 160: `const INDEXES` — mutable array with no `as const`.
3. Lines 211: File ends at exactly 211 lines, past the 200-line service limit.

---

### `cortex-hydrate.ts`

**Score**: 4/10
**Issues Found**: 1 blocking, 3 serious, 2 minor

**Analysis**: The logic is correct and the error handling is solid throughout (no swallowed
errors, proper `err instanceof Error` narrowing). However, at 359 lines this file is a
maintenance problem before it ships. The four sub-operations are clearly delineated by section
comments, which is a good sign — it means the extraction path is obvious. The section comments
also make the inline `TaskRow` interface on line 152 more glaring since there is already a
section structure that could host hoisted types.

**Specific Concerns**:
1. Line 152: `interface TaskRow` defined inside `reconcileStatusFiles` — blocking.
2. Lines 95-133: File I/O inside a transaction — undocumented intentional tradeoff.
3. Lines 297-301: `dropHydratableTables` asymmetry is unnamed in the function signature.
4. File length: 359 lines vs 200-line limit — blocking.

---

### `update.ts`

**Score**: 6/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The Step 5.5 insertion is logically correct and fits cleanly into the command's
flow. Output messages are consistent with the file's existing console pattern. The duplicate
import is the only real defect — it is clearly an insertion artifact from adding the new import
without reviewing the existing block.

**Specific Concerns**:
1. Lines 1 and 3: Two separate `import ... from 'node:fs'` statements — blocking.
2. Line 274: Step numbered "5.5" in comment — minor, but a documented anti-pattern.

---

### `db-rebuild.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Clean, minimal, well-scoped command. 37 lines, well inside limits. Error handling is
correct. Output messages are readable and accurate. The file is the best piece of work in this
changeset. No issues worth escalating.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                              |
| -------------------------------- | ------ | ---------------------------------------------------- |
| File size limits                 | FAIL   | cortex-hydrate.ts 359 lines (limit 200); cortex-db-init.ts 211 lines (limit 200) |
| Interface at module scope        | FAIL   | Two inline interface definitions inside function bodies |
| Import consolidation             | FAIL   | Duplicate node:fs import in update.ts                |
| No `any` type                    | PASS   | All error narrowing uses `unknown` + `instanceof`    |
| No `as` type assertions          | PASS   | Only one `as TaskRow` cast; acceptable on typed `.get()` result |
| Error handling — no swallowing   | PASS   | All catch blocks log before continuing               |
| SCREAMING_SNAKE_CASE domain constants | PASS | VALID_STATUSES, INDEXES, TASK_ID_RE all correct     |
| Exported types visible to callers | PASS  | HydrationResult, CORTEX_DB_PATH_REL exported cleanly |

## Technical Debt Assessment

**Introduced**:
- `cortex-hydrate.ts` at 359 lines is a maintenance magnet. Any expansion of the hydration scope
  (new entity types, error reporting, retry logic) will make the file harder to navigate with
  no natural split point until someone explicitly takes the extraction work.
- The inline interface pattern, if left, will be imitated in future edits to this file.

**Mitigated**:
- The inlined schema approach (vs cross-package import) is the right call given the tsconfig
  constraint. The sync comment at the top of `cortex-db-init.ts` is explicit and actionable.
- The `runCortexStep` null-return on DB error is clean — callers get a typed failure signal
  rather than an exception propagating up through the command.

**Net Impact**: Moderate new debt. The size violations are the primary driver.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `cortex-hydrate.ts` at 359 lines violates the file size rule by 80%. The
extraction path is already visible (four section-comment-delineated sub-operations). The
duplicate import in `update.ts` and two inline interfaces are secondary blockers but are all
one-line fixes.

## What Excellence Would Look Like

A 10/10 version of this changeset would:
- Have `cortex-sync.ts` containing `syncTasksFromFiles`, `hydrateSessions`, `hydrateHandoffs`,
  `reconcileStatusFiles` — each with its own exported type for its return value.
- Have `cortex-hydrate.ts` reduced to ~80 lines: the public `HydrationResult` interface, the
  `runCortexStep` entry point, and `dropHydratableTables`.
- Have `cortex-db-init.ts` extract DDL to a `SCHEMA` const in a sibling file, keeping the init
  function under 60 lines.
- Have `ColumnInfoRow` and `TaskRow` at module scope with a comment noting they are internal.
- Have a single consolidated `node:fs` import line in `update.ts`.
- Document the file-I/O-inside-transaction tradeoff with one sentence of JSDoc.
