# Code Style Review — TASK_2026_143

## Score: 6/10

## The 5 Critical Questions

### 1. What could break in 6 months?

The `LESSON_FILE_MAP` in `context.ts:9` is a hardcoded registry of every lesson file and the extensions it covers. When a new `*.md` lesson file is added to `.claude/review-lessons/`, it will silently fall through the `LESSON_FILE_MAP[file] ?? []` fallback, which returns an empty array. That empty array triggers the `isGeneral` branch, which means **any new lesson file is treated as "always include"** — the opposite of what the code intends. A new `database.md` lesson file for SQL-only rules would be injected into TypeScript-only reviews. This will confuse agents with irrelevant content and is a silent semantic bug that will only be noticed when a new lesson file is added.

`context.ts:228-241` — the `globSync` helper uses `basename(pattern)` to strip path components from glob patterns. A pattern like `**/*.service.ts` becomes `-name "*.service.ts"`, which works, but `**/services/**/*.ts` becomes `-name "*.ts"`, which matches every TypeScript file in the project. This over-match is capped at 10 files but it returns noisy, irrelevant examples for pattern types like `service` or `component` that mix specific-name globs with directory-path globs.

### 2. What would confuse a new team member?

`context.ts:115-117` — the logic `const isGeneral = coverageExts.length === 0` relies on the convention that an empty array means "always include." This is inverse-sentinel logic with no inline comment explaining the contract. A developer adding a new lesson file whose extensions haven't been determined yet might naturally write `'new-topic.md': []` and unknowingly mark it as "always include."

`telemetry.ts:150-178` — `handleGetModelPerformance` builds `reviewConditions`, `phaseConditions`, and `fixConditions` as three separate string-array accumulators using the same pattern. The filter for `task_type` and `complexity` is only applied to `phaseConditions` via a subquery, not to `reviewConditions` or `fixConditions`. This asymmetry is not documented; a maintainer adding a new filter will likely forget to add it to all three branches.

`schema.ts:125` — the comment `// Telemetry tables (TASK_2026_143)` is implementation-era language per the general review lesson. Once shipped, this comment becomes permanently confusing noise. Future readers will not know what "TASK_2026_143" means in context.

### 3. What's the hidden complexity cost?

`context.ts:307-380` — `handleStageAndCommit` sanitizes 11 separate fields with 11 separate regex replacements, then builds a multi-line footer string, then runs two shell processes. This function has 50+ lines of logic and will be difficult to unit-test in isolation because it is tightly coupled to `execSync` with no injection point. If a footer field needs to change (e.g., adding a `cost_usd` field), the developer must update the sanitization, the footer builder, and the Zod schema in `index.ts` in three separate places with no type-level enforcement that they are in sync.

`handleGetModelPerformance` at 254 lines in telemetry.ts is close to the 200-line service limit. The function alone is ~110 lines (three separate SQL queries with condition builders). If a fourth aggregation is added, it will push telemetry.ts into violation.

### 4. What pattern inconsistencies exist?

**snake_case fields in TypeScript interfaces** — `WorkerTokenStats` (schema.ts:15-24), `WorkerCost` (schema.ts:26-31), and `WorkerProgress` (schema.ts:33-41) all use `snake_case` field names (`total_input`, `input_usd`, `message_count`). The general review lesson states interface field names must follow `camelCase` and only use `snake_case` at the parse boundary. These interfaces are exported TypeScript types, not DB row types, so they should use `camelCase`. This was not introduced in this task but is a pre-existing violation that this task exports further.

**`SELECT *` in `handleGetTaskTrace`** — `telemetry.ts:274-284` uses `SELECT *` for the `phases`, `reviews`, and `fix_cycles` tables. All other queries in the codebase (and in this same file) use explicit column lists. `SELECT *` makes the return shape implicit and fragile when columns are added.

**Missing `CHECK` constraints on new enum columns** — `schema.ts:139` (`outcome TEXT`) and `schema.ts:148` (`review_type TEXT NOT NULL`) have no `CHECK` constraints. The backend lesson explicitly requires `CHECK` constraints for enum columns. `phase` (`schema.ts:131`) similarly has no constraint. Contrast with the existing tables where every status/type column has an inline `CHECK`.

**LIMIT without parameterization in `handleGetTaskTrace`** — `telemetry.ts:291` uses `LIMIT 100` as a string-interpolated literal. Per the SQL lesson, LIMIT clauses must use parameterized placeholders. This is a hardcoded limit that cannot be configured by the caller.

