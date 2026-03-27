# Code Style Review — TASK_2026_058

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | code-style-reviewer |
| Task | TASK_2026_058 — Per-Task Status Files |
| Commit | abf4623 |
| Overall Score | 6/10 |
| Verdict | FAIL |

---

## Findings

### BLOCKING

---

#### B1 — Scaffold auto-pilot/SKILL.md not a true mirror of source (2 stale lines)

**Files**: `packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`
**Convention**: Scaffold files must mirror source changes exactly.

`diff` confirms 6 divergences between source and scaffold. Two divergences are stale old-design wording remaining in the **scaffold** that the source correctly updated:

- **Scaffold line 1595**: `3. **Registry is the source of truth** for task status`
  Source correctly reads: `3. **Per-task \`status\` files are the source of truth** for task state — registry.md is a generated artifact for metadata and enumeration only`

- **Scaffold line 1597**: `5. **Workers update the registry themselves** -- you monitor state transitions, not cause them`
  Source correctly reads: `5. **Workers write their own \`status\` file** as their final action -- you monitor state transitions by reading \`status\` files, not causing them`

These are Key Principles — an agent reading the scaffold will follow old behavior and write to registry.md instead of the status file.

---

#### B2 — `FIXING` missing from `STATUS_ORDER` in `status.ts`

**File**: `packages/cli/src/commands/status.ts`, line 27–30
**Convention**: Enum values must match canonical source — all valid statuses must be represented consistently.

`FIXING` was added to `VALID_STATUSES` in `registry.ts` but `STATUS_ORDER` in `status.ts` only has:

```typescript
const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  'IN_PROGRESS', 'CREATED', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'BLOCKED', 'FAILED', 'CANCELLED',
];
```

`FIXING` is absent. Tasks in `FIXING` state will be silently omitted from the Task Summary section of the full status display (the `for (const status of STATUS_ORDER)` loop on line 196). They are still parsed and shown in the Task Details table (row loop on line 260), but the count-by-status summary skips `FIXING`.

---

### SERIOUS

---

#### S1 — Hardcoded date in `generateRegistry()` fallback

**File**: `packages/cli/src/utils/registry.ts`, line 156
**Convention**: No hardcoded dates; utilities shipped as packages must not contain build-time constants.

```typescript
const created = existingRow?.created ?? '2026-03-27';
```

`'2026-03-27'` is today's date at time of authoring. Any task folder without a prior registry entry that is created after this date will be assigned the wrong creation date. Should use a dynamic expression such as `new Date().toISOString().slice(0, 10)`.

---

#### S2 — Stale "registry state" wording in source `auto-pilot/SKILL.md` (3 lines)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Convention**: Named concepts must use one term everywhere.

Three lines in the source file still use old "registry" language after the refactoring. The scaffold partially corrected these but the source did not:

- **Line 677** (`7e — IF state did NOT transition`):
  `- Leave registry state as-is (do NOT reset to CREATED)`
  Should be: `Leave status file as-is (do NOT reset to CREATED)`

- **Line 856** (Step 8c — compute session totals):
  `- Tasks blocked: count of tasks whose final registry state is \`BLOCKED\``
  Should be: `count of tasks whose final state is \`BLOCKED\``

- **Line 1585** (Dependency Cycle section):
  `- Mark **all** tasks in the cycle as **BLOCKED** in the registry.`
  Should be: `Write \`BLOCKED\` to \`task-tracking/TASK_YYYY_NNN/status\` for all tasks in the cycle.`

Lines 677 and 1585 in particular could cause a reader to believe registry.md writes are appropriate in those paths.

---

#### S3 — Stale "update the registry" in `planner.md` Section 3e, step 11

**File**: `.claude/agents/planner.md`, line 151
**Convention**: Partial delegation defeats SOT pattern — if removing inline rules in favor of external file, remove ALL inline copies.

```
11. **On approval**: create the replacement tasks using Section 4 rules,
    update the registry, and set the oversized task's status to `CANCELLED` in the registry.
```

"Update the registry" and "set status to CANCELLED in the registry" directly conflict with the new design. The Planner should write `CANCELLED` to `task-tracking/TASK_YYYY_NNN/status`. No direct registry.md mutation is permitted. The registry regenerates on the next `/project-status` or `nitro-fueled status` call.

