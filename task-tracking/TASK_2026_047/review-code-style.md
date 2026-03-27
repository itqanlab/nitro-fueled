# Code Style Review — TASK_2026_047

## Score: 6/10

## Findings

### BLOCKING

- **`run.ts` line 217: `resolveTaskId` line length violates readability convention.** The function signature `function resolveTaskId(positional: string | undefined, shorthand: string | undefined): string | undefined` is 89 characters. More critically, the function's behavior is silently wrong for an edge case: if a user passes `--task 4` the output is `TASK_2026_004` (padded to 3 digits from the left), but if they pass `--task 4000`, `padStart(3, '0')` is a no-op and returns `TASK_2026_4000`, which will fail the `preflightChecks` regex `/^TASK_\d{4}_\d{3}$/`. The `resolveTaskId` function itself never validates the shorthand length or format before constructing an ID that will be caught only much later inside preflight. The function should validate that shorthand is 1-3 numeric digits and error-out early with a descriptive message, not silently construct a malformed ID. This is a correctness flaw masquerading as a style issue — the contract implied by the option description `043 expands to TASK_YYYY_043` does not match the actual behaviour for out-of-range inputs.

- **`.claude/commands/run.md` line 18: regex in a prose command doc creates a silent partial-match trap.** The routing instruction reads: `Matches /^TASK_\d{4}_\d{3}$/ → single-task mode`. This is the only guard documented. If a user types `/run TASK_2026_043 extra-words`, the argument string is `TASK_2026_043 extra-words`, which does NOT match the regex (due to the space), so it silently falls into batch mode and the task ID is ignored without any error or warning. The guard correctly handles the canonical form, but the failure mode for slightly malformed input (extra trailing text) is completely silent and confusing. The command doc must include an explicit "Unrecognized argument format" branch that warns the user rather than silently degrading to batch mode.

### SERIOUS

- **`run.ts` line 200: `spawnSupervisor` passes `taskId` to `buildAutoPilotArgs` even in the now-dead code path.** After the refactor, `spawnSupervisor` is always called with `taskId = undefined` (line 318). The single-task case exits before reaching it. Yet `buildAutoPilotArgs` still branches on `taskId !== undefined` (line 134) and would push the task ID as the first argument to `/auto-pilot`. This dead branch could become alive again if someone refactors the call sites without noticing, reintroducing the old pre-refactor behaviour (routing single-task via auto-pilot instead of orchestrate). The dead branch should be removed from `buildAutoPilotArgs`, or the function's single remaining caller should be renamed to make the scope explicit.

- **`run.ts` line 239: `opts` type is widened inline at the action callback boundary.** The action handler types its second argument as `RunOptions & { skipConnectivity: boolean }`. The `skipConnectivity` field is not part of the `RunOptions` interface even though it is always present in batch mode. This means any code that inspects `opts` before the `taskId !== undefined` guard could theoretically access `skipConnectivity` on an object that is typed as not having it, without TypeScript complaining. The clean fix is to add `skipConnectivity: boolean` to `RunOptions` (it is a run-time option just like `dryRun`) and remove the intersection type at the action boundary. The current approach is a type-boundary smell.

- **`.claude/commands/create.md` line 27: "strip the flag, pass remaining text as description" is ambiguous for `--quick description --quick`.** If the argument contains `--quick` twice, stripping by flag name leaves one occurrence. The instruction does not define whether to strip only the first match, all matches, or to error on duplicates. For a router command with no actual argument parser, this ambiguity leaves the AI executor free to choose — meaning two executions of the same command could produce different results. The step should specify "strip all occurrences of `--quick`" or "if `--quick` appears more than once, treat as a single flag."

- **`.claude/commands/run.md` and `scaffold/.claude/commands/run.md` are byte-for-byte identical, but the Note at line 34 says "For batch options (--dry-run, --concurrency, --interval), use `/auto-pilot` directly."** This omits `--retries` which is also a batch-only option (documented in auto-pilot.md and in the CLI `--retries` flag added in this task). The note is now an incomplete enumeration that will mislead users who want to override retries. Either list all four batch options or rephrase to "all batch options" without enumerating them.

