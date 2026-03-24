# Code Style Review - TASK_2026_002

## Review Summary

| Metric          | Value          |
| --------------- | -------------- |
| Overall Score   | 7/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 1              |
| Serious Issues  | 4              |
| Minor Issues    | 6              |
| Files Reviewed  | 3              |

## The 5 Critical Questions

### 1. What could break in 6 months?

The stuck threshold configuration creates a false promise. The SKILL.md exposes `--stuck Nm` as a configurable parameter with a default of 5 minutes (SKILL.md:55), but the MCP session-orchestrator's health detection is hardcoded to `last_action_age_seconds > 120` (120 seconds = 2 minutes) in `docs/mcp-session-orchestrator-design.md:310`. The auto-pilot skill never passes its stuck threshold to any MCP call -- `get_worker_stats` has no threshold parameter. So the `--stuck` flag is dead configuration: changing it does nothing because the server-side detection is fixed. In 6 months, someone will change `--stuck 15m` wondering why workers keep getting killed at 2 minutes.

Additionally, the SKILL.md's two-strike stuck detection (SKILL.md:198-213) interacts with the monitoring interval, not the stuck threshold. A worker is killed after being `stuck` for 2 consecutive monitoring checks. If the monitoring interval is 10 minutes (default), a worker must be stuck for 20 minutes to be killed -- far exceeding both the 5-minute threshold and the 2-minute server-side detection. The interplay between these three time values (server-side 120s, configurable threshold 5m, monitoring interval 10m) is never explained, and the "stuck threshold" parameter is not referenced in the Core Loop steps at all.

### 2. What would confuse a new team member?

The relationship between the auto-pilot SKILL.md and the auto-pilot command is split in a way that hides important behavior. The command defines `--dry-run` mode, single-task mode, and the pre-flight checks (auto-pilot.md:74-110), but the SKILL.md's Core Loop (Steps 1-8) has no awareness of these modes. A new developer reading SKILL.md would not know that single-task mode exists or that the loop can be short-circuited. The command says "Enter the full auto-pilot loop from SKILL.md (Steps 1-8)" for all-tasks mode (auto-pilot.md:110), but for single-task mode it says "Spawn one worker... Monitor until that worker completes... Handle completion. STOP." (auto-pilot.md:101-106). That single-task logic is defined only in the command, not the skill. This splits the behavioral specification across two files with no cross-reference from the skill back to the command.

### 3. What's the hidden complexity cost?

The `orchestrator-state.md` format (SKILL.md:266-323) duplicates information that exists in the registry. The Active Workers table tracks Task IDs and statuses; the Retry Tracker tracks task retry counts; the Task Queue shows unblocked tasks. All of this is derivable from `registry.md` + MCP `list_workers`. The justification is compaction survival, which is valid, but this creates a dual-source-of-truth problem: if the registry and the state file disagree after a crash, which wins? The SKILL.md says "Registry is the source of truth for task status" (SKILL.md:409), but then Step 1 restores state from `orchestrator-state.md` including active worker data that may be stale. The reconciliation logic in Step 1 (SKILL.md:67-83) handles MCP discrepancies but never reconciles state file vs. registry discrepancies.

### 4. What pattern inconsistencies exist?

**Command heading structure**: The `auto-pilot.md` command uses `### Parameters` as a subsection under `## Usage` (auto-pilot.md:17), which is a pattern not used by `orchestrate.md` or `create-task.md`. The `create-task.md` does not have a Parameters table at all -- it explains parameters inline in steps. The `orchestrate.md` has no parameters section. This is a new pattern introduced without precedent.

**SKILL.md frontmatter description style**: The orchestration SKILL.md frontmatter description (orchestration/SKILL.md:3-9) lists use cases inline with numbered items. The auto-pilot SKILL.md frontmatter (auto-pilot/SKILL.md:3-9) uses a different style: a single sentence followed by "Use when:" with comma-separated scenarios. Both work, but the formatting is inconsistent.

