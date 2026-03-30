# Code Logic Review — TASK_2026_140

## Score: 6/10

## Review Summary

| Metric              | Value          |
|---------------------|----------------|
| Overall Score       | 6/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2              |
| Serious Issues      | 3              |
| Moderate Issues     | 4              |
| Failure Modes Found | 9              |

---

## Acceptance Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| reconcile_status_files: file wins | ✅ | `updateStatus.run(fileStatus, entry.name)` — file value always written, no conditional |
| reconcile: no INSERT | ✅ | Only `UPDATE tasks SET status = ?` — `!row` path increments `missing` and continues |
| CLI: DB path with fallback | ✅ | `existsSync(dbPath)` check, try/catch, `usedDb` flag, fallback to file scan |
| CLI: db.close() in finally | ✅ | Inner `try/finally { db.close() }` always fires regardless of query error |
| Graceful fallback everywhere | PARTIAL | CLI and task creation are best-effort; reconcile error inside the transaction body is NOT best-effort (see Critical #1) |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Counter inflation from two distinct `missing` cases.** In `handleReconcileStatusFiles` the `missing` counter is incremented for both (a) a task folder has no `status` file on disk and (b) a task folder has a `status` file but no corresponding DB row. These are semantically different situations — a freshly created task with no DB row is not "missing" in the same way as a task that exists in the DB but lost its status file. The returned `{ missing }` count is ambiguous; callers (auto-pilot SKILL.md, users reading the return value) cannot distinguish the two causes without extra investigation.

**Empty / whitespace-only status file accepted silently.** `readFileSync(statusPath, 'utf8').trim()` on a file containing only whitespace or a newline yields an empty string `""`. This empty string is then compared against `row.status`. If they differ (virtually guaranteed), `updateStatus.run("", entry.name)` writes `""` to the DB — a value that is not in the valid enum. The DB has no CHECK constraint enforcing the enum, so this lands silently. `nitro-fueled status` will then fall back to `'CREATED'` because `""` fails the `TASK_STATUS_VALUES.includes` check, but the DB row is now corrupted until the next file write.

**`dbRowsToRegistryRows` swallows an invalid `created_at` format silently.** A value like `"2026-03-29"` (no `T`) returns `""` rather than `'Unknown'` because `(createdAt || 'Unknown')` only guards against falsy and `"2026-03-29"` is truthy, but `createdAt.includes('T')` is false so the ternary takes the second branch: `(createdAt || 'Unknown')` which returns `"2026-03-29"`. This is actually correct for plain date strings — however a value like `"invalid"` also lands here, appearing as a date string in the rendered table. Moderate issue, not critical.

### 2. What user action causes unexpected behavior?

**Running `reconcile_status_files` before `sync_tasks_from_files` on a fresh DB.** The handoff.md itself documents this as a known risk, but the SKILL.md startup sequence explicitly calls `sync_tasks_from_files()` first then `reconcile_status_files()`. The problem is that `sync_tasks_from_files` is described as a one-time bootstrap ("safe to re-run"), while `reconcile_status_files` runs on every startup. If the first run of `sync_tasks_from_files` is interrupted mid-transaction (file lock, SIGTERM), only some tasks land in the DB. On the next startup, `reconcile_status_files` silently increments `missing` for every unimported task but writes nothing. The supervisor sees a DB with incomplete task coverage and operates on stale data.

**`nitro-fueled status` called while cortex is being written by a concurrent supervisor session.** The CLI opens the DB with `readonly: true`, which prevents writes, but SQLite in WAL mode can still throw `SQLITE_BUSY` if a checkpoint is in progress. The catch block will log a warning and fall back to the file scan — which is the correct behaviour. However, the user observes inconsistent output (DB-rendered one second, file-rendered the next) with no indication this is happening beyond a console.warn. The warn uses `console.warn`, not `this.error` or `this.warn` from oclif, so the output formatting may differ from other CLI messages.

### 3. What data makes this produce wrong results?

**Empty status file (Critical #2 above).** `""` written to DB status column.

**Status file containing a valid status with a trailing newline.** `.trim()` handles this correctly — not a bug, just confirming it works.

**`task.md` with a title containing a pipe character.** The `parseTitle` function returns the full first-line text after `# Task: `, which could include `|`. This flows into the `title` column via `handleSyncTasksFromFiles`. When `dbRowsToRegistryRows` reads it back, `row['title']` is used directly in the description field — no escaping. The rendered output table in `displayFull` could become garbled if the title contains `|`. The `padEnd` / `slice` truncation is purely for display, so the column alignment would break for such rows.

**`task.md` whose Description section contains another `## ` heading.** The regex `## Description\s*\n([\s\S]*?)(?=\n## |$)` stops at the next `## ` heading. This is correct for well-formed files, but a description block that embeds a code block containing `## ` as a markdown comment or heading would be truncated at that line. Not data corruption, but `description` would be shorter than intended. Low probability in practice.

### 4. What happens when dependencies fail?

**SQLite throws mid-transaction in `runReconcile`.** `better-sqlite3` transactions automatically roll back on throw. This means ALL the `updateStatus.run()` calls in the current loop iteration are rolled back. However, the `drifted`/`matched`/`missing` counters have already been incremented in JavaScript memory up to the point of failure — they are now inconsistent with the DB state (the DB rolled back but the counters did not). The returned `{ ok: true, drifted, matched, missing }` would report changes that were actually rolled back. There is no `try/catch` around `runReconcile()` itself; an uncaught throw would propagate to the MCP tool handler. The MCP SDK may or may not return a graceful error to the caller — behaviour is SDK-dependent.

**`readFileSync(statusPath, 'utf8')` throws inside the transaction.** If the OS refuses to read the file (permissions, TOCTOU removal between `existsSync` and `readFileSync`), this throws synchronously inside the `db.transaction()` callback. `better-sqlite3` will roll back the transaction, and the throw propagates to `runReconcile()` which is called bare (no wrapping try/catch). The MCP tool call fails with an uncaught exception, potentially crashing the cortex server or returning an opaque error to the supervisor.

**`better-sqlite3` module absent at CLI startup.** The `require('better-sqlite3')` call is inside a try/catch that logs `console.warn` and falls back to the file scan. This is correct. However, the warning text includes the raw error message (e.g., `"Cannot find module 'better-sqlite3'"`) which may confuse users who don't know this is expected in a fresh environment.

### 5. What's missing that the requirements didn't mention?

**`Session log.md rendered from events table` — not implemented at all.** Task.md AC item 3 explicitly states: "Session log.md rendered from events table at session end." There is no implementation of this in any of the changed files. The handoff.md does not mention it as deferred — it is simply absent. This is a gap in the acceptance criteria coverage.

**No `drift detection` warning log.** Task.md AC item 7 states: "Drift detection: log warnings when file and DB disagree." The `handleReconcileStatusFiles` function updates the DB silently (no log entry, no stdout message). The returned JSON has a `drifted` count, but a caller must explicitly inspect it. The SKILL.md says "log a warning" on failure of the call itself, not on detected drift. A caller that ignores the response body (or only checks `ok: true`) never surfaces the warning described in the requirements.

**`No data loss scenario: DB can be rebuilt entirely from files`** — partially implemented. `sync_tasks_from_files` covers task metadata. But handoff data exists only as a dual write — if the DB is deleted and `sync_tasks_from_files` is re-run, the `handoffs` table is empty. `handoff.md` files on disk are not ingested by any sync tool. The handoff DB is not rebuildable from files alone.

---

## Failure Mode Analysis

### Failure Mode 1: Empty status file corrupts DB row

- **Trigger**: Worker writes a blank or whitespace-only `status` file (crash mid-write, editor error, truncation).
- **Symptoms**: `reconcile_status_files` writes `""` to `tasks.status`. Subsequent `nitro-fueled status` falls back to `CREATED` display because `""` is not in `TASK_STATUS_VALUES`. DB row reports `""`, display shows `CREATED` — they disagree silently.
- **Impact**: Task appears as CREATED despite being in a terminal state. Supervisor may attempt to re-process a COMPLETE task.
- **Current Handling**: None. `fileStatus = readFileSync(statusPath, 'utf8').trim()` — empty string passes unconditionally into `updateStatus.run`.
- **Recommendation**: Add a guard before the comparison: `if (fileStatus.length === 0) { missing++; continue; }`. A zero-byte status file is treated the same as a missing file. This also prevents writing an invalid enum value to the DB.

### Failure Mode 2: Error inside the transaction — counters diverge from actual DB state

- **Trigger**: `readFileSync` throws (permission error, TOCTOU removal) or `selectRow.get` throws (DB corruption, locked page) inside `runReconcile`.
- **Symptoms**: Transaction rolls back. Counter variables already incremented in JS reflect changes that did not persist. MCP caller receives either an unhandled exception (server crash) or misleading `{ ok: true, drifted: N }` that overstates N.
- **Impact**: Supervisor logs incorrect reconciliation counts. If the server crashes, auto-pilot startup sequence fails at reconcile step and must be restarted manually.
- **Current Handling**: No try/catch around `runReconcile()` or `readFileSync` inside the transaction body.
- **Recommendation**: Wrap `runReconcile()` in try/catch; on error return `{ ok: false, reason: err.message, drifted, matched, missing }`. Reset counters to zero if the transaction rolled back (or track counters inside the transaction closure and only assign them after `runReconcile()` completes).

### Failure Mode 3: Session log.md not rendered from events table

- **Trigger**: Session ends normally. No code path renders `log.md` from the `events` table.
- **Symptoms**: `log.md` files remain as append-only text from the file-based path. If cortex is the source of truth, the events table has data that never materialises on disk. `git log` + files no longer provides a complete audit trail (contradicts the task requirement: "git log + files = full audit trail independent of DB").
- **Impact**: Acceptance criterion 3 is unmet. Partial audit trail. Users expecting log.md in the session folder will find either the old-style or missing file.
- **Current Handling**: Not implemented. No render-from-events logic anywhere in the changed files.
- **Recommendation**: Implement a `handleRenderSessionLog` function (or equivalent) that queries `events` for the session and writes `log.md`. This is a missing deliverable, not an edge case.

### Failure Mode 4: `missing` counter conflates two distinct conditions

- **Trigger**: Any task folder where either (a) no `status` file exists, or (b) no DB row exists.
- **Symptoms**: Caller cannot tell whether `missing` means "task not yet bootstrapped to DB" or "task's status file was deleted on disk."
- **Impact**: Auto-pilot's startup reconciliation summary is ambiguous. Operators diagnosing drift cannot distinguish new tasks (normal) from lost status files (data loss signal).
- **Current Handling**: Both conditions increment `missing` identically.
- **Recommendation**: Return two separate counters, e.g. `missing_status_file` and `missing_db_row`, or rename the single counter to `skipped` with a comment. Low-cost fix that improves observability.

### Failure Mode 5: `nitro-create-task` Step 5c calls `upsert_task` but Step 5b commits first if cortex fails

- **Trigger**: `upsert_task` fails after the status file is written but before the git commit in Step 5b.
- **Symptoms**: The instruction in nitro-create-task.md says "Do NOT block Step 5b" — so the commit proceeds. On next supervisor startup, `sync_tasks_from_files` imports the task. This is the intended fallback. **However**, Step 5b text says to commit after Step 5 (status file), and Step 5c is between them. The ordering comment says "Do NOT block Step 5b" but the current Step 5c text physically appears before Step 5b in the markdown. A Build Worker reading the instructions in document order would call `upsert_task`, then commit. The instructions are clear in prose but the section ordering could mislead a literal reader into treating 5c as blocking 5b.
- **Impact**: Confusion risk for AI agents executing the steps; not a runtime bug per se, but a documentation logic gap.
- **Current Handling**: Prose says best-effort and non-blocking, but section numbering is 5 → 5c → 5b which suggests 5c precedes 5b.
- **Recommendation**: Renumber as 5 → 5a (cortex upsert) → 5b (commit), or add a bold note at the top of 5c stating "This step is non-blocking and does not gate 5b."

---

## Critical Issues

### Issue 1: No guard against empty fileStatus corrupting DB

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sync.ts:176`
- **Scenario**: Worker process is killed mid-write, leaving an empty or whitespace-only `status` file. `reconcile_status_files` reads it, `.trim()` returns `""`, and `updateStatus.run("", entry.name)` writes an invalid enum value to the DB.
- **Impact**: DB row `status = ""`. CLI shows the task as `CREATED`. Supervisor could re-process a task that was previously COMPLETE, FAILED, or any other terminal state.
- **Evidence**:
  ```ts
  const fileStatus = readFileSync(statusPath, 'utf8').trim();
  // No length check — empty string flows through
  if (row.status === fileStatus) {
    matched++;
  } else {
    updateStatus.run(fileStatus, entry.name); // writes "" to DB
    drifted++;
  }
  ```
- **Fix**: Add `if (fileStatus.length === 0) { missing++; continue; }` immediately after reading `fileStatus`.

### Issue 2: Unguarded `runReconcile()` call — exception propagates uncaught from transaction body

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sync.ts:193`
- **Scenario**: `readFileSync` inside the transaction callback throws (e.g., TOCTOU: file removed between `existsSync` and `readFileSync`). `better-sqlite3` rolls back the transaction but re-throws the error. The bare `runReconcile()` call at line 193 has no try/catch.
- **Impact**: Uncaught exception propagates to the MCP tool handler. The cortex server may crash or return an opaque error. Supervisor startup reconciliation step fails and auto-pilot cannot proceed.
- **Evidence**:
  ```ts
  runReconcile(); // No try/catch — any throw inside the transaction body propagates here
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, drifted, matched, missing }) }] };
  ```
- **Fix**: Wrap `runReconcile()` in try/catch. On error, return `{ ok: false, reason: err.message }`.

---

## Serious Issues

### Issue 3: Acceptance criterion 3 not implemented — no render of log.md from events table

- **File**: Not implemented in any changed file
- **Scenario**: Session ends normally. Task.md AC states "Session log.md rendered from events table at session end." No implementation exists.
- **Impact**: Acceptance criteria gap. The audit trail requirement ("git log + files = full audit trail") is partially broken — events table data does not materialise to disk.
- **Fix**: Implement `handleRenderSessionLog(db, sessionId, outputPath)` and wire it into the supervisor's session stop sequence.

### Issue 4: `missing` counter semantics are ambiguous — two different conditions conflated

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sync.ts:171,180`
- **Scenario**: A project with 10 newly created tasks (no DB rows yet) and 2 tasks whose status files were accidentally deleted would both show up in `missing`. The supervisor has no way to differentiate "bootstrap needed" from "data loss."
- **Impact**: Operators and downstream tools reading the `{ missing }` count receive misleading telemetry. Could mask a real problem.
- **Fix**: Return two separate fields: `missing_db_row` and `missing_status_file`.

### Issue 5: `console.warn` in CLI uses non-oclif output channel — inconsistent formatting

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/status.ts:336`
- **Scenario**: DB is present but fails to open (e.g., file locked). `console.warn(...)` bypasses oclif's stderr formatting. This produces a raw `[nitro-fueled] ...` message mixed in with formatted CLI output, with no consistent prefix or color coding. On some CI environments `console.warn` is captured on stdout rather than stderr.
- **Impact**: Warning may be missed or cause downstream parse issues in tools that process CLI output.
- **Fix**: Use `this.warn(...)` (inherited from oclif `Command`) which routes to stderr with standard formatting.

---

## Moderate Issues

### Issue 6: `reconcile_status_files` description in index.ts omits the ambiguous `missing` counter meaning

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/index.ts:104`
- **Current description**: "Returns { ok, drifted, matched, missing }"
- **Gap**: The description does not explain that `missing` counts both "no status file on disk" and "no DB row" as the same bucket. An AI agent calling this tool based on its description will misinterpret `missing > 0` as meaning only one thing.
- **Fix**: Expand description to: "missing = tasks with no status file OR no DB row (call sync_tasks_from_files first if missing > 0 on a fresh DB)."

### Issue 7: `dbRowsToRegistryRows` uses `row['title'] ?? row['description']` — misleading fallback

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/status.ts:23`
- **Scenario**: The `tasks` table has separate `title` and `description` columns. `dbRowsToRegistryRows` uses `title` as primary for the description column of `RegistryRow`, falling back to `description` if title is absent. This means a task with a long `description` but no `title` will display a potentially very long string in the "Description" column, which is then truncated to `descWidth` characters. Not wrong, but the intent (`title` for display, `description` for detail) is not expressed in the type or a comment.
- **Fix**: Add a comment; also consider whether this fallback is intentional or whether an empty title should display "Untitled" instead.

### Issue 8: `SELECT * FROM tasks ORDER BY id` — ordering by text `id` gives lexicographic sort

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/status.ts:328`
- **Scenario**: Task IDs are strings like `TASK_2026_009` and `TASK_2026_010`. SQLite text sort would order correctly here (leading zeros present), but `TASK_2026_9` vs `TASK_2026_10` (if created without zero-padding) would sort lexicographically wrong. The task ID format spec requires zero-padding to 3 digits, so in practice this should not occur. However, any manually created or legacy row without padding will sort out of order.
- **Fix**: Low risk given ID format enforcement, but a comment acknowledging the dependency on zero-padding would prevent a future regression.

### Issue 9: Step 5c ordering in nitro-create-task.md — section numbering implies 5c blocks 5b

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/nitro-create-task.md:130`
- **Scenario**: The sections are ordered: Step 5 (write status file) → Step 5c (best-effort cortex upsert) → Step 5b (commit). A literal agent reads 5c before 5b. The prose says "Do NOT block Step 5b" but the alphanumeric ordering of section IDs (5 < 5b < 5c alphabetically, but 5 < 5c < 5b as written) is confusing and reversed from natural expectation.
- **Fix**: Renumber: Step 5a = write status file, Step 5b = cortex upsert (best-effort), Step 5c = git commit. Or add an explicit execution-order note.

---

## Data Flow Analysis

```
reconcile_status_files():

1. readdirSync(trackingDir)
   → RISK: If trackingDir is a symlink, follows it silently
2. For each TASK_* dir:
   a. existsSync(statusPath) → false → missing++, continue
   b. readFileSync(statusPath) → RISK: TOCTOU (file removed after existsSync)
                               → RISK: empty file produces "" fileStatus
   c. selectRow.get(entry.name) → row | undefined
      → undefined → missing++ [CONFLATED with case 2a above]
   d. row.status === fileStatus → matched++
      OR
   e. updateStatus.run(fileStatus, entry.name) → drifted++
      → RISK: fileStatus="" writes invalid enum to DB
3. Transaction body throws at any point → runReconcile() propagates → unhandled

nitro-fueled status (DB path):

1. existsSync(dbPath) → DB exists
2. require('better-sqlite3') → RISK: module missing → catch → warn + fallback ✅
3. new Database(dbPath, { readonly: true }) → RISK: SQLITE_BUSY (checkpoint) → catch → warn + fallback ✅
4. db.prepare('SELECT * FROM tasks ORDER BY id').all() → RISK: empty table → rows=[] → correct
5. dbRowsToRegistryRows(dbRows):
   a. id="" → skip ✅
   b. status invalid → coerced to CREATED ✅ (but masks corrupted DB row from FM1)
   c. created_at missing → "Unknown" ✅
   d. created_at = "2026-03-29" (no T) → returns "2026-03-29" ✅ (acceptable)
6. db.close() in finally ✅
7. usedDb = true
```

### Gap Points Identified:

1. Empty `fileStatus` string flows into DB write unchecked.
2. `runReconcile()` has no error wrapper — a TOCTOU file removal inside the transaction crashes the call.
3. `missing` counter merges two semantically distinct missing conditions.
4. `dbRowsToRegistryRows` coerces `""` status to `CREATED`, masking the corruption introduced by gap #1.
5. No render-from-events log.md path (AC #3 missing entirely).

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Worker status file writes ingested into DB (file → DB sync) | COMPLETE | Via reconcile_status_files + sync_tasks_from_files |
| `nitro-fueled status` renders from DB when cortex available | COMPLETE | DB path implemented with fallback |
| Session log.md rendered from events table at session end | MISSING | No implementation anywhere in changed files |
| `/nitro-create-task` writes to task.md file and tasks DB table | COMPLETE | Step 5c added to command |
| handoff.md and handoffs table dual-written | COMPLETE | Covered in orchestration/SKILL.md |
| Startup reconciliation: file wins | COMPLETE | reconcile_status_files() called in startup sequence |
| Drift detection: log warnings when file and DB disagree | PARTIAL | `drifted` count returned in JSON but no explicit log line emitted at drift detection time |
| Graceful fallback: everything works file-only | COMPLETE | All DB calls are best-effort with try/catch |
| No data loss: DB rebuildable from files | PARTIAL | Tasks rebuildable via sync_tasks_from_files; handoffs table NOT rebuildable from handoff.md files |

### Implicit Requirements NOT Addressed:

1. **Empty status file handling**: A worker crash mid-write produces a zero-byte file. There is no spec rule for this case, but it is the most likely cause of a corrupted DB row.
2. **Handoffs table rebuild path**: The task says "No data loss scenario: DB can be rebuilt entirely from files on disk" but no `sync_handoffs_from_files` tool exists. The handoffs table is a black hole if the DB is wiped.
3. **Log.md render path on session end**: Implicit from "DB is primary, files are rendered" design principle in the task description. Missing entirely.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Empty status file | NO | Not guarded | Corrupts DB with `""` enum value |
| Status file removed between existsSync and readFileSync | NO | No TOCTOU guard | Exception inside transaction, propagates uncaught |
| DB absent when CLI runs | YES | existsSync check, skips DB path entirely | |
| DB locked / SQLITE_BUSY | PARTIAL | try/catch falls back to file scan | Warning goes to console.warn, not oclif this.warn |
| `id` field missing from DB row | YES | `id.length === 0` → skip | |
| Invalid status in DB row | YES | Falls back to CREATED | But masks corruption from empty file issue |
| Missing created_at in DB row | YES | Returns 'Unknown' | |
| reconcile on fresh DB (no rows) | PARTIAL | Counts as missing, logged as `{ missing: N }` | Ambiguous; caller cannot distinguish from data loss |
| upsert_task unavailable during task creation | YES | try/catch, best-effort, logs warn | |
| DB read-only mode in CLI | YES | `{ readonly: true }` passed | |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| readFileSync inside transaction (TOCTOU) | LOW | Server crash / exception | No try/catch — HIGH RISK |
| Empty status file from worker crash | MEDIUM | DB row corrupted | No guard — needs fix |
| better-sqlite3 absent in CLI | LOW | Graceful fallback to file scan | Handled correctly |
| DB locked during CLI status read | LOW | Falls back to file scan | Correct, but warning format inconsistent |
| Reconcile on fresh DB | MEDIUM | Logs `missing: N` ambiguously | Caller cannot act meaningfully |
| Log.md render from events | N/A | Feature absent | AC #3 not delivered |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The empty-status-file path writes an invalid `""` enum value to the DB, which then silently appears as `CREATED` in the CLI. Combined with the missing try/catch around `runReconcile()`, the reconcile tool can corrupt DB state and/or crash the MCP server under conditions that are not exotic (worker killed mid-write, OS file permission change).

---

## What Robust Implementation Would Include

- A `fileStatus.length === 0` guard before any comparison or DB write in `handleReconcileStatusFiles`
- A try/catch wrapper around `runReconcile()` returning `{ ok: false, reason }` on error
- Two separate counters: `missing_db_row` vs `missing_status_file`
- `this.warn()` instead of `console.warn` in the CLI for oclif-consistent output
- A `handleRenderSessionLog` function (or equivalent) to satisfy AC #3
- A note in the tool description about `missing` counter ambiguity
- A sync/rebuild path for the `handoffs` table from `handoff.md` files on disk (or explicit documentation that handoffs cannot be rebuilt — explicitly accepting the data loss risk)
