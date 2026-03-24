# Code Logic Review - TASK_2026_010

## Review Summary

| Metric              | Value         |
|---------------------|---------------|
| Overall Score       | 5/10          |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2             |
| Serious Issues      | 4             |
| Moderate Issues     | 3             |
| Minor Issues        | 3             |
| Failure Modes Found | 6             |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **FAILED tasks are silently treated as actionable.** A task with status FAILED passes through preflight in both single-task mode (no rejection) and all-tasks mode (counted as actionable). The Supervisor will attempt to re-process a FAILED task with no warning to the user.
- **Registry rows with invalid status are silently dropped.** If a row in `registry.md` has a typo in the status column (e.g., `COMPLET`), it is silently skipped. The user sees a lower task count with no explanation.
- **Child process spawn error does not terminate the CLI process.** If `claude` binary exists but crashes immediately, `process.exitCode = 1` is set but the Node process may linger depending on event loop state.

### 2. What user action causes unexpected behavior?

- **Ctrl+C during Supervisor execution.** No SIGINT/SIGTERM forwarding is implemented. The parent CLI process may exit while the spawned `claude` child process continues running as an orphan.
- **Running from a symlinked directory.** `process.cwd()` may resolve differently than expected, causing `existsSync` checks to fail on valid workspaces.

### 3. What data makes this produce wrong results?

- **Description containing a pipe character `|`.** The regex in `parseRegistry` will mis-parse or skip any registry row where the description contains a literal `|` (e.g., `Build A | B integration`). The regex anchors on `|` as column delimiters with no escape handling.
- **Multi-word type values.** The regex uses `(\S+)` for the type column (group 3). If someone adds a type like `BUG FIX` (two words), only `BUG` is captured and the rest of the row mis-parses. Current registry uses single-word types, but the format is not enforced.
- **Trailing whitespace or missing trailing `|`.** The regex requires the line to end with `|$`. Any line with trailing whitespace after the final `|` will not match.

### 4. What happens when dependencies fail?

- **`claude` CLI not installed or not on PATH.** Handled via `which claude` check. However, `which` is not available on all systems (not standard on some minimal Linux containers). `command -v claude` would be more portable.
- **`claude` CLI found but errors at runtime.** Handled via `child.on('error')` and `child.on('close')` handlers. Adequate for basic cases.
- **MCP session-orchestrator not running.** NOT checked at all -- see Critical Issue 1.

### 5. What's missing that the requirements didn't mention?

- **No `--force` flag passthrough.** The auto-pilot command supports `--force` to override stale RUNNING state, but the CLI `run` command does not expose this flag and does not pass it through.
- **No dependency graph in dry-run.** The auto-pilot spec shows a dependency graph in dry-run output. The CLI dry-run only shows task classification and wave ordering, with no dependency information.
- **No confirmation prompt before starting all-tasks mode.** Starting the full Supervisor loop processes all tasks autonomously -- a confirmation step would prevent accidental execution.

---

## Critical Issues

### C1: MCP Server Availability Check is Missing

- **File**: `packages/cli/src/utils/preflight.ts` (entire file -- check is absent)
- **Acceptance Criterion**: "Pre-flight checks verify MCP server availability"
- **Severity**: BLOCKING
- **Scenario**: User runs `npx nitro-fueled run`, passes all preflight checks, Supervisor starts, and immediately fails because MCP session-orchestrator is not configured or not running. The user sees a cryptic Claude error instead of a clear pre-flight message.
- **Evidence**: The task description explicitly states: "Verify MCP session-orchestrator is configured and reachable (from TASK_013)". The auto-pilot command spec (lines 51-60) describes a detailed MCP availability check. No MCP-related code exists anywhere in the CLI `src/` directory.
- **Impact**: Core acceptance criterion unmet. Users get a bad experience on first run.
- **Fix**: Add an MCP reachability check to `preflightChecks()`. At minimum, verify `.claude/settings.json` contains MCP server configuration. Ideally, attempt a lightweight MCP call (e.g., `list_workers`) or check if the MCP server process is running.

### C2: FAILED Task Status Not Handled in Preflight

