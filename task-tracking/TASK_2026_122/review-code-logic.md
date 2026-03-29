# Code Logic Review - TASK_2026_122

## Review Summary

| Metric              | Value                  |
| ------------------- | ---------------------- |
| Overall Score       | 5/10                   |
| Assessment          | NEEDS_REVISION         |
| Critical Issues     | 2                      |
| Serious Issues      | 3                      |
| Moderate Issues     | 3                      |
| Failure Modes Found | 6                      |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The scaffold `settings.json` is copied verbatim with the literal placeholder string `{{NITRO_CORTEX_PATH}}/dist/index.js` as the `args` value. No substitution happens anywhere in `init.ts` or `scaffold.ts`. Claude Code will load this file, see a node path that starts with `{{`, and silently fail to start the nitro-cortex MCP server. The agent will continue with `cortex_available = false` — every skill using nitro-cortex appears to work (the auto-pilot skill falls back to files) but the tools never actually run. There is no error shown to the user.

### 2. What user action causes unexpected behavior?

A user runs `npx nitro-fueled init --skip-cortex`. The scaffold `settings.json` with the `nitro-cortex` mcpServers block is still copied (Step 4 of `init.ts` copies all scaffold files unconditionally). But no cortex path was configured, so `args` still contains `{{NITRO_CORTEX_PATH}}`. The user then runs auto-pilot, sees `CORTEX UNAVAILABLE`, assumes it is a configuration issue, but the scaffold `settings.json` is already present with an invalid path — the `handleNitroCortexConfig` check (`'nitro-cortex' in servers`) will find the key and return early, preventing the user from reconfiguring via a second `init` run unless they use `--overwrite`.

### 3. What data makes this produce wrong results?

In `handleNitroCortexConfig` (init.ts lines 279-289), the already-configured check reads `.mcp.json` only. If `nitro-cortex` was written into `.mcp.json` by a previous run with a wrong path, re-running `init` will say "already configured" and skip re-prompting, leaving the broken entry intact. The scaffold `settings.json` already has `nitro-cortex` in it, so this check can also short-circuit on the scaffolded file before the user ever enters a real path — but the check only reads `.mcp.json`, so this specific case is not triggered. However, the combination of (a) scaffolded settings.json with placeholder path AND (b) `.mcp.json` not existing means both files are in play with no conflict detection.

### 4. What happens when dependencies fail?

**Step 4 (cortex_available = true) → `get_next_wave` fails mid-session**: The skill documents `get_next_wave` claims tasks atomically, but the fallback logic in Step 5e-pre (`claim_task()`) has a conditional: "If `get_next_wave()` was used in Step 4, tasks are already claimed — skip this step." If `get_next_wave` returned partially (e.g., 2 of 3 requested slots) and then `spawn_worker` fails for one, there is no corresponding `release_task` call in the spawn-failure path (5g). The claimed-but-not-spawned task stays claimed in cortex DB until session ends or TTL expires. This is a logical gap in the cortex path not present in the fallback path.

**`configureNitroCortex` in mcp-configure.ts** does not emit the "not portable across machines" warning that `configureMcp` emits for project-level configs (line 75 in mcp-configure.ts). Both functions use absolute paths for project-level config, but only `configureMcp` warns. This is an asymmetry that will surprise users sharing repos.

### 5. What's missing that the requirements didn't mention?

The scaffold `settings.json` is missing `mcp__nitro-cortex__emit_event` from the permissions `allow` list. The orchestration SKILL.md's "Phase Event Emission (Supervisor Telemetry)" section explicitly calls `emit_event` from Build Workers. Without this permission, Build Workers in Supervisor mode will hit a permission prompt or silent tool rejection for every phase transition, degrading the reactive monitoring that `get_pending_events` depends on.

Additionally, the task description says to add nitro-cortex to `packages/cli/src/commands/init.ts` (using `packages/` prefix) but the actual file is `apps/cli/src/commands/init.ts`. The implementation correctly used `apps/`, but the task description is inconsistent — a minor doc issue but could mislead future developers reading the task.

---

