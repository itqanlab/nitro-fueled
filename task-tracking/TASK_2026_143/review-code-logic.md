# Code Logic Review — TASK_2026_143

## Score: 5/10

## Review Summary

| Metric              | Value        |
| ------------------- | ------------ |
| Overall Score       | 5/10         |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 3            |
| Serious Issues      | 5            |
| Moderate Issues     | 4            |
| Failure Modes Found | 8            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `get_session_summary` uses falsy checks (`if (cost.total_usd)`) to accumulate totals. Any worker with a $0.00 cost is silently skipped in the aggregation — the sum looks correct but is quietly missing entries. Same bug applies to `total_input`, `total_output`, and `total_cache_creation` token fields: a legitimate zero value causes those fields to be excluded from the total.
- `handleGetRecentChanges` parses git log output with a fragile string-split heuristic (`trimmed.includes('|') && /^[0-9a-f]{40}/.test(trimmed)`). A commit subject line that happens to contain a `|` character will be misclassified as a new commit header and silently corrupt the parsed commit list. The caller gets back malformed data with no error signal.
- `globSync` in `get_codebase_patterns` uses only the basename of the glob pattern (via `basename(pattern)`) and discards the directory structure. A glob like `**/services/**/*.ts` becomes the find expression `-name "*.ts"` — it matches far more files than intended and silently returns unrelated results. The caller has no way to know the directory filter was dropped.
- `report_progress` with a non-standard status succeeds (`ok: true`) and logs a DB event using an unsanitized `args.status` string interpolated directly into the `event_type` column value. No sanitization on `args.phase` either in the non-standard branch.

### 2. What user action causes unexpected behavior?

- An agent calling `stage_and_commit` with a file path containing spaces (e.g. `src/my file.ts`) has the path double-quoted in the shell command, which should be fine — but `fileSafe` strips only `'"\\` and keeps spaces, so `git add -- "my file.ts"` works. However, if the path contains a `$` (e.g. `src/$special.ts`), the `$` survives sanitization and is expanded by the shell inside the double-quoted string. This breaks the intended injection protection.
- An agent calling `get_review_lessons` with file types that match a lesson file NOT in `LESSON_FILE_MAP` gets no results for that lesson file, with no warning. If a user adds `testing.md` to `.claude/review-lessons/`, it is permanently excluded (empty `coverageExts` is absent from the map, not treated as "always include" — `undefined ?? []` gives `[]`, which means `isGeneral = false`, and `coverageExts.some(...)` on an empty array returns false).
- An agent calling `get_model_performance` with both `args.model` and `args.launcher` gets the review stats filtered correctly, but the phase stats query only checks `args.model`. Passing `launcher` does not filter phase stats. The caller receives results labeled as filtered by `{ launcher: "iterm" }` when the phase_stats rows are actually unfiltered by launcher — misleading output.

### 3. What data makes this produce wrong results?

- In `handleGetRecentChanges`, git commits whose subject contains the pipe `|` character produce an incorrect parse: the subject is split on `|`, and the third segment is used as the date. This results in a wrong date, a truncated subject, and the real date never captured — all silently. Example: `feat: add foo|bar support` breaks the parser completely.
- In `get_session_summary`, `if (cost.total_usd)` is falsy for `0`. Any worker that ran without cost (e.g. a stub, test worker, or free-tier model) contributes `total_usd: 0` which is treated as "no cost data" and skipped. The `per_model` breakdown also omits that model entirely. The session total looks correct but underestimates. The same falsy-check bug exists for `tokens.total_input`, `tokens.total_output`, and `tokens.total_cache_creation`.
- `handleLogPhase` accepts any ISO 8601 string for `start` and `end`. If `start > end` (clock skew, copy-paste error), `durationMinutes` is negative. The negative value is stored with no validation. Downstream `get_model_performance` will report a negative `avg_duration_m`, which poisons the model routing decision logic.
- `log_review` accepts a `score` parameter validated as `min(0).max(10)` in the Zod schema, but inside `handleLogReview` there is no re-validation — the function receives the already-schema-validated args, which is fine. However, `findings_count` is declared `NOT NULL` in the schema but is still settable to any integer including negative values. No `CHECK` constraint on the DB column enforces `>= 0`.

### 4. What happens when dependencies fail?