- **File**: `packages/cli/src/utils/preflight.ts:53-84`
- **Severity**: BLOCKING
- **Scenario (single-task)**: User runs `npx nitro-fueled run TASK_2026_XXX` where the task has status FAILED. The code only rejects BLOCKED, CANCELLED, and COMPLETE (lines 67-75). A FAILED task passes through and the Supervisor is spawned for it with no warning.
- **Scenario (all-tasks)**: In the else branch (line 77-83), FAILED tasks are counted as "actionable" since only COMPLETE, BLOCKED, and CANCELLED are excluded.
- **Evidence**: The auto-pilot spec (line 62-65) says "verify the task ID exists in the registry and its status is CREATED or IMPLEMENTED. If status is IN_PROGRESS or IN_REVIEW, the Supervisor will spawn the appropriate worker type to resume." FAILED is not listed as a valid input state.
- **Impact**: FAILED tasks may be re-processed without the user's explicit intent. This could waste compute or cause repeated failures.
- **Fix**: Either reject FAILED tasks with a clear error, or add a `--force` flag (see Serious Issue 2) and require it to retry FAILED tasks.

---

## Serious Issues

### S1: No Signal Forwarding to Child Process

- **File**: `packages/cli/src/commands/run.ts:131-151`
- **Severity**: SERIOUS
- **Scenario**: User presses Ctrl+C during Supervisor execution. The CLI process receives SIGINT and exits. The spawned `claude` child process may continue running as an orphan because `stdio: 'inherit'` shares file descriptors but does not guarantee signal propagation.
- **Impact**: Orphaned `claude` processes consuming resources. Users must manually find and kill them.
- **Fix**: Add signal handlers:
  ```typescript
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const sig of signals) {
    process.on(sig, () => {
      child.kill(sig);
    });
  }
  ```

### S2: No `--force` Flag Exposed

- **File**: `packages/cli/src/commands/run.ts:153-179`
- **Severity**: SERIOUS
- **Evidence**: The auto-pilot command explicitly supports `--force` to "override stale RUNNING state" (auto-pilot.md line 26). The CLI `run` command does not expose this option and `buildAutoPilotArgs` does not pass it through.
- **Impact**: Users cannot recover from a previous crashed Supervisor session via the CLI. They would have to bypass the CLI and invoke Claude directly.
- **Fix**: Add `.option('--force', 'Override stale RUNNING state from a previous session', false)` and include it in `buildAutoPilotArgs`.

### S3: Registry Parse Silently Drops Rows with Invalid Status

- **File**: `packages/cli/src/utils/registry.ts:41-52`
- **Severity**: SERIOUS
- **Scenario**: A task row has a typo in the status column (e.g., `COMLETE` instead of `COMPLETE`). The regex matches the row structure, but the status validation on line 43 fails silently. The row is discarded. The user sees fewer tasks than expected with no warning or diagnostic output.
- **Impact**: Confusing UX. User creates a task, runs `npx nitro-fueled run`, and it is invisible.
- **Fix**: When a row matches the table format regex but has an invalid status, emit a warning: `Warning: Skipping row with unrecognized status "${status}" for task ${id}`.

### S4: Dry-Run Output Does Not Match Auto-Pilot Spec

- **File**: `packages/cli/src/commands/run.ts:49-100`
- **Severity**: SERIOUS
- **Evidence**: The auto-pilot spec (lines 89-113) defines dry-run output including a "Dependency Graph" section showing task dependencies and blocked reasons. The CLI dry-run (lines 49-100) only shows task classification and wave ordering with no dependency information.
- **Impact**: Users making decisions based on `--dry-run` output lack critical dependency information. The CLI dry-run misrepresents what the Supervisor would actually do (which considers dependencies).
- **Fix**: Either add dependency parsing from task.md files to show the dependency graph, or clearly label the CLI dry-run as "simplified" and note that the Supervisor will apply additional dependency ordering.

---

## Moderate Issues

### M1: `which` Command Not Portable

- **File**: `packages/cli/src/utils/preflight.ts:8-13`
- **Severity**: MODERATE
- **Scenario**: On some minimal Linux environments or Docker containers, `which` is not installed. `command -v` is POSIX-standard and more portable.
- **Fix**: Replace `which claude` with `command -v claude` or use Node's `path`-based lookup.