**Version mismatch in `index.ts`** — `index.ts:35` declares `version: '0.4.0'` in the `McpServer` constructor, but `index.ts:457` says `v0.5.0` in the startup log line. The handoff says the version was bumped to 0.5.0. The server object is initialized at the wrong version.

### 5. What would I do differently?

- Replace the `LESSON_FILE_MAP` empty-array convention with an explicit `alwaysInclude: true` property to make the intent unambiguous: `{ extensions: ['ts', 'js'], alwaysInclude: false }`.
- Extract the footer-building logic in `handleStageAndCommit` into a pure `buildCommitFooter(args): string` function so it can be tested independently of shell execution.
- Add CHECK constraints to all new enum-like columns at schema definition time, not as a follow-on.
- Fix the `globSync` helper to only use `find` for simple `*.ext` patterns and skip directory-path globs that degrade to `*.ts` matches.

---

## Findings

### Critical

**1. Version mismatch: McpServer declares 0.4.0, startup log says 0.5.0**

- **File**: `packages/mcp-cortex/src/index.ts:35` and `:457`
- **Problem**: `new McpServer({ name: 'nitro-cortex', version: '0.4.0' })` but the startup message reads `v0.5.0`. The handoff explicitly states the version was bumped to 0.5.0.
- **Impact**: MCP host clients that rely on the version field for compatibility routing see the wrong version. Monitoring that reads the version from the MCP handshake will be incorrect.
- **Fix**: Change line 35 to `version: '0.5.0'`.

---

### Serious

**1. Empty `LESSON_FILE_MAP` entry is an unsafe sentinel for "always include"**

- **File**: `packages/mcp-cortex/src/tools/context.ts:9-14` and `:115-117`
- **Problem**: `coverageExts.length === 0` is used to mean "always include." A new lesson file absent from `LESSON_FILE_MAP` falls back to `[]` via the `?? []` default, which also has length 0, so new unknown files are treated as "always include" rather than "not matched."
- **Impact**: Any new lesson file added to `.claude/review-lessons/` is silently injected into every review regardless of relevance until `LESSON_FILE_MAP` is updated. This is the inverse of the intended conservative behavior.
- **Recommendation**: Default unknown files to `null` (skip) rather than `[]` (always include). Check `LESSON_FILE_MAP[file] === undefined` as the skip condition.

**2. Missing CHECK constraints on new telemetry enum columns**

- **File**: `packages/mcp-cortex/src/db/schema.ts:131, :139, :148`
- **Problem**: `phase TEXT NOT NULL`, `outcome TEXT`, and `review_type TEXT NOT NULL` have no `CHECK` constraints defining valid values. All existing enum columns in the schema (`type`, `priority`, `status`, `worker_type`, `loop_status`, `provider`, `launcher`) use `CHECK(col IN (...))`.
- **Impact**: Invalid strings can be inserted and will silently corrupt aggregation queries like `SUM(CASE WHEN p.outcome = 'COMPLETE' THEN 1 ELSE 0 END)`. A typo like `'complete'` instead of `'COMPLETE'` will count as a failure with no error.
- **Recommendation**: Add `CHECK` constraints to all three columns, or at minimum document why they are intentionally unconstrained.

**3. `globSync` degrades to `find . -name "*.ts"` for directory-path glob patterns**

- **File**: `packages/mcp-cortex/src/tools/context.ts:228-241`
- **Problem**: `basename('**/services/**/*.ts')` returns `'*.ts'`, so the `find -name` command becomes `find . -type f -name "*.ts"`, which matches every TypeScript file in the project capped at 10 lines. Patterns like `**/services/**/*.ts`, `**/repositories/**/*.ts`, `**/controllers/**/*.ts`, and `**/handlers/**/*.ts` all degrade this way.
- **Impact**: `get_codebase_patterns` for `service`, `repository`, `controller`, and `handler` types returns up to 10 random `.ts` files rather than files in those directories. Agents will receive wrong pattern examples.
- **Recommendation**: Filter the `globs` array to only those where `basename(pattern)` contains `*` and is not just `*.ts` or `*.tsx`. Skip directory-path-only globs, or use a proper recursive find with path filtering.