## Failure Mode Analysis

### Failure Mode 1: Unsubstituted Placeholder in Scaffold settings.json

- **Trigger**: `npx nitro-fueled init` on any new project copies `scaffold/.claude/settings.json` verbatim. The `args` field contains `["{{NITRO_CORTEX_PATH}}/dist/index.js"]` which is never replaced.
- **Symptoms**: Claude Code loads the settings, attempts to start `node {{NITRO_CORTEX_PATH}}/dist/index.js`, fails silently. Auto-pilot logs `CORTEX UNAVAILABLE` and falls back to file-based state. Users think cortex is an optional component — it was intended to be mandatory for new installs.
- **Impact**: AC1 ("Auto-pilot core loop makes zero direct registry.md or status file reads") is never achieved for users who ran `init` — they always operate in the fallback path even if nitro-cortex is running, because the configured path is broken.
- **Current Handling**: None. The placeholder string is valid JSON and does not cause a parse error.
- **Recommendation**: Either (a) remove `mcpServers` from the scaffold `settings.json` and let `handleNitroCortexConfig` write the real path into `.mcp.json`, or (b) implement template substitution in the scaffold copy logic that replaces `{{NITRO_CORTEX_PATH}}` when a path is provided. Option (a) is simpler and consistent with how `session-orchestrator` is handled (via `.mcp.json`).

### Failure Mode 2: Claimed-but-Not-Spawned Task Leak (cortex_available = true)

- **Trigger**: `get_next_wave(session_id, slots)` atomically claims N tasks. `spawn_worker` fails for one of them (provider failure or MCP error). The spawn-failure handler in Step 5g does NOT call `release_task`.
- **Symptoms**: The task is claimed in cortex DB but no worker is running for it. On the next loop, `get_next_wave` will not return that task (it is already claimed by this session). The task is effectively stuck for the rest of the session lifetime or until cortex TTL expires.
- **Impact**: Under provider-failure conditions (the most likely production failure), tasks can be silently orphaned within the same session. The fallback path (cortex_available = false) does not have this problem because there is no DB claim to undo.
- **Current Handling**: The skill documents that `release_task` is called in Step 7d on successful completion but there is no `release_task` in Step 5g (spawn failure).
- **Recommendation**: In Step 5g, for any spawn failure when `cortex_available = true`, call `release_task(task_id, current_status)` before "Leave task status as-is." Log `"RELEASE AFTER SPAWN FAILURE — TASK_X"`.

### Failure Mode 3: `emit_event` Missing from Scaffold Permissions

- **Trigger**: Build Workers call `emit_event` at every phase transition (IN_PROGRESS, PM_COMPLETE, ARCHITECTURE_COMPLETE, BATCH_COMPLETE, IMPLEMENTED) per orchestration SKILL.md "Phase Event Emission" section.
- **Symptoms**: Without `mcp__nitro-cortex__emit_event` in the permissions `allow` list, workers either get a permission prompt (blocking automation) or the tool call is rejected silently. The Supervisor's `get_pending_events` queue is never populated, making reactive monitoring fall back to 5-minute polling intervals even in event-driven mode.
- **Impact**: Degrades the core value proposition of the cortex integration — event-driven completion detection breaks for every task. The Supervisor's 30-second fast poll (event-driven mode) becomes functionally equivalent to the 5-minute polling mode.
- **Current Handling**: None. The permission entry is simply absent.
- **Recommendation**: Add `"mcp__nitro-cortex__emit_event"` to the `permissions.allow` array in `scaffold/.claude/settings.json`. This brings the total to 19 tools.

### Failure Mode 4: `cortex_available` Flag Initialized Twice with Possibly Different Results

