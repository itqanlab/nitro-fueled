# Code Style Review - TASK_2026_010

## Review Summary

| Metric          | Value         |
| --------------- | ------------- |
| Overall Score   | 6/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 2             |
| Serious Issues  | 6             |
| Minor Issues    | 5             |
| Files Reviewed  | 7             |

## The 5 Critical Questions

### 1. What could break in 6 months?

The `which claude` check in `preflight.ts:9` is platform-specific -- it fails on Windows where `which` does not exist (Windows uses `where`). The CLI targets Node >=18 and has no platform restriction, so someone running on Windows gets a cryptic `execSync` crash instead of a clean error. Also, the regex in `registry.ts:39` makes rigid assumptions about the markdown table format (exact whitespace around pipes). If anyone adjusts registry.md formatting with extra spaces or trailing content, parsing silently drops rows.

### 2. What would confuse a new team member?

The `RunOptions` interface in `run.ts:6-11` defines `concurrency`, `interval`, and `retries` as `string | undefined` rather than parsed numbers. A new developer would expect numeric options to be numbers. The fact that these are strings is a leaky abstraction from Commander's raw parsing that leaks through the entire call chain. Also, `preflight.ts` returning `null` to mean "failure" with side-effecting console.error calls inside is a pattern that makes the function's contract non-obvious -- you have to read the implementation to know it prints errors.

### 3. What's the hidden complexity cost?

The `displaySummary` function in `run.ts:13-47` iterates `rows` six times with six separate `.filter()` calls. The `displayDryRun` function in `run.ts:49-100` does four more. This is O(10n) for what could be a single pass. Not a performance problem today, but it is a code smell that signals "I did not think about data transformation design." A single `groupBy` pass would be cleaner, more maintainable, and set a better pattern for the codebase.

### 4. What pattern inconsistencies exist?

- `index.ts:25` uses `process.exit(1)` in the catch handler, while all command handlers use `process.exitCode = 1`. This is an inconsistency -- `process.exit()` skips cleanup; `process.exitCode` allows graceful shutdown. Pick one pattern.
- `run.ts:142` converts exit code with `String(code ?? 'unknown')` but `code` from Node's `close` event is `number | null`. The `?? 'unknown'` fallback is fine, but wrapping it in `String()` is redundant when it is already inside a template literal.
- Error message formatting: `preflight.ts` uses `Error:` prefix consistently, but `run.ts:128` prints a log line (`Starting Supervisor:`) with no prefix convention matching the error pattern.

### 5. What would I do differently?

1. Parse numeric options to `number` at the Commander boundary, not pass strings around.
2. Create a shared `TaskStatusGroup` type with a single-pass grouping utility, since both `run.ts` and the future `status` command will need it.
3. Return a `Result<RegistryRow[], string>` from preflight instead of `null` with side effects.
4. Use `command.execPath` or `process.platform`-aware check instead of `which`.
5. Add `readonly` to the `RegistryRow` interface fields and `VALID_STATUSES`.

---

## Blocking Issues

### B1: Missing acceptance criterion -- MCP server availability check

- **File**: `preflight.ts` (entire file)
- **Problem**: The task acceptance criteria explicitly state "Pre-flight checks verify MCP server availability." There is no MCP server check anywhere. The `isClaudeAvailable()` function only checks that the `claude` binary is on PATH, not that the session-orchestrator MCP server is configured and reachable.
- **Impact**: The `run` command will attempt to start a Supervisor that immediately fails when the MCP server is not running. The user gets no useful pre-flight feedback.
- **Fix**: Add a preflight step that checks MCP server availability (e.g., try to connect, or check the MCP config file exists). If deferring, add a TODO comment and update the task to track the gap.

### B2: `which claude` is not cross-platform

- **File**: `preflight.ts:9`
- **Problem**: `execSync('which claude')` fails on Windows. `which` is a Unix utility. Windows uses `where`. Since `package.json` declares no OS restriction and Node >=18 runs on all platforms, this is a runtime crash on Windows.
- **Impact**: Windows users get an unhandled exception from `execSync` instead of a clean error message.
- **Fix**: Use `execSync('claude --version', { stdio: 'ignore' })` which works cross-platform, or use a platform check: `process.platform === 'win32' ? 'where' : 'which'`.

---

## Serious Issues

### S1: Numeric options passed as strings through entire call chain

- **File**: `run.ts:6-11`
- **Problem**: `concurrency`, `interval`, and `retries` are `string | undefined`. Commander parses them as strings, but these are semantically numbers (concurrency, retries) or a duration (interval). The code never validates that `--concurrency abc` is rejected.
- **Tradeoff**: Currently they are just forwarded to the `claude` CLI as string arguments, so it "works." But it means the CLI provides no input validation -- garbage values pass through silently to the Supervisor, which fails later with an opaque error.
- **Recommendation**: Validate numeric options at parse time. Commander supports `.argParser()` for this. At minimum, validate `concurrency` and `retries` are positive integers in `preflightChecks`.