**4. `SELECT *` in `handleGetTaskTrace` for three tables**

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:274-284`
- **Problem**: `SELECT * FROM phases WHERE task_id = ?`, `SELECT * FROM reviews WHERE task_id = ?`, and `SELECT * FROM fix_cycles WHERE task_id = ?` use wildcard selects. Every other query in this file and in the codebase uses explicit column lists.
- **Impact**: The return shape is implicit. When new columns are added to these tables, they appear in trace output with no deliberate decision made about exposure. The `metadata TEXT` column in `phases` could contain large JSON blobs that inflate response size unexpectedly.
- **Recommendation**: Use explicit column lists matching what `get_task_trace` consumers actually need.

**5. Falsy check silently skips zero-cost workers in `handleGetSessionSummary`**

- **File**: `packages/mcp-cortex/src/tools/telemetry.ts:359-367`
- **Problem**: `if (cost.total_usd)` and `if (tokens.total_input)` skip accumulation when values are `0`. The general review lesson explicitly calls out this pattern: "Falsy checks skip zero values." A worker that consumed 0 tokens (a failed or instant worker) is silently skipped, producing an incorrect `totalInputTokens` when any workers have zero token counts.
- **Recommendation**: Use `!= null` or `!== undefined` checks, or `Number.isFinite()` before accumulating.

**6. Implementation-era comment must be removed**

- **File**: `packages/mcp-cortex/src/db/schema.ts:125`
- **Problem**: `// Telemetry tables (TASK_2026_143)` is a task-era annotation that becomes misleading noise once shipped. Per the general review lesson, implementation-era language must be removed before merge.
- **Recommendation**: Replace with `// Telemetry tables` or a description of purpose.

---

### Minor

**1. `LIMIT 100` hardcoded as string literal in events query**
- `telemetry.ts:291` — `LIMIT 100` is embedded in the SQL string. Per the SQL lesson, LIMIT clauses should use parameterized placeholders. Low risk here since the value is a literal constant, not user input, but it sets an inconsistent pattern.

**2. DB row queries use `Record<string, unknown>` cast instead of typed row interfaces**
- `telemetry.ts:265, :271, :278, :282, :286` and `context.ts:38` — the SQL lesson states: "DB row types must be modeled as typed interfaces, not cast field-by-field." Every `.get()` and `.all()` result is cast as `Record<string, unknown>` or `Array<Record<string, unknown>>`. This silences nullability issues. Typed row interfaces would catch column-name drift at compile time.

**3. `WorkerTokenStats`, `WorkerCost`, `WorkerProgress` use `snake_case` field names**
- `schema.ts:15-41` — exported TypeScript interfaces should use `camelCase`. These were pre-existing but are re-exported by this task's additions and the violation is visible in the telemetry tools that consume them via `cost_json` and `tokens_json` parsing in `telemetry.ts:357-368`.

**4. `task_type` and `complexity` filters only applied to `phases`, not `reviews` or `fix_cycles`**
- `telemetry.ts:187-193` — the `task_type`/`complexity` subquery filter is only wired into `phaseConditions`. `reviewStats` and `fixStats` ignore these filters. This asymmetry is not documented and will cause confusing results when callers pass `task_type` or `complexity` expecting to filter all three datasets.

**5. `handleGetReviewLessons` accepts `_db` but signature still requires it**
- `context.ts:99-100` — `_db: Database.Database` is unused (prefixed correctly with `_`). Same for `handleGetRecentChanges` and `handleGetCodebasePatterns`. This is consistent with the pattern in the file, but the DB parameter should be documented or eliminated from the signature if no future use is planned.

---

## File-by-File Analysis

### `packages/mcp-cortex/src/db/schema.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

Good: `applyMigrations` helper is a clear, table-scoped improvement over the previous inline loop. The new table DDL is consistent in structure with existing tables (INTEGER PK AUTOINCREMENT, timestamp defaults). Index coverage for the new tables is appropriate.

Concerns:
1. `schema.ts:125` — implementation-era task comment (serious, per lesson rule)
2. `schema.ts:131, :139, :148` — missing CHECK constraints on `phase`, `outcome`, `review_type` columns (serious)
3. `schema.ts:15-41` — exported interfaces use `snake_case` field names (minor/pre-existing)

### `packages/mcp-cortex/src/tools/context.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

The `handleStageAndCommit` sanitization approach is sound — `git commit -F -` via stdin avoids the main shell injection vector. The `task_id` sanitization before git grep is correct.

Concerns:
1. `context.ts:115-117` — inverse-sentinel logic for "always include" silently includes unknown files (serious)
2. `context.ts:228-241` — `globSync` degrades to `*.ts` for directory-path glob patterns (serious)
3. `context.ts:38` — `Record<string, unknown>` cast instead of typed row interface (minor, per lesson)
4. `context.ts:61` — regex `##\s+File Scope\n` will fail on Windows line endings; no consequence in the current environment but worth noting

### `packages/mcp-cortex/src/tools/telemetry.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 4 serious, 1 minor