- **Trigger**: In auto-pilot SKILL.md, the nitro-cortex availability check happens at "MCP Requirement" section (inspecting MCP tool list for `get_tasks`). Then Step 2 says "Call `get_tasks()` at Step 2. If it succeeds, set session flag `cortex_available = true`... If it fails, set `cortex_available = false`." These are two different check mechanisms: one inspects the tool list, one makes an actual call.
- **Symptoms**: If the tool exists in the list but fails on invocation (transient DB error, startup error), the Step 2 call overrides the pre-set flag to `false`. This is correct behavior. But the reverse — tool not in list but call somehow succeeds — is impossible, so the logic is sound in the success direction. However, the two-phase initialization creates confusion: Step 1 (Read State, compaction recovery) executes before Step 2 and uses `cortex_available` in the preferred path. At Step 1 time, `cortex_available` was set by the tool-list check. If Step 2 overrides it to `false`, Step 1 already ran on the (now incorrect) assumption of `true`.
- **Impact**: On the first session loop after startup, Step 1 may use `get_session()` but Step 2 overrides `cortex_available = false`, leaving subsequent steps using file-based paths while Step 1's recovery data came from DB. This is a partial-cortex state that the skill does not explicitly handle.
- **Current Handling**: The skill documents the override at Step 2 but does not address re-running Step 1 on override.
- **Recommendation**: Resolve `cortex_available` in one place before Step 1 runs. The tool-list check at "MCP Requirement" should be the single source of truth; Step 2's override should be removed or demoted to a warning if Step 1 already ran on the cortex path.

### Failure Mode 5: `handleNitroCortexConfig` Only Checks `.mcp.json` for "Already Configured"

- **Trigger**: The scaffold copies `settings.json` (which contains `mcpServers.nitro-cortex`) before `handleNitroCortexConfig` runs. `handleNitroCortexConfig` only checks `.mcp.json` for the existing `nitro-cortex` key, not `settings.json`.
- **Symptoms**: The scaffolded `settings.json` with the placeholder path coexists with a correctly configured `.mcp.json` entry written by `handleNitroCortexConfig`. Claude Code may load one or the other, or merge them depending on which file takes precedence. If `settings.json` takes precedence, the properly configured `.mcp.json` is ignored.
- **Impact**: Silent dual-config: placeholder path in `settings.json` overrides the real path in `.mcp.json`. The MCP server does not start.
- **Current Handling**: None. The two files are written independently with no conflict check.
- **Recommendation**: See Failure Mode 1's recommendation — remove `mcpServers` from `scaffold/.claude/settings.json`. Keep only the `permissions.allow` block there.

### Failure Mode 6: `printSummary` Shows Cortex Hint Even When User Configured It

- **Trigger**: `printSummary(mcpAfter.found, opts['skip-mcp'], opts['skip-cortex'])` is called with the final MCP check result but `skipCortex` is `opts['skip-cortex']`. If the user provided `--cortex-path` and configuration succeeded, `skipCortex` is `false`, so the hint is suppressed correctly. But `mcpAfter` only re-checks `session-orchestrator` (via `detectMcpConfig`) — there is no corresponding `detectNitroCortexConfig` call. The cortex hint is driven entirely by the `--skip-cortex` flag, not the actual post-run state.
- **Symptoms**: If `configureNitroCortex` fails (returns false) but `--skip-cortex` was not passed, no cortex hint appears in the summary. The user has no indication that cortex configuration failed.
- **Impact**: Silent configuration failure. Users assume cortex is configured when it is not.
- **Current Handling**: `configureNitroCortex` logs an error if it fails, but `printSummary` does not account for the failure case.
- **Recommendation**: Track the return value of `configureNitroCortex` and pass a `cortexConfigured: boolean` to `printSummary`, mirroring the pattern used for MCP.

---

## Critical Issues

### Issue C1: Scaffold settings.json Contains Unsubstituted Placeholder Path

- **File**: `apps/cli/scaffold/.claude/settings.json:6`
- **Scenario**: Every `npx nitro-fueled init` run copies this file to the target project, leaving `{{NITRO_CORTEX_PATH}}/dist/index.js` as a literal node argument.
- **Impact**: nitro-cortex MCP server never starts. Auto-pilot always falls back to file-based state. AC1 is unreachable for all users who ran `init`.
- **Evidence**: `"args": ["{{NITRO_CORTEX_PATH}}/dist/index.js"]` — no substitution code exists in `scaffold.ts` (uses `copyFileSync` verbatim) or `init.ts`.
- **Fix**: Remove the `mcpServers` block from `scaffold/.claude/settings.json`. Keep only the `permissions.allow` array. Let `handleNitroCortexConfig` write the real server path into `.mcp.json`, matching the `session-orchestrator` pattern.