**Step terminology in commands**: The `project-status.md` command uses "Phase 1, Phase 2..." for its execution stages. The `create-task.md` and `auto-pilot.md` use "Step 1, Step 2...". The inconsistency across commands is pre-existing (inherited from TASK_001), but this task perpetuates it without resolving it.

### 5. What would I do differently?

1. Remove the `--stuck Nm` parameter entirely from both the SKILL.md Configuration table and the command. The stuck detection is server-side (MCP `get_worker_stats` returns health state). The auto-pilot's control is the two-strike mechanism combined with the monitoring interval, not a separate threshold. Exposing a parameter that does nothing is worse than not having it.

2. Add a "Modes" section to the SKILL.md that documents single-task mode and dry-run mode, with a note that these are handled by the command entry point. This way the skill is self-contained documentation of all auto-pilot behavior, not just the all-tasks loop.

3. Add an explicit reconciliation step for state vs. registry disagreements in Step 1: "If orchestrator-state.md shows a task as active but registry shows COMPLETE, trust the registry and remove the worker from active state."

4. The command's pre-flight MCP check (auto-pilot.md:47-51) calls `list_workers(status_filter: 'all')`. This is a reasonable connectivity test, but the parameter name uses a colon syntax (`status_filter: 'all'`) that looks like a function call, not a markdown description. Other references to MCP parameters in the skill use plain text. Pick one style.

---

## Blocking Issues

### Issue 1: `--stuck` parameter is dead configuration

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:55`
- **Also**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:74,283`
- **Problem**: The Configuration table exposes `--stuck Nm` with a default of 5 minutes as a configurable "inactivity duration before worker considered stuck." However, stuck detection happens inside the MCP server via `get_worker_stats`, which returns a `health` field. The server uses a hardcoded 120-second threshold (`docs/mcp-session-orchestrator-design.md:310`). The auto-pilot's Core Loop never uses the stuck threshold value -- Step 6 simply reads the health state returned by the MCP tools. The `--stuck` parameter is configured, stored in `orchestrator-state.md`, but never consumed by any logic.
- **Impact**: Users will configure this parameter expecting it to change behavior, but it will have no effect. This is a phantom configuration that erodes trust in the system's configurability. When the real stuck detection fires at 120 seconds instead of the configured 5 minutes, debugging will be confusing.
- **Fix**: Either (a) remove `--stuck` from Configuration, the command Parameters table, and `orchestrator-state.md` format since stuck detection is server-side, OR (b) if the intent is for auto-pilot to implement its own stuck detection independent of the MCP health state, document that explicitly in Step 6 with logic like "IF time_since_last_activity > stuck_threshold THEN consider stuck." Currently neither approach is implemented -- it is just a dangling parameter.

---

## Serious Issues

### Issue 1: Missing `--stuck` parameter in command but present in skill

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/auto-pilot.md:18-24`
- **Problem**: The SKILL.md Configuration table defines `--stuck Nm` (SKILL.md:55) but the command's Parameters table (auto-pilot.md:18-24) does not include it. The command lists `[TASK_ID]`, `--dry-run`, `--concurrency`, `--interval`, and `--retries` -- but omits `--stuck`. The Step 2 argument parsing (auto-pilot.md:35-41) also does not mention `--stuck`.
- **Tradeoff**: If `--stuck` is kept in the skill (pending resolution of the blocking issue), it must also appear in the command. If removed from the skill, this becomes moot. Either way, the current state is an inconsistency between the command and skill parameter sets.
- **Recommendation**: Synchronize the parameter lists. Whatever the skill's Configuration table defines as overridable, the command must accept and parse.

### Issue 2: Single-task mode behavior not defined in SKILL.md

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` (entire file)
- **Problem**: The command defines single-task mode (auto-pilot.md:101-106): "Spawn one worker for the specified task. Monitor until that worker completes. Handle completion. STOP." But the SKILL.md never mentions single-task mode. Its Core Loop (Steps 1-8) is written for all-tasks mode only. A reader of SKILL.md alone would not know that the auto-pilot can operate on a single task. The command references "the full auto-pilot loop from SKILL.md (Steps 1-8)" only for all-tasks mode, meaning single-task mode uses a different, undocumented behavioral path.
- **Tradeoff**: The command is meant to be the entry point, so putting mode logic there is defensible. But the SKILL.md is described as containing "the full loop logic" (auto-pilot.md:30-31). If single-task mode bypasses most of the SKILL.md logic, the skill is not actually the complete behavioral specification.
- **Recommendation**: Add a brief "Modes" section to SKILL.md (after Quick Start) that lists all three modes and notes that single-task and dry-run are command-level behaviors that use subsets of the Core Loop.