- `stage_and_commit` runs `git add` in a loop — if adding file N fails, the loop throws and the commit is aborted, but files 0 through N-1 are already staged. The working tree is left with partial staging, and the error returned to the caller only says the git command failed — the caller does not know which files were staged and which were not. Re-running the tool double-stages the already-staged files (harmless for git, but the user has unexpected staged state).
- `handleGetTaskContext` calls `readFileSafe` (which swallows all errors) for plan.md and task.md. If the filesystem is temporarily unavailable (NFS mount, permission change), both return empty strings silently and `planSummary` and `fileScope` come back as null/empty with no indication that a read error occurred. The caller assumes the task has no plan.
- `applyMigrations` calls `db.exec(ddl)` without a transaction. If the process is killed between two ALTER TABLE executions, the DB ends up partially migrated. On next startup, `PRAGMA table_info` shows the successfully-added columns as present, so those migrations are skipped, but the failed column is also absent from `existingColumns` and will be retried — which is the correct behavior. This is safe but worth noting: it relies on the idempotency of the column-missing check.
- `get_codebase_patterns` runs `find` with a 5-second timeout per glob. With 2 globs per pattern type (some have 3), a worst-case pattern (e.g. `service`) fires 2 `execSync` calls each potentially timing out. If all time out, the function silently returns `{ ok: true, examples: [], note: 'no files found matching pattern' }` — identical to "no matches", making timeout indistinguishable from "no such files."

### 5. What's missing that the requirements didn't mention?

- No validation that `task_id` passed to `log_review` and `log_fix_cycle` refers to an existing task. Both insert with `NOT NULL REFERENCES tasks(id)` — if FK enforcement is on (it is), the INSERT throws `SQLITE_CONSTRAINT_FOREIGNKEY`. The catch block converts this to `{ ok: false, reason: "FOREIGN KEY constraint failed" }` which is an opaque DB error. The caller gets no meaningful guidance (e.g. "task not found").
- `get_recent_changes` — no limit on the number of commits returned. A task with hundreds of commits (possible for long-running tasks) produces an unbounded JSON response. No `LIMIT` or result cap.
- `handleGetModelPerformance` — the `launcher` filter is declared in the function args and reflected in the `filters` output, but has no effect on `phaseStats`. The caller cannot trust the phase stats are launcher-filtered.
- `stage_and_commit` does not verify the files exist before staging. `git add` on a non-existent path fails with an exit code, but the error message `"pathspec 'foo.ts' did not match any files"` is returned raw. No pre-flight check that would give a cleaner error.
- The `PHASES_TABLE`, `REVIEWS_TABLE`, and `FIX_CYCLES_TABLE` have no `CHECK` constraints on their TEXT enum-like columns (`phase`, `review_type`, `outcome`). Any string is accepted — a caller that passes `"review"` instead of `"code-logic"` is accepted silently.
- Version mismatch: `index.ts` line 36 declares `version: '0.4.0'` in the `McpServer` constructor, but line 457 logs `v0.5.0`. The handoff says the version was bumped to 0.5.0.

---

## Critical Issues

### Issue 1: `|` in commit subjects corrupts git log parse in `get_recent_changes`

- **File**: `packages/mcp-cortex/src/tools/context.ts:175`
- **Scenario**: Any commit whose subject line contains a pipe character (conventional commit scopes, tool flags, markdown tables in commit bodies). The `--pretty=format:"%H|%s|%ai"` format uses `|` as a field delimiter, but `%s` (subject) is not escaped. The parser splits on the first three `|` characters, so `"feat(x): add foo|bar\|2026-03-01T00:00:00"` produces `hash=feat...`, `subject=bar`, `date=2026-03-01`.
- **Impact**: Silently wrong commit list returned to agents. Agents relying on this for review context receive corrupted data. No error surfaced.
- **Evidence**: Line 176 — `const [hash, subject, date] = trimmed.split('|') as [string, string, string]` — split on `|` with no limit argument, so any extra `|` in the subject breaks the destructure.
- **Fix**: Use a delimiter that cannot appear in commit subjects, or use `--pretty=format:"%H%x00%s%x00%ai"` with NUL as the delimiter and split on `\0`.