### Issue C2: `emit_event` Permission Missing from Scaffold settings.json

- **File**: `apps/cli/scaffold/.claude/settings.json` (permissions.allow array)
- **Scenario**: Build Workers in Supervisor mode call `emit_event` at 5 phase transitions per task. Without the permission entry, the call is blocked.
- **Impact**: The entire event-driven monitoring path degrades to polling mode. The fast 30-second reactive cycle becomes dead code.
- **Evidence**: `orchestration/SKILL.md` lines 377-409 document `emit_event` as a mandatory supervisor-mode call. The permissions list at `settings.json` has 18 entries — `mcp__nitro-cortex__emit_event` is absent.
- **Fix**: Add `"mcp__nitro-cortex__emit_event"` to the `permissions.allow` array.

---

## Serious Issues

### Issue S1: No `release_task` on Spawn Failure (Cortex Path)

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Step 5g
- **Scenario**: `get_next_wave` claims 3 tasks. `spawn_worker` fails for task 2 due to provider error. Task 2 remains claimed in cortex DB for the session lifetime.
- **Impact**: Up to `concurrency_limit` tasks can be silently locked out of processing per session under provider-failure conditions.
- **Fix**: Add to Step 5g, before "Leave task status as-is": "With cortex_available = true: call `release_task(task_id, current_status)`. Log `RELEASE AFTER SPAWN FAILURE — TASK_X`. If `release_task` fails, log warning and continue."

### Issue S2: `cortex_available` Flag Set Twice Before Step 1 Completes Correctly

- **File**: `.claude/skills/auto-pilot/SKILL.md` — "nitro-cortex Availability Check" and Step 2
- **Scenario**: Tool-list check sets `cortex_available = true`. Step 1 runs `get_session()`. Step 2 calls `get_tasks()` and it fails — overrides `cortex_available = false`. Steps 3-7 now run in file-based mode but Step 1 already restored state from DB using the cortex path.
- **Impact**: Mixed state: DB-restored active workers list combined with file-based step logic. Workers restored from `get_session()` may not appear in the file-based state.md, causing them to be treated as fresh tasks.
- **Fix**: Make the `get_tasks()` call the sole initialization point for `cortex_available`. Remove the separate tool-list check or demote it. Document explicitly: "If Step 1 ran on the cortex path but Step 2 fails the override, re-run Step 1 on the fallback path."

### Issue S3: `configureNitroCortex` Missing Portability Warning

- **File**: `apps/cli/src/utils/mcp-configure.ts:89-128`
- **Scenario**: User runs `init` and selects project-level config. `configureMcp` at line 75 emits: "Note: Project-level config uses an absolute path that may not be portable across machines." `configureNitroCortex` has no equivalent warning.
- **Impact**: Teams committing `.mcp.json` with nitro-cortex path will have broken cortex config on every other machine. No warning surfaces during setup.
- **Fix**: Add `if (location === 'project') { console.warn('Note: Project-level config uses an absolute path that may not be portable across machines.'); }` before the `mergeJsonFile` call in `configureNitroCortex`.

---

## Moderate Issues

### Issue M1: `printSummary` Does Not Reflect Actual Cortex Configuration Outcome

- **File**: `apps/cli/src/commands/init.ts:379-403`
- **Scenario**: `configureNitroCortex` returns `false` (configuration failed), but since `opts['skip-cortex']` is `false`, no cortex hint appears in the summary. The user sees "Init complete!" with no indication cortex setup failed.
- **Fix**: Capture the return value of `configureNitroCortex`. Pass `cortexConfigured` to `printSummary` and show a hint when `!cortexConfigured && !opts['skip-cortex']`.

### Issue M2: `handleNitroCortexConfig` "Already Configured" Check Does Not Match Scaffold Behavior