### Issue 3: No reconciliation of state file vs. registry disagreements

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:67-83`
- **Problem**: Step 1 (Recovery Check) reconciles `orchestrator-state.md` against the MCP worker list, but never against `registry.md`. Consider: a crash occurs after a worker completes and the registry is updated to COMPLETE, but before `orchestrator-state.md` is updated. On recovery, the state file still shows that task as having an active worker. Step 1 will try to validate that worker via `list_workers`, find it missing, and trigger the completion handler (Step 7) -- which will try to set the registry to COMPLETE again (already COMPLETE) and will look for `completion-report.md`. This is likely benign (idempotent), but it is undocumented behavior. The reverse case is worse: if `orchestrator-state.md` was written but the registry update failed, the state says the task is complete but the registry says IN_PROGRESS. Step 2 will pick it up as an active task and may try to spawn a duplicate worker.
- **Tradeoff**: Adding a full state-vs-registry reconciliation step adds complexity to an already complex Step 1. But without it, crash recovery has undocumented edge cases.
- **Recommendation**: Add a note in Step 1 after MCP reconciliation: "After MCP reconciliation, cross-check active tasks in state against registry.md. If registry shows COMPLETE for a task listed as active in state, remove it from active workers (already finished). If registry shows CREATED for a task listed as completed in state, trust the state and update registry to COMPLETE."

### Issue 4: `completion-report.md` not in task-tracking.md folder structure

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/task-tracking.md:26-48`
- **Problem**: The auto-pilot SKILL.md relies heavily on `completion-report.md` as the completion signal (SKILL.md:223-254). The orchestration SKILL.md documents writing it (orchestration/SKILL.md:261). But the canonical task-tracking reference (`task-tracking.md:26-48`) does not list `completion-report.md` in the folder structure or the Document Ownership table (task-tracking.md:143-153). This means the auto-pilot depends on a file that is not part of the canonical folder structure definition. A developer reading task-tracking.md to understand the system would not know this file exists or matters.
- **Tradeoff**: The orchestration SKILL.md defines it in its Completion Phase, so it is documented somewhere. But the canonical reference for folder structure omits it.
- **Recommendation**: This is technically a pre-existing gap (created in TASK_001 era), not introduced by this task. However, since auto-pilot makes `completion-report.md` a critical integration point, the task-tracking.md reference should be updated to include it in the folder structure and Document Ownership table. Flag this as a follow-up.

---

## Minor Issues

1. **`auto-pilot.md:17` -- `### Parameters` nesting under `## Usage`**: No other command nests a `###` subsection under `## Usage`. The `create-task.md` and `orchestrate.md` keep `## Usage` as a standalone section with just the code block. Consider promoting to `## Parameters` for consistency, or folding into the usage block as the other commands do.

2. **`SKILL.md:18-22` -- Quick Start code block has no language tag**: The orchestration SKILL.md Quick Start also omits a language tag (orchestration/SKILL.md:18-21), so this is consistent. But both should arguably use ` ```bash ` or ` ```text ` for proper syntax highlighting. Not a new issue, but perpetuated.