- **`.claude/commands/status.md` line 15: the cross-reference path `.claude/commands/project-status.md` is hardcoded.** Per the review lessons "Cross-file section references must use names, not numbers" principle and the broader "dynamic reference file discovery over hardcoded paths" rule, a scaffold-copied command file that hardcodes `.claude/commands/project-status.md` will break if the project renames or relocates that file. The reference should say "see the `project-status` command" without encoding a file path that is project-layout-dependent.

### MINOR

- **`run.ts` line 233: option description `'Single task shorthand: 043 expands to TASK_YYYY_043'`** uses the literal string `YYYY` where the intent is to convey "current year". This is fine as a placeholder but could confuse users who think the year is literally `YYYY`. Consider `'Single task shorthand: 043 expands to TASK_<current-year>_043'` or just `'Task number shorthand (e.g. 043 → TASK_2026_043)'`.

- **`run.ts` line 209: `spawnOrchestrate` label is `Orchestrate ${taskId}`** (with a capital `O`). Every other label in this file (`Supervisor`) is a single noun without a verb prefix. The inconsistency is cosmetic but `spawnClaude` prints this label as `Starting Orchestrate TASK_2026_043: claude ...` which reads awkwardly. Aligning to `Orchestrator` or `Orchestrate-TASK_2026_043` would be consistent.

- **`.claude/commands/create.md` line 24: `/plan $ARGUMENTS`** passes the full argument string including any leading/trailing whitespace from `$ARGUMENTS`. The Note section acknowledges this ("pass remaining text as description") but in Planner mode, if the user typed `/create   build a login page` (extra spaces), those spaces propagate to `/plan`. This is a cosmetic edge case but worth a trim instruction.

- **Scaffold copies (`packages/cli/scaffold/.claude/commands/`) are exact mirrors of their canonical counterparts.** This is expected, but there is no automated check or comment in the files noting they must be kept in sync. The review-lessons note on "partial genericization" warns about drift. A one-line comment at the top of each scaffold copy (`<!-- scaffold copy — keep in sync with .claude/commands/run.md -->`) would make the sync responsibility explicit for future contributors.

- **Naming: `resolveTaskId` at line 217 does two different things** depending on which parameter is non-undefined: it either returns the positional value unchanged (identity) or constructs a new ID from a shorthand. The name `resolveTaskId` describes only the shorthand path. The function would be clearer as `normalizeTaskId` or, better, as two separate functions with explicit names, since the positional path is a passthrough with zero logic.

## File-by-File Summary

### `.claude/commands/run.md` — Score: 6/10
Structurally clean and consistent with the `/auto-pilot` and `/orchestrate` precedent. The regex-based routing guard is a good explicit specification. Main concerns: silent degradation on malformed input, and the incomplete enumeration of batch-only options in the Notes section.

### `.claude/commands/create.md` — Score: 7/10
Clear routing table, consistent structure. The flag-stripping instruction is ambiguous for repeated flags and the Planner-mode passthrough lacks a trim instruction. Otherwise solid.

### `.claude/commands/status.md` — Score: 7/10
Minimal and correct. The hardcoded path reference is the only concern.

### `packages/cli/src/commands/run.ts` — Score: 5/10
The routing logic is correct for the happy path. Issues: `resolveTaskId` accepts out-of-range shorthand without validation, the dead branch in `buildAutoPilotArgs` (taskId path that is now unreachable) creates maintenance confusion, and `skipConnectivity` leaking as an intersection type at the action boundary is a type hygiene issue.

### `packages/cli/scaffold/.claude/commands/` (three files) — Score: 7/10
Correct copies. No content issues beyond inheriting the issues from the canonical `.claude/commands/` counterparts.

## Summary

The implementation is directionally correct: the routing logic works for well-formed inputs and the thin-router pattern is appropriate. The blocking issues are a silent failure mode in argument routing (malformed TASK_ID in the slash command) and an unvalidated shorthand expansion in the CLI that constructs invalid IDs without user feedback. The serious issues centre on a dead code branch that could silently resurrect old behaviour, an inline type widening smell, and ambiguous flag-stripping instructions. None of these would cause a production incident today, but each represents a trap for the next person to modify this code.