### Issue 2: Falsy zero check causes silent cost/token undercount in `get_session_summary`

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:359-368`
- **Scenario**: Any worker with `total_usd: 0` or any token field equal to 0 is excluded from aggregation. This is common for test workers, killed workers before doing any work, or models with no cost data yet. The session total is quietly wrong.
- **Impact**: Supervisor makes model routing decisions based on incorrect cost data. A model that ran 10 tasks free shows no cost history — cannot be distinguished from "never used".
- **Evidence**:
  ```typescript
  if (cost.total_usd) {           // falsy for 0 — skips zero-cost workers
    totalCost += cost.total_usd;
  }
  if (tokens.total_input) totalInputTokens += tokens.total_input;  // same bug
  ```
- **Fix**: Use `!= null` checks: `if (cost.total_usd != null)` and `if (tokens.total_input != null)`.

### Issue 3: `$` in file paths bypasses shell sanitization in `stage_and_commit`

- **File**: `packages/mcp-cortex/src/tools/context.ts:360-361`
- **Scenario**: A file path like `src/$HOME/config.ts` or `src/component-${VERSION}.ts` passes through `file.replace(/['"\\]/g, '')` unchanged (only quotes and backslash are stripped). The path is then interpolated into `git add -- "${fileSafe}"`. Inside double quotes, `$HOME` is expanded by the shell.
- **Impact**: Shell injection via `$` expansion. An agent or adversarial caller can trigger arbitrary environment variable expansion. More concretely, a path with `$(command)` survives sanitization and executes the command.
- **Evidence**: Line 360 — `const fileSafe = file.replace(/['"\\]/g, '')` — dollar sign and backtick are not stripped.
- **Fix**: Strip (or reject) `$`, `` ` ``, `(`, `)`, `{`, `}` from file paths. Alternatively, use `execFileSync` with an array of arguments instead of `execSync` with a shell string — then no shell expansion occurs.

---

## Serious Issues

### Issue 4: `globSync` silently discards directory prefix of glob patterns

- **File**: `packages/mcp-cortex/src/tools/context.ts:233`
- **Scenario**: `PATTERN_GLOBS` entries like `**/services/**/*.ts` produce a `basename` of `*.ts`. The `find` command becomes `-name "*.ts"` which matches every TypeScript file in the project. The function returns up to 10 of them, but they may be completely unrelated to the "service" pattern type.
- **Impact**: Agents looking for service patterns receive arbitrary `.ts` files as "examples" — they may copy wrong patterns. No error is surfaced; `ok: true` always.
- **Evidence**: Line 233 — `const namePart = basename(pattern)` — for `**/services/**/*.ts`, `basename` returns `*.ts`.
- **Fix**: Either implement proper recursive glob (use the `glob` npm package which supports `**`), or filter results post-find using the path segment (e.g. check that the returned path contains `services/` for service patterns).

### Issue 5: `log_review` and `log_fix_cycle` produce opaque FK errors for unknown task IDs

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:73-93`, `115-131`
- **Scenario**: Caller passes a `task_id` that does not exist in the tasks table. With `foreign_keys = ON`, the INSERT throws `SQLITE_CONSTRAINT_FOREIGNKEY`. The catch block returns `{ ok: false, reason: "FOREIGN KEY constraint failed" }`.
- **Impact**: Agent has no actionable guidance. Should pre-check task existence and return `{ ok: false, reason: 'task_not_found' }`.
- **Fix**: Add `SELECT id FROM tasks WHERE id = ?` before the INSERT in both handlers, same pattern as `handleGetTaskTrace`.

### Issue 6: Negative `duration_minutes` stored for phases with `start > end`

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:26`
- **Scenario**: Clock skew between caller and DB server, or caller accidentally swaps start/end values. `(endMs - startMs) / 60_000` is negative.
- **Impact**: `get_model_performance` reports negative `avg_duration_m` for affected models. Supervisor interprets this as "fastest model" and preferentially routes to it.
- **Fix**: Clamp to 0 minimum: `Math.max(0, Math.round(...))`, and optionally return a warning in the response when `start > end`.

### Issue 7: `get_model_performance` — `launcher` filter not applied to phase stats

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:181-210`
- **Scenario**: Caller passes `{ launcher: 'iterm' }`. Review stats and fix stats are filtered by launcher, but `phaseStats` query has no launcher filter (phases table has no launcher column). The returned JSON shows `filters: { launcher: 'iterm' }` but `phase_stats` rows are unfiltered.
- **Impact**: Caller believes they are seeing launcher-scoped phase data but they are not. Model routing decisions based on phase stats are skewed by other launchers' data.
- **Fix**: Document in the description that phase stats cannot be filtered by launcher (no launcher column in phases). Remove `launcher` from the `filters` output for `phase_stats`, or add a `launcher` column to phases.

### Issue 8: Version mismatch in `index.ts`

- **File**: `packages/mcp-cortex/src/index.ts:36` vs `:457`
- **Scenario**: `McpServer({ version: '0.4.0' })` on line 36 but the log on line 457 says `v0.5.0`. Any MCP host that reads the server version from the protocol handshake will see 0.4.0 while logs show 0.5.0.
- **Impact**: Version tracking tools show wrong version. Minor but indicates the version bump was incomplete.
- **Fix**: Change line 36 to `version: '0.5.0'`.

---

## Moderate Issues

### Issue 9: No limit on commits returned by `get_recent_changes`

- **File**: `packages/mcp-cortex/src/tools/context.ts:152-154`
- **Scenario**: A task with 200+ commits (e.g. a long-running feature branch) returns all of them in one JSON blob. At ~200 bytes per commit entry, this is still manageable, but the `--name-only` output also returns all changed file paths for every commit, which can easily exceed 100KB for active tasks.
- **Impact**: MCP response size blows past any tool result size limits. Agent context consumption is unbounded.
- **Fix**: Add `--max-count=50` to the git log command and document the cap.

### Issue 10: `readFileSafe` swallows all errors with no logging

- **File**: `packages/mcp-cortex/src/tools/context.ts:16-20`
- **Scenario**: A permission error, EACCES, or symlink loop causes `readFileSync` to throw. The caller gets an empty string and cannot distinguish "file doesn't exist" from "file exists but is unreadable."
- **Impact**: `get_task_context` silently returns `plan_summary: null` when the plan file is permission-denied. Agent assumes task has no plan.
- **Fix**: Log the error to `console.error` at minimum: `catch (e) { console.error('[nitro-cortex] readFileSafe failed:', path, e); return ''; }`.

### Issue 11: Missing CHECK constraints on telemetry enum columns

- **File**: `packages/mcp-cortex/src/db/schema.ts:127-174`
- **Scenario**: `phases.phase`, `phases.outcome`, `reviews.review_type` accept any string. A caller that passes `"dev"` instead of `"Dev"` or `"code_logic"` instead of `"code-logic"` stores silently inconsistent data. `get_model_performance` GROUP BY on these columns produces fragmented results.
- **Fix**: Add `CHECK` constraints (e.g. `outcome TEXT CHECK(outcome IN ('COMPLETE','FAILED','SKIPPED'))`). At minimum, validate in the handler.

### Issue 12: `report_progress` non-standard branch uses unsanitized phase and status in event_type

- **File**: `packages/mcp-cortex/src/tools/context.ts:419-421`
- **Scenario**: When `args.status` is not a valid task status, the event is inserted with `event_type = PHASE_${args.phase.toUpperCase()}_${args.status}`. Neither `args.phase` nor `args.status` are sanitized in this branch (only `taskIdSafe` is used). A malicious or buggy caller can store arbitrary strings in `event_type`.
- **Impact**: Inconsistent event types in the events table; potential for very long strings (though column has no length limit). `query_events` filtering by event_type returns unexpected results.
- **Fix**: Apply the same `replace(/[^\w-]/g, '')` sanitization to `args.phase` and `args.status` before interpolating into event_type.

---

## Data Flow Analysis

```
Caller -> MCP tool (index.ts: Zod validation) -> handler function -> SQLite
                                                                   -> execSync (git commands)
                                                                   -> readFileSync (disk)

Failure points:
1. [index.ts Zod] — covers basic types and string lengths. Does NOT validate:
   - pipe chars in task_id used in git grep (handled with regex sanitize — OK)
   - pipe chars in commit subjects (NOT handled — corrupts parse)
   - negative duration (NOT validated — stored as-is)
2. [handler -> SQLite] — FK constraints ON. Missing task_id in log_review/log_fix_cycle
   produces opaque FK error, not 'task_not_found'.
3. [handler -> execSync] — $/{} in file paths not stripped, shell injection possible.
   git log output parsing assumes no | in subjects — assumption broken by real commits.
4. [handler -> disk] — readFileSafe returns '' on all errors, masking permission issues.
5. [telemetry aggregation] — falsy zero check in get_session_summary silently drops
   zero-cost/zero-token workers from totals.
```

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| DB schema — phases, reviews, fix_cycles tables | COMPLETE | Missing CHECK constraints on enum columns |
| DB schema — session/worker column additions | COMPLETE | Migrations are idempotent and correct |
| get_task_context | COMPLETE | readFileSafe swallows permission errors silently |
| get_review_lessons | COMPLETE | New lesson files not in LESSON_FILE_MAP are always excluded |
| get_recent_changes | PARTIAL | No commit count cap; pipe-in-subject corrupts parse |
| get_codebase_patterns | PARTIAL | globSync discards directory path, returns wrong files |
| stage_and_commit | PARTIAL | $ and backtick in paths bypass sanitization |
| report_progress | COMPLETE | Non-standard status branch uses unsanitized strings in event_type |
| log_phase | COMPLETE | Negative duration not prevented |
| log_review | PARTIAL | No pre-check for task existence; opaque FK error |
| log_fix_cycle | PARTIAL | Same as log_review |
| get_model_performance | PARTIAL | launcher filter silently not applied to phase_stats |
| get_task_trace | COMPLETE | No issues found |
| get_session_summary | PARTIAL | Falsy zero check misses zero-cost/zero-token workers |
| index.ts tool registration | PARTIAL | Version mismatch 0.4.0 vs 0.5.0 in server constructor |

### Implicit Requirements NOT Addressed

1. Agents can pass `$VAR` or `$(cmd)` in file paths — shell injection protection must cover all metacharacters, not just quotes and backslash.
2. A phase where `start > end` is a caller error that should be rejected or at minimum warned about — storing negative duration corrupts analytics silently.
3. Telemetry tables need the same enum CHECK constraints as the tasks/sessions/workers tables — the existing schema pattern establishes this expectation.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| task_id not in DB for get_task_context | YES | returns isError:true | OK |
| task_id not in DB for log_review | NO | opaque FK constraint error | Serious |
| pipe char in commit subject | NO | corrupts parse silently | Critical |
| $ in file path for stage_and_commit | NO | shell expansion not prevented | Critical |
| zero-cost worker in session summary | NO | falsy check skips it | Critical |
| negative duration (start > end) | NO | stored as-is | Serious |
| new lesson file not in LESSON_FILE_MAP | NO | silently excluded | Moderate |
| globSync pattern with directory component | NO | directory part discarded | Serious |
| process killed mid-migration | PARTIAL | idempotent re-run recovers | Safe |
| execSync timeout (find, git) | PARTIAL | best-effort, returns empty/error | Acceptable |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| git log parse (pipe in subject) | MEDIUM | Corrupted commit data | None currently |
| shell injection via file path $ | LOW | Command execution | Partial (quotes only) |
| SQLite FK on telemetry inserts | MEDIUM | Opaque error on unknown task_id | None — needs pre-check |
| find command in globSync | MEDIUM | Returns wrong files | None — basename drops dir |
| readFileSafe on permission error | LOW | Silent empty result | None |
| zero-value cost aggregation | HIGH (for test/stub workers) | Wrong session totals | None |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Shell injection via `$` in file paths in `stage_and_commit` — this is the only security-class issue in an MCP tool that directly runs git commands. The other critical issues (pipe-in-subject parse corruption and falsy zero aggregation) corrupt data silently and will be hard to debug once the telemetry system is live.

## What Robust Implementation Would Include

- `execFileSync` with argument arrays instead of `execSync` with shell strings in `stage_and_commit` — eliminates the entire class of shell injection concerns, no sanitization needed
- A `validateTaskExists(db, task_id)` helper called at the top of `log_review`, `log_fix_cycle`, and `handleGetRecentChanges` (which currently does no task existence check at all) — returns `{ ok: false, reason: 'task_not_found' }` before hitting FK constraints
- `!= null` guards instead of falsy checks on all numeric accumulations in `get_session_summary`
- NUL (`\0`) or `%x00` as the git log field delimiter instead of `|`
- `CHECK` constraints on `phases.outcome`, `reviews.review_type`, and `fix_cycles` columns — consistent with the established schema pattern in tasks/sessions/workers tables
- A `--max-count=50` (or similar) on `get_recent_changes` git log invocation
- `Math.max(0, duration)` clamping in `log_phase` for inverted timestamps
