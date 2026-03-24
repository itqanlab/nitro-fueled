# Code Logic Review — TASK_2026_011

## Summary

The status command is a solid, well-structured implementation that covers all acceptance criteria. Parsing logic for registry, orchestrator-state, and plan.md is functional against the real file formats in this repo. However, there are several parsing fragility issues, a missing feature in brief mode, and silent failure paths that could mislead users. The code has no stubs or placeholders -- every function is fully implemented.

| Metric              | Value           |
|---------------------|-----------------|
| Overall Score       | 7/10            |
| Assessment          | PASS_WITH_NOTES |
| Critical Issues     | 0               |
| Serious Issues      | 0               |
| Major Issues        | 2               |
| Minor Issues        | 4               |
| Nits                | 2               |
| Failure Modes Found | 5               |

## Acceptance Criteria Check

| Criterion | Status | Notes |
|-----------|--------|-------|
| `npx nitro-fueled status` displays task registry summary | COMPLETE | Full display with counts, detail table, blockers |
| Shows per-state task counts | COMPLETE | Iterated from STATUS_ORDER, only non-zero shown |
| Shows active workers if Supervisor is running | COMPLETE | Parses orchestrator-state.md worker table |
| Shows plan progress if plan.md exists | COMPLETE | Parses phases, milestones, guidance |
| `--brief` flag shows one-line summary | COMPLETE | One-line pipe-separated summary |
| Handles missing files gracefully | COMPLETE | All three files checked with existsSync before read |

## Findings

### [MAJOR] Registry regex rejects rows with multi-word Type values

- **File**: `packages/cli/src/utils/registry.ts:38-39`
- **Issue**: The registry row regex uses `(\S+)` for the Type column. This only matches single-word types like `FEATURE` or `DEVOPS`. If a type like `BUG_FIX` is used (underscore, fine) it works, but any type with a space (unlikely but not validated elsewhere) would cause the row to be silently skipped. More critically, `(\S+)` for the Description group would be wrong -- but it actually uses `(.+?)` for description, so that part is fine. The real risk is that `(\S+)` for Status (group 2) and Type (group 3) means any status or type containing whitespace silently drops the row with no warning.
- **Suggestion**: This is acceptable given the current enum-style statuses and types, but the silent skip behavior means a malformed row is invisible. Consider logging skipped lines to stderr in a `--verbose` mode, or at minimum documenting the assumption that status and type are always single tokens.

### [MAJOR] Plan phase status regex breaks on `\r\n` line endings

- **File**: `packages/cli/src/commands/status.ts:113`
- **Issue**: The phase regex `/### Phase \d+:\s*(.+)\n\*\*Status\*\*:\s*(.+)/g` uses a literal `\n` to match the newline between the heading and the status line. If the plan.md file has Windows-style `\r\n` line endings (e.g., edited on Windows, or a git checkout with `core.autocrlf=true`), the `\n` still matches but `(.+)` in group 1 captures the trailing `\r`, producing phase names like `"Orchestration Engine\r"`. This would display as garbled output in some terminals.
- **Suggestion**: Normalize line endings before parsing: `content.replace(/\r\n/g, '\n')` at the top of `parsePlan`, or use `\r?\n` in the regex. Same concern applies to `parseActiveWorkers` though the line-by-line split approach is more tolerant since `split('\n')` leaves `\r` at end of lines which `trim()` in the cell processing handles.

### [MINOR] Brief mode skips plan progress entirely

- **File**: `packages/cli/src/commands/status.ts:295-298`
- **Issue**: When `--brief` is used, `parsePlan` is never called (line 300 is after the brief return). The acceptance criterion says "Shows plan progress if plan.md exists" -- brief mode shows no plan info at all. Whether this is intentional is debatable, but a brief one-liner like `Phase 2: 60%` would be useful context.
- **Suggestion**: Consider adding active phase name and overall completion percentage to the brief output if plan exists. Low priority since "brief" implies minimal output.

### [MINOR] Worker table parser uses magic column indices without validation

- **File**: `packages/cli/src/commands/status.ts:84-92`
- **Issue**: The parser assumes a fixed 9-column table and plucks indices 0, 1, 2, 3, 4, 6 by position. If the orchestrator-state.md format ever adds, removes, or reorders columns, the parser silently reads wrong data. The `cells.length >= 7` guard only prevents crashes, not semantic errors. Column 5 (Spawn Time) is skipped, column 6 (Last Health) is read as `health` -- all by positional convention.
- **Suggestion**: Consider validating the header row to confirm expected column names before parsing data rows. This is defensive but would prevent silent misreads if the format evolves.

### [MINOR] `headerPassed` flag starts `false` but is set to `false` again on header detection

- **File**: `packages/cli/src/commands/status.ts:73-74`
- **Issue**: Line 73 detects the header row (`Worker ID`) and sets `headerPassed = false`. But `headerPassed` is already initialized to `false` on line 57. This is a no-op assignment. The intent seems to be "skip the header", but this is already achieved by only processing rows when `headerPassed` is `true` (set on separator line). The redundant assignment is harmless but confusing.
- **Suggestion**: Remove the `headerPassed = false` on line 74 or add a comment clarifying the intent. It reads like it was meant to handle multiple tables, but the `break` on line 65 already exits on the next `##`.