### M2: Regex Breaks on Description Containing Pipe Character

- **File**: `packages/cli/src/utils/registry.ts:38-39`
- **Severity**: MODERATE
- **Evidence**: The regex `/^\|\s*(TASK_\d{4}_\d{3})\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|$/` uses `|` as delimiters. A description like `Build A | B integration` will cause the regex to match incorrectly or fail.
- **Impact**: Data corruption in parsed results. While current descriptions avoid `|`, this is a latent bug waiting for the first user who includes one.
- **Fix**: Parse by splitting on `|` and trimming columns rather than using a single regex. This is more robust for markdown table parsing.

### M3: Regex Rejects Lines with Trailing Whitespace

- **File**: `packages/cli/src/utils/registry.ts:38-39`
- **Severity**: MODERATE
- **Evidence**: The regex ends with `\|$`, requiring the line to end immediately after the final `|`. Any trailing space (common in editors that auto-trim or don't) causes the line to be silently skipped.
- **Fix**: Change the regex ending from `\|$` to `\|\s*$`.

---

## Minor Issues

### N1: Type Mismatch on Numeric Options

- **File**: `packages/cli/src/commands/run.ts:8-10`
- **Severity**: NIT
- **Evidence**: `concurrency`, `interval`, and `retries` are typed as `string | undefined`. These are passed through as strings to the auto-pilot prompt. This is technically fine since they become prompt text, but there is no validation that `--concurrency abc` is rejected. The user gets no error from the CLI; the malformed value is passed to the Supervisor which may or may not handle it.
- **Fix**: Add basic validation (e.g., confirm concurrency and retries are positive integers, interval matches `\d+m` pattern) before spawning.

### N2: displaySummary Shows All Rows Even in Single-Task Mode

- **File**: `packages/cli/src/commands/run.ts:13-47`
- **Severity**: NIT
- **Scenario**: User runs `npx nitro-fueled run TASK_2026_010`. The summary shows counts for ALL tasks in the registry, not just the targeted task. This is potentially confusing -- the user might think all those tasks will be processed.
- **Fix**: In single-task mode, either show only the targeted task's info or add a note: "Only processing TASK_2026_010. Full registry shown for context."

### N3: `preflightChecks` Returns Full Row Array Even in Single-Task Mode

- **File**: `packages/cli/src/utils/preflight.ts:86`
- **Severity**: NIT
- **Evidence**: When `taskId` is provided, the function validates that the specific task exists and is processable, but then returns ALL rows. This means `displayDryRun` shows all tasks even when only one was requested. The display functions should receive filtered data in single-task mode.
- **Fix**: Return `[task]` (the single matched row) instead of `rows` when in single-task mode, or pass the taskId into display functions to filter.

---

## Failure Mode Analysis

### FM1: Orphaned Supervisor Process

- **Trigger**: Ctrl+C or SIGTERM sent to CLI process
- **Symptoms**: CLI exits, `claude` process continues running in background consuming resources and potentially modifying files
- **Impact**: HIGH -- uncontrolled autonomous code modification
- **Current Handling**: None
- **Recommendation**: Forward signals to child process; consider `detached: false` (already default) and adding explicit signal handlers

### FM2: MCP Server Unavailable at Runtime

- **Trigger**: MCP session-orchestrator not configured or not running
- **Symptoms**: CLI passes preflight, spawns Supervisor, Supervisor immediately fails with MCP error
- **Impact**: HIGH -- wasted time, confusing error from inside Claude session
- **Current Handling**: None -- no MCP check exists
- **Recommendation**: Add MCP availability check to preflight

### FM3: Stale Registry File

- **Trigger**: Another process (e.g., a running worker) modifies registry.md between preflight parse and Supervisor start
- **Symptoms**: Supervisor sees different state than what CLI displayed
- **Impact**: LOW -- Supervisor re-reads registry anyway, but the displayed summary is misleading
- **Current Handling**: None
- **Recommendation**: Acceptable risk. Document that summary is a snapshot.

### FM4: Corrupt or Hand-Edited Registry

- **Trigger**: User manually edits registry.md with formatting inconsistencies
- **Symptoms**: Tasks silently disappear from parsed results
- **Impact**: MEDIUM -- user confusion, tasks not processed
- **Current Handling**: Silent row drop
- **Recommendation**: Warn on unparseable rows that look like they might be task rows

### FM5: Concurrent CLI Invocations

- **Trigger**: User runs `npx nitro-fueled run` twice simultaneously
- **Symptoms**: Two Supervisor sessions spawned, both competing for the same tasks, potential state corruption in registry.md
- **Impact**: HIGH -- duplicate work, conflicting writes to registry
- **Current Handling**: None
- **Recommendation**: Add a lockfile mechanism (e.g., `task-tracking/.supervisor.lock`) checked during preflight

### FM6: FAILED Task Infinite Retry Loop

- **Trigger**: User runs `npx nitro-fueled run` with tasks in FAILED state, task keeps failing
- **Symptoms**: Supervisor keeps retrying FAILED tasks up to `--retries` limit, but on next `run` invocation they are picked up again
- **Impact**: MEDIUM -- wasted compute cycles
- **Current Handling**: FAILED not excluded from actionable tasks
- **Recommendation**: Exclude FAILED from default processing; require `--force` to retry

---

## Requirements Fulfillment

| Acceptance Criterion | Status | Concern |
|---|---|---|
| `npx nitro-fueled run` starts Supervisor loop | COMPLETE | Works via `spawnSupervisor` |
| `npx nitro-fueled run TASK_ID` processes single task | PARTIAL | FAILED status not rejected (C2) |
| `npx nitro-fueled run --dry-run` shows execution plan | PARTIAL | Missing dependency graph (S4) |
| Pre-flight checks verify workspace setup | COMPLETE | .claude/, task-tracking/, registry.md all checked |
| Pre-flight checks verify MCP server availability | MISSING | No MCP check exists (C1) |
| Flags passed through to Supervisor | PARTIAL | Missing `--force` flag (S2) |
| Clear error messages when prerequisites missing | COMPLETE | Good error messages with actionable suggestions |

### Implicit Requirements NOT Addressed

1. **Concurrent execution guard** -- No lockfile prevents multiple Supervisors from running simultaneously
2. **Signal handling** -- No SIGINT/SIGTERM forwarding to child process
3. **Input validation on numeric flags** -- `--concurrency abc` passes through unchecked
4. **`--force` flag for FAILED task retry** -- Auto-pilot supports it, CLI does not expose it

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Empty registry (no tasks) | YES | Returns null with clear error | None |
| Invalid task ID format | YES | Regex validation with helpful message | None |
| Task not in registry | YES | Explicit check with error | None |
| BLOCKED/CANCELLED task | YES | Rejected in single-task mode | None |
| COMPLETE task | YES | Rejected with warning | None |
| FAILED task | NO | Falls through to Supervisor | C2 |
| All tasks complete | YES | "Nothing to process" message | None |
| Description with `\|` char | NO | Regex breaks silently | M2 |
| Trailing whitespace in registry | NO | Row silently dropped | M3 |
| `claude` not on PATH | YES | `which` check | `which` portability (M1) |
| MCP server down | NO | Not checked | C1 |
| Ctrl+C during execution | NO | Orphan process risk | S1 |
| Concurrent `run` invocations | NO | No lock mechanism | FM5 |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: Missing MCP server availability check (acceptance criterion explicitly unmet)

The core flow (preflight -> summary -> spawn) is well-structured and the code is clean. Error messages are helpful. However, two acceptance criteria are not fully met (MCP check missing, FAILED status unhandled), and the lack of signal forwarding creates a real operational risk with orphaned autonomous processes. These issues should be addressed before marking the task COMPLETE.

## What Robust Implementation Would Include

- MCP server reachability check in preflight (verify config exists in `.claude/settings.json`, optionally ping)
- FAILED status handling (reject or require `--force`)
- `--force` flag passthrough to auto-pilot
- SIGINT/SIGTERM forwarding to spawned child process
- Lockfile to prevent concurrent Supervisor invocations
- Warnings for unparseable registry rows (not silent drops)
- Input validation on numeric CLI options
- Split-based markdown table parsing instead of fragile single regex
- Trailing whitespace tolerance in regex (`\|\s*$` instead of `\|$`)