3. **`SKILL.md:124-126` -- Code block in Step 4 has no language tag**: The `slots = concurrency_limit - count(...)` pseudo-code block at line 124 has no language tag. Similar blocks in the orchestration SKILL.md use `typescript` tags (orchestration/SKILL.md:138-149). Should use a consistent language tag or `text` for pseudo-code.

4. **`SKILL.md:339-354` -- MCP Tool Signatures use no language tag**: The tool signatures block has no language tag. The design doc uses `typescript` for the same signatures. Should match.

5. **`auto-pilot.md:48` -- Colon syntax for MCP parameter**: Line 48 uses `list_workers (status_filter: 'all')` which looks like a function call. Other MCP references in the command (line 115) just list tool names without parameters. The SKILL.md uses backtick-wrapped tool names with parenthetical parameters in some places (SKILL.md:184) but plain names in others (SKILL.md:329-335). Pick one style.

6. **`CLAUDE.md:37` -- Current State section still says "Need to build auto-pilot skill"**: Line 37 reads "Need to build auto-pilot skill" but is NOT struck through, while the Development Priority item 3 (line 42) IS struck through. The Current State section and Development Priority section disagree about whether auto-pilot is done. Either update Current State to remove/strikethrough the auto-pilot bullet, or note it differently.

---

## File-by-File Analysis

### .claude/skills/auto-pilot/SKILL.md

**Score**: 7/10
**Issues Found**: 1 blocking, 3 serious, 3 minor

**Analysis**: This is a substantial, well-structured document. The Core Loop (Steps 1-8) is clear, comprehensive, and follows the implementation plan faithfully. The state file format is well-thought-out with atomic overwrite and clear markdown tables. The MCP Tool Usage Reference and Signatures section is a good addition that consolidates tool information. The Error Handling section covers the major failure modes. The Key Principles section is an effective summary.

The document's main weakness is the `--stuck` threshold parameter that has no implementation path, the missing single-task mode documentation, and the incomplete state-vs-registry reconciliation. The overall structure follows the orchestration SKILL.md pattern (frontmatter, role definition, core loop, reference sections, key principles) with appropriate adaptations for the different use case.

**Specific Concerns**:
1. `--stuck Nm` parameter in Configuration table (line 55) is not consumed by any Core Loop step -- dead configuration.
2. No mention of single-task mode or dry-run mode anywhere in the skill.
3. Step 1 reconciles state vs. MCP but not state vs. registry (lines 67-83).
4. The Context Efficiency Rule (lines 358-360) is good practice but repeats information already in Step 6 (lines 183-187). Minor duplication.

---

### .claude/commands/auto-pilot.md

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 2 minor

**Analysis**: Clean, well-organized command file. The hybrid pattern (skill-invoking + parameter handling + pre-flight checks) is well-executed and matches the implementation plan's stated intent. The dry-run output format with dependency graph and execution waves is excellent -- it gives users real visibility into what would happen. The pre-flight checks (registry exists, MCP reachable, task ID valid) are practical and cover the main failure modes.

The command is the right length (127 lines) for its complexity. The References section at the bottom provides good cross-referencing to related files.

**Specific Concerns**:
1. Missing `--stuck` parameter that exists in SKILL.md Configuration (line 55 of SKILL.md) -- parameter sets are out of sync.
2. `### Parameters` nesting under `## Usage` (line 17) -- novel heading structure not used by other commands.
3. Pre-flight MCP check uses function-call-like syntax `list_workers (status_filter: 'all')` (line 48) -- inconsistent with how MCP tools are referenced elsewhere.

---

### CLAUDE.md

**Score**: 6/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The Development Priority update correctly strikes through item 3 ("Build auto-pilot skill/command") with "DONE" suffix, matching the pattern established by items 1 and 2. The Project Structure section correctly includes `auto-pilot` in the skills description and `/auto-pilot` in the commands description. The Key Docs section is unchanged and still accurate.