The three write functions (`handleLogPhase`, `handleLogReview`, `handleLogFixCycle`) are clean and consistent. The query functions are where problems concentrate.

Concerns:
1. `telemetry.ts:274-284` — `SELECT *` for three tables (serious)
2. `telemetry.ts:359-367` — falsy zero-check skips zero-cost/zero-token workers (serious)
3. `telemetry.ts:187-193` — task_type/complexity filters not applied to reviews or fix_cycles (minor but semantically serious for the tool's stated purpose)
4. `telemetry.ts:265` et al. — `Record<string, unknown>` row casts (minor, per lesson)
5. `telemetry.ts:291` — `LIMIT 100` string-embedded literal (minor)

### `packages/mcp-cortex/src/index.ts`

**Score**: 7/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

Registration of all 12 new tools is consistent with existing registration patterns. Zod schemas have appropriate `.max()` bounds. The `stage_and_commit` schema covers all 11 footer fields with correct optional/required designations.

Concerns:
1. `index.ts:35` vs `:457` — version mismatch `0.4.0` vs `0.5.0` (blocking — wrong version reported to MCP host)

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                              |
| -------------------------------- | ------ | -------------------------------------------------------------------- |
| CHECK constraints on enum cols   | FAIL   | `phase`, `outcome`, `review_type` lack CHECK constraints             |
| Typed DB row interfaces          | FAIL   | `Record<string, unknown>` casts throughout; no typed row interfaces  |
| Explicit column SELECT           | FAIL   | `SELECT *` used in `handleGetTaskTrace` for 3 tables                 |
| Parameterized LIMIT              | FAIL   | `LIMIT 100` embedded in SQL string in `telemetry.ts:291`             |
| No falsy zero checks             | FAIL   | `if (cost.total_usd)` skips zero-cost workers                        |
| camelCase interface fields       | FAIL   | `WorkerTokenStats`, `WorkerCost`, `WorkerProgress` use `snake_case`  |
| No implementation-era comments   | FAIL   | `// Telemetry tables (TASK_2026_143)` in schema.ts                   |
| Error paths set `isError: true`  | PASS   | All error returns correctly include `isError: true`                  |
| Shell injection mitigation       | PASS   | Sanitization + `git commit -F -` stdin approach is sound             |
| Zod max() bounds on inputs       | PASS   | All new tool schemas have `.max()` on strings and arrays             |
| isError documented in ToolResult | PASS   | `types.ts` JSDoc added per backend lesson from TASK_2026_142         |

---

## Technical Debt Assessment

**Introduced**:
- `LESSON_FILE_MAP` is a new hardcoded registry that will drift from the actual lesson files. Every time `.claude/review-lessons/` gains a file, two places must be updated: the file itself and this map. No enforcement exists that the two stay in sync.
- `globSync` is a hand-rolled glob implementation that degrades silently. This will become harder to maintain if more pattern types are added that use directory-path globs.
- `Record<string, unknown>` row types across all 4 query-side functions will require field-by-field casting in every caller, with no compile-time check when column names change.

**Mitigated**:
- `applyMigrations` helper replaces the previous inline migration loop, which was a copy-paste pattern that would have grown indefinitely. This is a genuine structural improvement.
- `stage_and_commit` stdin-based commit eliminates the largest shell injection risk in the codebase.

**Net Impact**: Slight debt increase. The new tools are functional but the `LESSON_FILE_MAP` sentinel inversion and the `globSync` degradation introduce failure modes that are not immediately visible and will surface as silent wrong-output bugs rather than thrown errors.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The version mismatch on `index.ts:35` is a blocking correctness issue. The `LESSON_FILE_MAP` sentinel inversion and `globSync` degradation are serious semantic bugs that will produce wrong output silently. The missing CHECK constraints on new enum columns are a clear violation of an established codebase rule.

## What Excellence Would Look Like

A 9/10 implementation would include:
- Explicit `alwaysInclude: boolean` field in `LESSON_FILE_MAP` entries rather than relying on empty-array length as a sentinel
- Typed row interfaces (`interface PhaseRow`, `interface ReviewRow`) for all DB query results instead of `Record<string, unknown>`
- `globSync` that correctly handles directory-path glob patterns by splitting on `/` and building a `find . -path` expression
- CHECK constraints on all three new enum-like columns (`phase`, `outcome`, `review_type`)
- Correct version `0.5.0` in the McpServer constructor
- `task_type`/`complexity` filters applied consistently across all three aggregation queries in `handleGetModelPerformance`
- `!= null` guards instead of falsy checks when accumulating token/cost values
