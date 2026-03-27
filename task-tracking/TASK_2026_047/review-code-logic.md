# Code Logic Review — TASK_2026_047

## Score: 6/10

## Findings

### BLOCKING

- **`resolveTaskId` accepts any shorthand string without format validation.** The function calls `shorthand.padStart(3, '0')` and constructs a full TASK ID regardless of what was passed. If a user runs `--task abc` or `--task 1234` or `--task ""`, the function produces `TASK_2026_abc`, `TASK_2026_1234`, or `TASK_2026_` respectively. These malformed IDs then reach `preflightChecks`, which does validate the pattern (`/^TASK_\d{4}_\d{3}$/`) and will reject them — but only after displaying a cryptic "Invalid task ID format" error that gives no hint the shorthand input was the problem. The fix path is correct (preflight catches it) but the UX failure path is confusing and the root cause (accepting any string as shorthand) should be addressed at the `resolveTaskId` boundary with a clear error message before preflight is ever called.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, line 217–227.

- **Single-task mode skips `validateOptions`, allowing `--concurrency`, `--interval`, and `--retries` to be silently accepted and ignored.** When `taskId !== undefined`, the code calls `preflightChecks` and then immediately calls `spawnOrchestrate`, returning before `validateOptions` is ever reached. A user who runs `npx nitro-fueled run TASK_2026_043 --concurrency bad_value` gets no error — the option is silently dropped. This is a silent failure that misleads the user into believing the option was applied. At minimum, single-task mode should reject batch-only options (`--concurrency`, `--interval`, `--retries`, `--skip-connectivity`, `--dry-run`) with a clear error message, matching the CLI help text that annotates them as "batch mode only".

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, lines 243–258.

- **`run.md` routing logic has no fallback branch for non-matching input.** The parse step defines two branches: empty → batch mode, matches `TASK_\d{4}_\d{3}` → single-task mode. There is no else branch. If a user types `/run foo` or `/run 043` (the shorthand that works in CLI), the slash command has no defined behavior. An agent executing this command will invent behavior, most likely treating the unrecognized argument as a description and routing to batch mode or erroring unpredictably. A third branch ("otherwise: display usage error listing valid formats") is required.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/run.md`, Step 1 parse section.

### SERIOUS

- **`resolveTaskId` uses `new Date().getFullYear()` to determine the year component, making shorthand year-sensitive.** If a user runs `--task 043` in January 2027, the expanded ID is `TASK_2027_043`. If the task was created in 2026, it will not be found in the registry and preflight will return a "Task not found" error. The shorthand is documented as expanding to `TASK_YYYY_043` where `YYYY` is the current year, but there is no documentation of this limitation, no warning, and no fallback. Users who use the shorthand near a year boundary or retroactively will hit a silent mismatch. The shorthand should either always require an explicit year (`043/2026`) or document this limitation prominently.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, line 222.

- **`create.md` flag stripping is underspecified for the agent executing it.** The routing step says "strip the flag, pass remaining text as description" but does not define the stripping algorithm. If a user types `/create --quick build a REST API`, the description is "build a REST API". But what about `/create build a REST API --quick`? Or `/create --quick`? The instruction is ambiguous for flag-in-middle and flag-only cases. An agent implementing this literally may strip only leading `--quick` occurrences, or may use a substring search. The command should specify: strip the first occurrence of `--quick` wherever it appears in the string and trim whitespace from the result. The empty-description case (only `--quick` was passed) also has no defined behavior — does it invoke `/create-task` with no argument, which may or may not prompt interactively?

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create.md`, Step 1 parse section.

- **Single-task mode preflight blocks on MCP connectivity check even though `spawnOrchestrate` does not use MCP workers.** `preflightChecks` calls `detectMcpConfig` and returns `null` (blocking the run) if MCP config is not found. In single-task mode, `/orchestrate TASK_ID` runs inline in the current session — it does not spawn MCP workers. A user without MCP configured (e.g., a developer who only wants to run a single task inline) is blocked from a flow that does not need MCP at all. The task description explicitly notes that `/orchestrate` runs "inline, no MCP workers." The preflight for single-task mode should use `basicPreflightChecks` (which exists in preflight.ts and skips MCP/registry validation) plus a targeted task lookup, not the full `preflightChecks`.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, lines 245–248. Relevant utility: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/preflight.ts`, line 28.

- **`buildAutoPilotArgs` passes `taskId` as the first positional argument to `/auto-pilot`, but single-task routing already branches away before calling `spawnSupervisor`.** This is harmless dead code for the current implementation, but it signals design confusion. If someone adds a third routing path in the future that re-enters `spawnSupervisor` with a `taskId`, it will silently construct an `/auto-pilot TASK_2026_043` command that `/auto-pilot` may or may not understand. The function should be documented to clarify that `taskId` is reserved for a future "scoped batch" mode, or the parameter should be removed.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, lines 131–151.

### MINOR

- **The `--task` option description says `043 expands to TASK_YYYY_043` but the CLI does not document the year-is-current-year behavior in help text.** Users who see only `--help` output will not know the expansion rule includes the current year. Adding "(current year)" to the description string would eliminate confusion.

  File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/run.ts`, line 233.