---

#### S4 — Stale "Add the missing registry entry" in `planner.md` Section 10, step 1

**File**: `.claude/agents/planner.md`, line 411
**Convention**: Named concepts must use one term everywhere — "registry is generated, not appended to" is now the design.

```
1. **Task folder exists but no registry entry**: Add the missing registry entry (read `task.md` for metadata)
```

This instructs the Planner to append a row to registry.md, which contradicts the new design. The correct recovery action is: create `task-tracking/TASK_YYYY_NNN/status` with the appropriate state, and let `/project-status` regenerate the registry entry.

---

#### S5 — Stale "registry updated" wording in `orchestration/SKILL.md` Build Worker Exit Gate

**File**: `.claude/skills/orchestration/SKILL.md`, lines 403 and 421

Two stale references after the refactoring:

- **Line 403** (Exit Gate table header):
  `Run these checks after implementation is committed and registry is updated:`
  Workers no longer update the registry — they write the status file. Should read: `...and status file is written`

- **Line 421** (Exit Gate failure instruction):
  `Do not exit with uncommitted work or an un-updated registry.`
  Should read: `Do not exit with uncommitted work or an un-written status file.`

---

#### S6 — Stale "report + registry + plan update" in commit message spec in `orchestration/SKILL.md`

**File**: `.claude/skills/orchestration/SKILL.md`, line 334

```
3. Third commit: completion bookkeeping (report + registry + plan update)
```

The registry is no longer written during completion bookkeeping — it is generated on demand. The commit message spec should be updated to remove "registry": `completion bookkeeping (report + status file + plan update)` or similar.

---

#### S7 — Mixed stderr output methods in `registry.ts`

**File**: `packages/cli/src/utils/registry.ts`
**Convention**: Pick one method for error output and apply it consistently.

Two different approaches are used in the same file:

- `console.error(...)` at lines 108 and 178
- `process.stderr.write(...)` at lines 125, 129, and 135

`console.error` is the standard Node.js pattern and is used by the rest of the CLI (visible in `status.ts`). `process.stderr.write` is lower-level and requires the caller to manage newlines. Mix causes inconsistent log formatting (the `process.stderr.write` messages use `\n` explicitly; console.error adds it automatically).

---

#### S8 — Duplicate step number "3." in First-Run Fix Worker Prompt

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 1256 and 1265
**Convention**: Step numbering must be flat and sequential.

The First-Run Fix Worker Prompt has two items labeled `3.`:

```
3. Build a fix list in priority order:
   ...
3. Apply all fixes from the list.
```

The second "3." should be "4." and subsequent steps (currently 4, 5, 6, 7) should become 5, 6, 7, 8. As written, a worker reading the list would interpret step 4 ("Apply all fixes") as a second step 3, not a distinct numbered action.

---

### MINOR

---

#### M1 — Non-null assertions on regex capture groups in `registry.ts`

**File**: `packages/cli/src/utils/registry.ts`, lines 51–58
**Convention**: No `as` assertions / non-null assertions without type guards.

Inside the `for` loop, capture groups are accessed with `!` non-null assertions:

```typescript
id: match[1]!,
status: status as TaskStatus,
type: match[3]!,
description: match[4]?.trim() ?? '',
created: match[5]!,
```

`match[1]`, `match[3]`, and `match[5]` are `string | undefined` by TypeScript's regex match type. They are provably non-null if the regex matched (the groups are not optional in the pattern), but this is not guarded. `match[4]` is already safely handled with `?.trim() ?? ''`. The `!` on groups 1, 3, and 5 should either be guarded (`if (match[1] === undefined) continue;`) or at minimum commented explaining why they cannot be undefined.

---

#### M2 — Missing return type annotations on functions in `status.ts`

**File**: `packages/cli/src/commands/status.ts`
**Convention**: Explicit type annotations for consistency with the codebase pattern.

`registry.ts` functions all have explicit return type annotations (`): RegistryRow[]`, `): void`, etc.). In `status.ts`, the following functions lack return type annotations:

- `parseActiveWorkers(cwd: string)` — returns `WorkerEntry[]`
- `parsePlan(cwd: string)` — returns `PlanInfo | null`
- `displayBrief(rows, workers)` — returns `void`
- `displayFull(rows, workers, plan)` — returns `void`