### S2: Multiple redundant iterations over rows array

- **File**: `run.ts:14-21` and `run.ts:54-57`
- **Problem**: `displaySummary` filters the `rows` array 6 times, and `displayDryRun` filters it 4 more times. These are separate linear scans over the same data for the same purpose.
- **Tradeoff**: Not a performance issue at current scale but sets a poor pattern. When `status` command is implemented, this will be copy-pasted.
- **Recommendation**: Extract a `groupByStatus(rows: RegistryRow[]): Map<TaskStatus, RegistryRow[]>` utility into `registry.ts`. Use it in both functions.

### S3: `as string` type assertions on regex match groups

- **File**: `registry.ts:42-49`
- **Problem**: `match[1] as string`, `match[2] as string`, etc. The review-lessons explicitly state: "No `as` type assertions -- if the type system fights you, the type is wrong." Regex match groups return `string | undefined`. The `as string` hides a potential `undefined`.
- **Tradeoff**: Since the regex requires these groups to match, they will not be `undefined` in practice. But the assertion silences the type checker instead of proving safety.
- **Recommendation**: Use non-null assertions with a comment explaining the regex guarantees (`match[1]!`), or better, add a guard: `if (!match[1] || !match[2] || !match[3] || !match[4] || !match[5]) continue;`.

### S4: `preflight.ts:73` uses `console.error` for a warning, not an error

- **File**: `preflight.ts:72-75`
- **Problem**: `console.error('Warning: Task ... is already COMPLETE.')` -- this is semantically a warning, not an error, but it is sent to stderr and returns `null` (the failure signal). The caller then sets `process.exitCode = 1`. A COMPLETE task is not an error condition.
- **Tradeoff**: Debatable whether re-running a COMPLETE task should be a hard failure or just a no-op warning.
- **Recommendation**: Use `console.warn()` for warnings. If it should truly block execution, rename the message to `Error:` for consistency with the other messages in the function. Do not mix `Warning:` prefix with error-path behavior.

### S5: `VALID_STATUSES` type annotation is `ReadonlyArray<TaskStatus>` but `as const` would be more idiomatic

- **File**: `registry.ts:22-25`
- **Problem**: The review-lessons note "No redundant `as const` on already-typed readonly arrays." However, the `VALID_STATUSES` array is typed with an explicit `ReadonlyArray<TaskStatus>` annotation AND uses the values inline. The array includes the `FAILED` status which is defined in `TaskStatus` but never appears in `preflightChecks`. If `TaskStatus` gains a new value, `VALID_STATUSES` must be manually updated -- there is no compile-time enforcement that they stay in sync.
- **Recommendation**: Derive `TaskStatus` from the array using `typeof VALID_STATUSES[number]` pattern, or use a `satisfies` check to ensure completeness.

### S6: No `readonly` on interface fields

- **File**: `registry.ts:14-20`
- **Problem**: `RegistryRow` fields are all mutable. Since registry rows are parsed data that should not be mutated, all fields should be `readonly`.
- **Recommendation**: Add `readonly` to all fields of `RegistryRow`, or use `Readonly<RegistryRow>` at usage sites.

---

## Minor Issues

- **M1**: `run.ts:33,46,52,73,98` -- excessive `console.log('')` for blank lines. Consider a `printBlankLine()` helper or use `\n` in adjacent strings. This is a nit but it adds visual noise. (NIT)
- **M2**: `run.ts:89` -- the ternary `wave === 1 ? 'immediate' : 'concurrent'` is a magic-string label. If a third wave type is added, this breaks. Not blocking, but worth noting. (MINOR)
- **M3**: `registry.ts:39` -- the regex does not handle the `FAILED` status differently, and `FAILED` tasks are never mentioned in `preflight.ts` filtering. A `FAILED` task would pass preflight validation without special handling. Is that intentional? (MINOR)
- **M4**: `run.ts:126` -- the prompt string joins with spaces: `['/auto-pilot', ...autoPilotParts].join(' ')`. If a future argument contains spaces, this will break the prompt parsing. Consider quoting. (MINOR)
- **M5**: `preflight.ts:54` -- the task ID regex `TASK_\d{4}_\d{3}` allows `TASK_0000_000` and `TASK_9999_999`. No validation that the year is reasonable or the sequence is positive. Very minor but worth a comment documenting the intentional leniency. (NIT)

---

## File-by-File Analysis

### run.ts

**Score**: 6/10
**Issues Found**: 0 blocking, 3 serious, 3 minor