### [MINOR] Rows with invalid status are silently dropped

- **File**: `packages/cli/src/utils/registry.ts:43-44`
- **Issue**: If a registry row has a status not in `VALID_STATUSES` (e.g., a typo like `COMPELTE`), the row is silently skipped. The total count and detail table will not include it. The user sees a count that doesn't match the actual registry file, with no indication that rows were filtered. This is a data integrity concern -- the status command's job is to report reality, and hiding rows defeats that purpose.
- **Suggestion**: Either include rows with unknown status (perhaps showing the raw status string), or print a warning like `Warning: Skipping row TASK_XXXX with unknown status 'COMPELTE'`.

### [NIT] `descWidth` is defined but not used for column width alignment

- **File**: `packages/cli/src/commands/status.ts:229`
- **Issue**: `descWidth` (45) is used for the separator line length but not for padding the description column in the data rows. The description column is truncated to `descWidth - 3` chars with ellipsis, but not padded to `descWidth`. This means the table's last column is ragged. For the other three columns, `padEnd` is used. This is fine visually since Description is the last column, but it means the separator line width doesn't match the data.
- **Suggestion**: Cosmetic only. No functional impact.

### [NIT] Task detail table is not sorted

- **File**: `packages/cli/src/commands/status.ts:248`
- **Issue**: Rows are displayed in registry file order. There's no sorting by status (to group IN_PROGRESS tasks together, for example) or by ID. The status summary section uses `STATUS_ORDER` for a logical grouping, but the detail table doesn't mirror that. This means a user scanning for in-progress tasks must visually search the entire table.
- **Suggestion**: Consider sorting rows by status (using `STATUS_ORDER` priority) then by ID within each status group. Low priority UX improvement.

## Failure Mode Analysis

### Failure Mode 1: Corrupted/partial registry file

- **Trigger**: Registry file exists but is truncated mid-write (e.g., process killed during write, disk full)
- **Symptoms**: Rows before the corruption point display normally; rows after are silently dropped. User sees partial data with no warning.
- **Impact**: Low -- user might not notice missing tasks
- **Current Handling**: Regex-based line matching naturally skips unparseable lines
- **Recommendation**: Display a count like `Parsed X of Y table rows` if any lines starting with `|` were not matched by the regex, so the user knows data was skipped.

### Failure Mode 2: orchestrator-state.md says RUNNING but workers table is empty

- **Trigger**: Supervisor just started (no workers spawned yet) or all workers completed but loop hasn't stopped
- **Symptoms**: Full status shows "Supervisor is running" header section is skipped entirely because `workers.length === 0`. User has no indication the Supervisor is active.
- **Impact**: Medium -- user doesn't know Supervisor is running, might start another instance
- **Current Handling**: Active workers section is only shown if workers exist. Loop status (RUNNING) is checked but not displayed.
- **Recommendation**: If loop status is RUNNING but workers list is empty, show a line like `Supervisor is running (no active workers)`.

### Failure Mode 3: plan.md with non-standard phase heading format

- **Trigger**: Phase heading like `### Phase 1 - Orchestration Engine` (dash instead of colon) or `### Phase One: ...`
- **Symptoms**: Phase is silently not parsed. Plan section shows active phase/milestone from metadata but phases array is empty.
- **Impact**: Low -- partial plan info still shown
- **Current Handling**: Regex requires exact `### Phase \d+:\s*` format
- **Recommendation**: Acceptable given the plan is machine-generated by the Planner agent. Document the expected format dependency.

### Failure Mode 4: Very large registry (100+ tasks)

- **Trigger**: Long-running project with many tasks
- **Symptoms**: Detail table becomes unwieldy in terminal output. No pagination, no filtering by status.
- **Impact**: Low -- UX degradation, not a bug
- **Current Handling**: All rows printed unconditionally
- **Recommendation**: Future enhancement -- add `--filter` flag for status filtering. Not blocking.

### Failure Mode 5: readFileSync throws on permission error

- **Trigger**: File exists (passes `existsSync`) but is not readable (chmod 000, or locked by another process on Windows)
- **Symptoms**: Unhandled exception crashes the CLI
- **Impact**: Medium -- violates the "no crash" acceptance criterion
- **Current Handling**: No try/catch around `readFileSync` calls in any of the three parsing functions
- **Recommendation**: Wrap `readFileSync` calls in try/catch. On error, return empty/null and print a warning like `Warning: Could not read <file>: <error.message>`.

## Verdict

**PASS_WITH_NOTES**

The implementation fulfills all six acceptance criteria. Parsing logic is correct against the actual file formats in this repository. The code is clean, well-typed, and has no stubs or placeholders.

The two MAJOR findings (multi-word type fragility and `\r\n` line endings) are unlikely to hit in the current project but represent real parsing brittleness. Failure Mode 5 (readFileSync permission error) technically violates the "no crash" criterion but is an edge case. Failure Mode 2 (RUNNING with no workers) is a UX gap worth addressing.

None of these are blocking for the current project context where the files are machine-generated by known agents, but they would become real issues if the CLI is used on external projects with varied environments.