Only `countByStatus` is explicitly typed. Minor inconsistency, but should be uniform within the file.

---

#### M3 — Inconsistent placeholder token style in `orchestration/SKILL.md`

**File**: `.claude/skills/orchestration/SKILL.md`, multiple lines
**Convention**: Placeholder tokens must use single project-standard convention — `{TASK_YYYY_NNN}` curly-brace style.

The NEW_TASK initialization section and Completion Phase use `TASK_[ID]` bracket notation:

- Line 116: `Read(task-tracking/registry.md)` / `mkdir task-tracking/TASK_[ID]`
- Line 340: `Write \`task-tracking/TASK_[ID]/completion-report.md\``
- Line 376: `Write \`task-tracking/TASK_[ID]/status\` with...`
- Lines 405–413: All Exit Gate table entries use `TASK_[ID]`

The auto-pilot/SKILL.md worker prompts consistently use `TASK_YYYY_NNN`. The mixed notation is a minor readability issue but violates the project convention noted in the review-context.

---

#### M4 — `RegistryRow` interface missing `model` field (asymmetry)

**File**: `packages/cli/src/utils/registry.ts`, lines 15–21
**Convention**: Data-transformation pipelines must carry forward all attributes consumed by downstream steps.

`generateRegistry()` writes a 6-column table including a `Model` column. `parseRegistry()` uses a 5-column regex and `RegistryRow` has no `model` field. The parse omits a column the generator writes. If any downstream consumer (e.g., a future step 8c analytics query) needs the model from the registry, it cannot be read via `parseRegistry`. Currently this doesn't cause breakage, but the asymmetry is a latent maintainability issue.

---

#### M5 — `task-tracking/registry.md` rows for TASK_2026_047 and TASK_2026_048 missing Model column

**File**: `task-tracking/registry.md`, lines 52–53

Two rows are missing the 6th `| Model |` cell:

```
| TASK_2026_047 | COMPLETE    | REFACTORING | Unified /run, /create, /status Commands... | 2026-03-27 |
| TASK_2026_048 | COMPLETE    | FEATURE     | /retrospective Command...                  | 2026-03-27 |
```

All other rows end with `| — |` or `| default |`. Since registry.md is a generated artifact, this inconsistency means `generateRegistry()` was not run to produce the final state, or the backfill commit left these rows without regenerating. `parseRegistry()` will still parse these rows (5-column regex matches), but the table display is visually broken.

---

#### M6 — Missing explicit substitution step for worker prompt templates

**File**: `.claude/skills/auto-pilot/SKILL.md`, Step 5b
**Convention**: Prompt templates must include explicit substitution steps, not just prose notes.

Step 5b instructs the Supervisor to "Select the appropriate prompt template" but does not list the substitution variables or state where to find them. All templates use `TASK_YYYY_NNN`, `{project_root}`, `{N}`, and `{reason}` as placeholders, but there is no "Before using this template, substitute:" step. A reader must infer the substitutions from context. Adding an explicit substitution table before the templates would prevent misuse.

---

## Summary of Findings

| Severity | Count | IDs |
|----------|-------|-----|
| Blocking | 2 | B1, B2 |
| Serious | 6 | S1–S8 (numbered 1–8, where S7 and S8 use numbers 7 and 8) |
| Minor | 6 | M1–M6 |
| **Total** | **14** | |

### Top Fixes Required Before Merge

1. **B1** — Sync scaffold auto-pilot/SKILL.md lines 1595 and 1597 with source (Key Principles section)
2. **B2** — Add `'FIXING'` to `STATUS_ORDER` in `status.ts`
3. **S1** — Replace hardcoded `'2026-03-27'` with dynamic date in `registry.ts`
4. **S2** — Fix 3 stale "registry state" lines in source `auto-pilot/SKILL.md` (lines 677, 856, 1585)
5. **S3** — Fix stale "update the registry" in `planner.md` Section 3e step 11
6. **S4** — Fix stale "Add the missing registry entry" in `planner.md` Section 10 step 1
7. **S5/S6** — Fix stale "registry updated" and commit message in `orchestration/SKILL.md`
8. **S7** — Standardize stderr output to `console.error` throughout `registry.ts`
9. **S8** — Renumber duplicate step 3 in Fix Worker Prompt