**Analysis**: The command registration follows the established pattern from `init.ts`/`status.ts`/`create.ts` -- `registerXCommand(program: Command): void` with Commander chaining. Good structural consistency. The separation into `displaySummary`, `displayDryRun`, `buildAutoPilotArgs`, and `spawnSupervisor` is reasonable decomposition. However, the string-typed options, redundant array iterations, and lack of input validation are real concerns.

**Specific Concerns**:
1. Line 8-10: `concurrency`, `interval`, `retries` as `string | undefined` -- should be validated
2. Lines 14-21, 54-57: Redundant `.filter()` calls -- extract grouping utility
3. Line 142: `String(code ?? 'unknown')` is redundant inside template literal

### preflight.ts

**Score**: 5/10
**Issues Found**: 2 blocking, 1 serious, 0 minor

**Analysis**: The function does useful validation but has two blocking issues: the Windows-incompatible `which` call and the missing MCP server check. The side-effect-heavy design (printing errors and returning null) is functional but makes the code harder to test and reason about. The sequential `existsSync` checks are fine for a preflight function.

**Specific Concerns**:
1. Line 9: `which claude` -- not cross-platform
2. Missing: MCP server availability check per acceptance criteria
3. Line 72-75: Warning message sent to stderr and treated as error

### registry.ts

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: Clean, focused module with a clear single responsibility. The `TaskStatus` type and `RegistryRow` interface are well-defined. The regex-based parsing is appropriate for a markdown table. However, the `as string` assertions violate the project's own type safety rules, and the interface lacks `readonly`.

**Specific Concerns**:
1. Lines 42-49: `as string` type assertions on regex match groups
2. Lines 14-20: No `readonly` on interface fields
3. Line 39: Regex is brittle to formatting changes in registry.md

### index.ts

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Clean entry point. Version reading from `package.json` via `createRequire` follows the established lesson from TASK_2026_008. Registration order is consistent. One minor concern: `process.exit(1)` on line 26 vs `process.exitCode = 1` used everywhere else.

### init.ts, status.ts, create.ts

**Score**: 7/10 (stubs)
**Issues Found**: N/A (stubs, out of scope for deep review)

**Analysis**: Consistent stub pattern. All use `process.exitCode = 1` correctly per TASK_2026_008 lessons.

---

## Pattern Compliance

| Pattern                  | Status | Concern                                              |
| ------------------------ | ------ | ---------------------------------------------------- |
| File naming              | PASS   | All kebab-case with appropriate suffixes              |
| Import organization      | PASS   | Node builtins first, then third-party, then local    |
| Type-only imports        | PASS   | `import type` used correctly for Commander, RegistryRow |
| `process.exitCode` over `process.exit` | PARTIAL | `index.ts:26` uses `process.exit(1)`, commands use `process.exitCode = 1` |
| No `as` type assertions  | FAIL   | `registry.ts:42-49` uses `as string` and `as TaskStatus` |
| No `any` types           | PASS   | None found                                           |
| File size limits         | PASS   | Largest file is `run.ts` at 179 lines (under 200)    |
| Function naming          | PASS   | `verbNoun` pattern followed (parseRegistry, buildAutoPilotArgs, etc.) |
| Error handling           | PARTIAL | Errors printed but no structured error type           |

## Technical Debt Assessment

**Introduced**:
- String-typed numeric options that will need parsing when the Supervisor consumes them
- No shared status-grouping utility (will be duplicated in `status` command)
- Platform-specific `which` call that must be fixed before any Windows user tries the CLI

**Mitigated**:
- Stub commands now have a real implementation to reference as a pattern
- Registry parsing is extracted and reusable

**Net Impact**: Slight debt increase. The code works for the happy path on Unix, but carries forward two blocking portability/completeness gaps.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: Two blocking issues -- missing MCP server check (per acceptance criteria) and Windows-incompatible `which` call. The serious issues around type assertions, unvalidated numeric options, and mutable interfaces should also be addressed before merge.

## What Excellence Would Look Like

A 10/10 implementation would:
1. Include MCP server availability check as specified in acceptance criteria
2. Use cross-platform CLI detection (e.g., `claude --version`)
3. Parse and validate numeric options at the Commander boundary with `.argParser()`
4. Return a typed `Result` from preflight instead of `null` with side effects
5. Extract a `groupByStatus()` utility in `registry.ts` for reuse by `status` command
6. Mark all `RegistryRow` fields as `readonly`
7. Derive `TaskStatus` from the `VALID_STATUSES` array or use `satisfies` for sync enforcement
8. Include at least basic unit tests for `parseRegistry` and `preflightChecks`
9. Use `console.warn` for warnings, `console.error` for errors -- never mix
10. Handle `FAILED` status explicitly in preflight validation
