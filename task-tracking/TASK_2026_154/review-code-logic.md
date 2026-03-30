# Code Logic Review - TASK_2026_154

| Field | Value |
|-------|-------|
| Task | TASK_2026_154 |
| Scope | `.claude/skills/auto-pilot/SKILL.md`, `.claude/skills/auto-pilot/references/parallel-mode.md`, `.claude/skills/auto-pilot/references/session-lifecycle.md`, scaffold mirrors, and task notes |
| Verdict | FAIL |

## Findings

### 1. Scaffold `SKILL.md` was not actually mirrored to the new DB-first contract
**Severity:** High

The task explicitly requires mirroring the shipped `.claude` behavior into `apps/cli/scaffold/...`, but the scaffold skill still documents the legacy file-backed loop in multiple places. This means newly scaffolded projects will ship stale supervisor instructions even though the live skill was updated.

**Examples:**
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:87-94` still says the supervisor "MUST append every significant event" to `log.md`.
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:205-215` still includes startup Step 5 "Read State" for compaction recovery.
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:217-223` still defines `state.md` as live supervisor state with full overwrite behavior.
- `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md:362-370` still defines the core loop as "Read State" and "Read Registry".

This directly misses the task's mirror requirement and leaves the scaffold copy behaviorally inconsistent with the live docs.

### 2. `session-lifecycle.md` still instructs `state.md`-based recovery and repeated `state.md` writes
**Severity:** High

The task intent says the DB-backed supervisor should recover via `list_workers()` + `get_tasks()`, and `state.md` should be demoted from loop memory to a debug artifact. However `session-lifecycle.md` still contains legacy recovery and persistent write guidance.

**Examples:**
- `.claude/skills/auto-pilot/references/session-lifecycle.md:23-24` startup sequence still says "Step 1: Read State" then "Enter Core Loop".
- `.claude/skills/auto-pilot/references/session-lifecycle.md:67-74` still makes final `state.md` write part of normal stop handling.
- `.claude/skills/auto-pilot/references/session-lifecycle.md:186-269` still describes `state.md` as the compaction-parseable recovery format and says it is "fully overwritten on each update".
- `.claude/skills/auto-pilot/references/parallel-mode.md:15` and `:179` also still allow post-startup `state.md` snapshots, which conflicts with the task wording that `state.md` is written once at startup and "never touched again".

This is a logic mismatch with the documented target behavior, not just wording drift.

### 3. `session-lifecycle.md` still claims cross-session exclusion works by reading other sessions' `state.md`
**Severity:** Medium

The concurrent-session guidance still depends on a file-based mechanism that the task is trying to remove from the live loop.

**References:**
- `.claude/skills/auto-pilot/references/session-lifecycle.md:175-180`

It says concurrent sessions are safe because "Step 3d reads each other's `state.md` on every loop cycle and excludes their claimed tasks." That contradicts the new DB-first loop where task claiming and recovery should come from MCP/DB state, not session file reads.

### 4. Live `SKILL.md` still contains contradictory logging/output instructions
**Severity:** Medium

The live skill mostly moves to DB-backed state, but the output-budget section still tells the supervisor that structured data and decisions go to `log.md` / `state.md`, which conflicts with the new contract that loop logging should use MCP tools and file writes are optional rendered artifacts.

**References:**
- `.claude/skills/auto-pilot/SKILL.md:39-49`
- `.claude/skills/auto-pilot/SKILL.md:122-127`

The later section correctly demotes `log.md`/`state.md`, but the earlier hard-rules block can still steer the model back toward file writes.

## Completeness

The live `parallel-mode.md` is substantially closer to the task intent and does remove the major loop-time file reads on the DB-backed path. There are no obvious stubs or placeholders in the scoped files.

## Conclusion

Issues were found. The main blocker is that the scaffold `SKILL.md` still documents the old file-backed loop, and the lifecycle reference still preserves `state.md` recovery/update behavior that the task was meant to retire.