- **`displaySummary` is called with `undefined` as `taskId` in batch mode even when called from the batch path.** This is correct (the function uses `taskId` only for display) but the mode string falls back to `'all'` rather than something more informative. This is a UX nit, not a logic bug.

- **`run.md` Usage section shows `TASK_2026_XXX` as the example but the scaffold copy at `packages/cli/scaffold/.claude/commands/run.md` is byte-for-byte identical.** This is correct behavior for Part C, but the year `2026` hardcoded in the Usage example will become stale. Minor documentation drift risk.

- **`status.md` references `.claude/commands/project-status.md` for the full report format.** This path is correct for the canonical commands location, but users reading the scaffold copy (`packages/cli/scaffold/.claude/commands/status.md`) are pointed to a path that only exists after `init` copies the files. The reference is technically fine post-init but could confuse a user reading the scaffold file directly before init completes.

---

## Acceptance Criteria Verification

- [x] `/run` with no args invokes auto-pilot — routing logic correctly sends empty `$ARGUMENTS` to `/auto-pilot`
- [x] `/run TASK_2026_XXX` invokes orchestration for that single task — routing logic correctly matches the regex and delegates to `/orchestrate $ARGUMENTS`
- [ ] `/run` with unrecognized input has defined behavior — **MISSING: no else/fallback branch; behavior is undefined for `/run 043` or `/run foo`**
- [x] `/create` with no args invokes Planner discussion — no `--quick` branch delegates to `/plan $ARGUMENTS`
- [x] `/create --quick` invokes form-based task creation — `--quick` detection strips flag and delegates to `/create-task`
- [x] `/status` shows project status — delegates to `/project-status`, no logic needed
- [x] CLI `npx nitro-fueled run TASK_ID` orchestrates a single task — `positionalTaskId` flows through `resolveTaskId` → `preflightChecks` → `spawnOrchestrate`
- [ ] CLI `npx nitro-fueled run --task 043` works as shorthand — **PARTIAL: expansion works but accepts any string including invalid formats; year boundary is undocumented; MCP requirement blocks a flow that does not need MCP**
- [x] Existing commands still work — new commands are thin routers; existing commands (`/orchestrate`, `/auto-pilot`, `/plan`, `/create-task`, `/project-status`) are not modified
- [x] New commands copied to scaffold for `init` — all three files confirmed present at `packages/cli/scaffold/.claude/commands/`

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`--concurrency bad_value` passed alongside a task ID is accepted with no error and silently ignored. `--task abc` expands to `TASK_2026_abc`, which is then rejected by preflight with an error message that doesn't mention the shorthand expansion. Neither failure surfaces a useful signal to the user. In both cases the process exits non-zero, but the user cannot diagnose the cause from the message alone.

### 2. What user action causes unexpected behavior?

`/run 043` typed in Claude — the shorthand works in CLI but the slash command has no documented behavior for non-TASK-format input. An agent executing the command will hit the no-match case in the parse step and improvise. The user intended single-task mode; the agent may enter batch mode or output a usage error with no guidance about the `TASK_YYYY_NNN` format requirement.

### 3. What data makes this produce wrong results?

Running `--task 043` on December 31 of any year, if the task was created the prior year. The expansion produces `TASK_{current_year}_043` which won't match a `TASK_{prior_year}_043` registry entry. The registry lookup fails with "Task not found" — wrong result for correct input.

### 4. What happens when dependencies fail?

Single-task mode calls `preflightChecks`, which requires MCP config to be present or it returns `null` and blocks execution. `/orchestrate` (the actual target) runs inline and does not need MCP. A user without MCP configured cannot run a single task despite the flow being fully functional without MCP. This is the most impactful production failure mode: a developer's first experience with `run TASK_ID` fails before any work is attempted, with an MCP setup error that is irrelevant to their goal.

### 5. What's missing that the requirements didn't mention?

The requirements do not specify what `/run` should do when given an argument that is not a valid TASK ID (e.g., `/run 043` as shorthand, or `/run fix the bug`). The CLI handles this via the positional argument being passed through `resolveTaskId` (which only applies the year expansion to `--task`, not to the positional), then failing validation in preflight. The slash command has no equivalent guardrail and no fallback branch documented.

---

## Summary

The routing logic for the core acceptance criteria is correct. The happy path (empty → auto-pilot, full TASK ID → orchestrate) works in both the slash command and CLI. The scaffold sync is complete. The existing commands are untouched.

The implementation has three meaningful gaps:

1. The single-task CLI path uses a preflight function that requires MCP, but MCP is not needed for inline orchestration. This blocks a valid use case entirely.
2. The `resolveTaskId` shorthand expands any string without validating it is a numeric task number, and the year-is-current-year behavior is undocumented and will produce wrong results across year boundaries.
3. The `/run` slash command has no fallback branch for non-TASK-format input, leaving agent behavior undefined for the most natural shorthand attempt (`/run 043`).

These issues make the `--task` shorthand unreliable in edge conditions and create an unnecessary MCP dependency on the single-task CLI flow. The slash commands are otherwise clean thin routers with no stubs.