However, the Current State section (lines 34-37) was NOT updated to reflect that the auto-pilot skill is now built. It still reads "Need to build auto-pilot skill" without strikethrough. This contradicts the Development Priority section where item 3 is marked DONE. A reader looking at Current State would think auto-pilot is still pending.

**Specific Concerns**:
1. Current State (line 37) says "Need to build auto-pilot skill" but Development Priority (line 42) marks it DONE -- internal contradiction.

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------- |
| YAML frontmatter               | PASS   | Matches orchestration SKILL.md pattern (name + description)                                 |
| Skill structure                | PASS   | Role definition, core loop, references, key principles -- all present                       |
| Command structure              | PASS   | Usage, execution steps, quick reference, references -- all present                          |
| Status values                  | PASS   | Uses CREATED, IN_PROGRESS, COMPLETE, BLOCKED -- all defined in task-tracking.md             |
| Task ID format                 | PASS   | TASK_YYYY_NNN used consistently throughout                                                   |
| MCP tool names                 | PASS   | spawn_worker, list_workers, get_worker_activity, get_worker_stats, kill_worker -- all match  |
| MCP tool parameters            | PASS   | Parameter names match design doc signatures                                                  |
| Priority enum                  | PASS   | P0-Critical, P1-High, P2-Medium, P3-Low used correctly                                      |
| Parameter set consistency      | FAIL   | SKILL.md defines --stuck; command omits it                                                   |
| Configuration honesty          | FAIL   | --stuck parameter is not consumed by any logic; server-side detection is hardcoded           |
| Cross-file mode documentation  | FAIL   | Single-task and dry-run modes exist only in command, not referenced in skill                  |
| CLAUDE.md internal consistency | FAIL   | Current State contradicts Development Priority on auto-pilot completion status                |

## Technical Debt Assessment

**Introduced**:
- Dead `--stuck` configuration parameter that will confuse future users when it has no effect.
- Split behavioral specification: single-task mode logic lives only in the command, not the skill. If someone refactors the command, they must know the skill is incomplete without it.
- `completion-report.md` is now a critical cross-system integration point but remains absent from the canonical folder structure reference (pre-existing, but amplified by this task's reliance on it).

**Mitigated**:
- The auto-pilot skill provides the first comprehensive specification for autonomous task processing, filling a major gap in the system.
- The `orchestrator-state.md` format is well-designed for compaction survival with atomic writes and standard markdown.
- The two-strike stuck detection is a sensible balance between premature kills and truly stuck workers.
- The Context Efficiency Rule (preferring `get_worker_activity` over `get_worker_stats`) is a smart optimization that was missing from the design doc.

**Net Impact**: Net positive. The skill and command are substantial additions that enable the core autonomous loop. The debt items are real but addressable without major rework.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The `--stuck` parameter is exposed as configurable but is never consumed by any logic -- it is dead configuration that will mislead users. This must either be removed or given a real implementation in the Core Loop.

## What Excellence Would Look Like

A 10/10 implementation would include:

1. **No phantom configuration**: Every parameter in the Configuration table has a corresponding reference in the Core Loop steps where it is used, with clear logic showing how the value affects behavior. If stuck detection is server-side, do not expose a client-side threshold.
2. **Complete behavioral specification in the skill**: All three modes (all-tasks, single-task, dry-run) are documented in SKILL.md, even if briefly. The command is purely argument parsing and pre-flight -- the skill is the complete behavioral reference.
3. **Explicit state-vs-registry reconciliation**: Step 1 handles not just state-vs-MCP discrepancies but also state-vs-registry discrepancies with clear resolution rules.
4. **Consistent formatting**: All code blocks have language tags. All MCP tool references use the same syntax style. Parameter tables in command and skill are synchronized.
5. **CLAUDE.md fully consistent**: Both Current State and Development Priority agree on what is done and what is pending.
6. **`completion-report.md` in canonical reference**: The task-tracking.md folder structure and Document Ownership table include this critical file, closing the pre-existing documentation gap that auto-pilot now depends on.