- **File**: `apps/cli/src/commands/init.ts:279-289`
- **Scenario**: The check reads `.mcp.json` only. But the scaffold just copied `settings.json` which also contains `mcpServers.nitro-cortex`. If the user runs `init` twice, the second run reads `.mcp.json` (written by the first run's `handleNitroCortexConfig`) and correctly short-circuits. But if the user ran `init --skip-cortex` first, the scaffold settings.json has the placeholder, and the second run without `--skip-cortex` will not find nitro-cortex in `.mcp.json`, will prompt again, and write a new entry to `.mcp.json` — leaving the placeholder in `settings.json` intact.
- **Fix**: Resolved by fixing C1 (remove mcpServers from scaffold settings.json). The already-configured check against `.mcp.json` becomes the only config file.

### Issue M3: Step Numbering Inconsistency in init.ts (Step 10 Used Twice)

- **File**: `apps/cli/src/commands/init.ts:538-542`
- **Scenario**: The `init.ts` run method has comments "Step 10: MCP configuration" and "Step 10b: nitro-cortex configuration". This continues the anti-pattern documented in review-general.md ("Step numbering in command docs must be flat and sequential"). The cortex step should be "Step 11" with subsequent steps renumbered.
- **Impact**: Low — comment only, no logic impact. But the review-general.md rule exists precisely because sub-lettered steps signal a drift pattern.
- **Fix**: Renumber inline comments: Step 10b → Step 11, Step 11 → Step 12, Step 12 → Step 13.

---

## Data Flow Analysis

```
User: npx nitro-fueled init --cortex-path /path/to/cortex

init.ts run()
  |
  |-- Step 4: scaffoldFiles()
  |     |-- copyDirRecursive: copies scaffold/.claude/settings.json verbatim
  |     |   ISSUE C1: {{NITRO_CORTEX_PATH}} placeholder lands in target project
  |     |-- permissions.allow: 18 entries copied
  |     |   ISSUE C2: emit_event missing
  |
  |-- Step 10: handleMcpConfig() -> configureMcp() -> mergeJsonFile(.mcp.json)
  |     OK: session-orchestrator goes to .mcp.json with real path
  |
  |-- Step 10b: handleNitroCortexConfig()
  |     |-- Reads .mcp.json looking for 'nitro-cortex' key
  |     |   NOT FOUND (this is first run)
  |     |-- Prompts for path
  |     |-- configureNitroCortex() -> mergeJsonFile(.mcp.json)
  |     |   OK: nitro-cortex goes to .mcp.json with real path
  |     |   ISSUE S3: no portability warning for project-level
  |     |-- returns true/false
  |         ISSUE M1: return value not tracked by caller
  |
  |-- Step 12: printSummary(mcpAfter.found, skip-mcp, skip-cortex)
  |     ISSUE M1: no cortex-configured status passed in
  |
  Result: .mcp.json has BOTH servers correctly configured
          BUT .claude/settings.json has mcpServers.nitro-cortex with placeholder path
          Claude Code: which file wins? Race condition on config resolution.

Gap Points:
  1. Placeholder in settings.json may shadow the real .mcp.json entry
  2. emit_event never granted permission — reactive monitoring breaks silently
  3. Spawn-failure path in auto-pilot does not release cortex claims
```

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Auto-pilot core loop makes zero direct registry.md or status file reads | PARTIAL | The code path exists but is unreachable for users running `init` due to C1 (placeholder path breaks MCP server startup) |
| `get_next_wave()` replaces Steps 2-4 of the supervisor loop | COMPLETE | Logic correctly implemented in cortex_available path |
| Step 3d removed from SKILL.md | COMPLETE | Replaced with `claim_task()` atomicity note and fallback fallback path preserved |
| Supervisor state survives compaction via `get_session()` | COMPLETE | Step 1 preferred path correctly documented |
| Build Workers write status transitions via `update_task()` not file writes | PARTIAL | The `update_task` calls are documented as companions to file writes, not replacements. The skill says "after writing the status file... if the nitro-cortex `update_task` tool is available: Call `update_task(...)`". The file write still happens first. AC says "not file writes" but the implementation retains both. This is safer but does not match the AC wording. |
| CLI `init` configures nitro-cortex in the generated `.claude/settings.json` | PARTIAL | The scaffold settings.json contains a placeholder — not a working configuration. The actual working config goes to `.mcp.json` (not settings.json). |
| End-to-end auto-pilot session runs cleanly using nitro-cortex tools | NOT TESTABLE | Blocked by C1 and C2 — placeholder path prevents server from starting; missing emit_event permission breaks reactive monitoring. |

### Implicit Requirements NOT Addressed:

1. The scaffold `settings.json` being a Claude Code settings file (not an MCP config file) means it affects permissions for all Claude Code sessions in the project. Mixing MCP server config (which belongs in `.mcp.json`) with permissions (which belongs in `settings.json`) inside a single scaffold file creates a configuration format mismatch. Claude Code may not honor the `mcpServers` key in `settings.json` at all — this key is for `.mcp.json`. The permissions block is correct for `settings.json` but the `mcpServers` block may be silently ignored.

2. No documentation or hint about the `sync_tasks_from_files()` bootstrap call. The skill documents this at the "nitro-cortex Availability Check" section: "On first run against a new project, call `sync_tasks_from_files()` once." No `init` step prompts or performs this call. Users must discover it themselves.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| cortex available but `get_tasks()` fails on first call | YES | Step 2 overrides cortex_available = false | CONCERN: Step 1 may have already run on cortex path (S2) |
| `get_next_wave` returns fewer tasks than slots | YES | Only claimed tasks are spawned | OK |
| `spawn_worker` fails after `get_next_wave` claims tasks | NO | No `release_task` in 5g | CONCERN: task locked for session lifetime (S1) |
| settings.json has placeholder path | NO | Placeholder copied verbatim, never checked | CRITICAL (C1) |
| `configureNitroCortex` fails silently | PARTIAL | Error logged but not surfaced in summary | CONCERN (M1) |
| emit_event called without permission | NO | Permission not in allow list | CRITICAL (C2) |
| User skips cortex but scaffold settings.json already has placeholder | NO | No cleanup of placeholder | CONCERN (M2 / C1) |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| scaffold settings.json → Claude Code MCP server | HIGH | nitro-cortex never starts for any new install | Fix C1 |
| emit_event → Supervisor event queue | HIGH | Reactive monitoring silently degrades to polling | Fix C2 |
| get_next_wave claim → spawn_worker failure | MED | Tasks locked for session lifetime | Fix S1 |
| cortex_available flag → Step 1 cortex path | LOW-MED | Mixed state after Step 2 override | Fix S2 |
| configureNitroCortex project-level → team portability | MED | Broken cortex on other machines, no warning | Fix S3 |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Every `npx nitro-fueled init` produces a broken nitro-cortex configuration (placeholder path in settings.json). The cortex integration is effectively dead on arrival for all new project installs. Additionally, the `emit_event` permission gap means reactive monitoring silently falls back to polling even when cortex is properly configured through other means.

## What Robust Implementation Would Include

- `scaffold/.claude/settings.json` contains ONLY the `permissions.allow` block (no `mcpServers` key). The MCP server entries go to `.mcp.json` via `handleNitroCortexConfig`.
- `emit_event` added to the permissions allow list (19 tools total).
- `configureNitroCortex` emits the same portability warning as `configureMcp` for project-level configs.
- `init.ts` tracks `configureNitroCortex`'s return value and passes it to `printSummary`.
- `init.ts` prompts or at least documents the `sync_tasks_from_files()` bootstrap call needed on first run.
- `auto-pilot/SKILL.md` Step 5g explicitly calls `release_task` on spawn failure when cortex is available.
- `auto-pilot/SKILL.md` resolves `cortex_available` in one place before Step 1 runs — not overridable mid-session by Step 2's call result.

---

## Findings Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | C1, C2 |
| Serious | 3 | S1, S2, S3 |
| Moderate | 3 | M1, M2, M3 |
