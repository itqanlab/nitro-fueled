# Code Logic Review — TASK_2026_057

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 6/10                                 |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 3                                    |
| Serious Issues      | 4                                    |
| Moderate Issues     | 5                                    |
| Failure Modes Found | 6                                    |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `auto-pilot/index.md` page states the monitoring interval default is **10 minutes**. The actual SKILL.md defines it as **5 minutes**. A user who reads the docs and tunes their workflow around 10-minute cycles will be confused when the Supervisor wakes up twice as often. Configuration that contradicts the real default silently undermines user expectations without any error.

The docs tell users that configuration is stored in `task-tracking/orchestrator-state.md` (a single flat file). The actual implementation uses a per-session directory structure: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM-SS}/state.md`. A user editing `orchestrator-state.md` before starting a session would be editing a file the Supervisor does not read — their configuration changes would be silently ignored.

### 2. What user action causes unexpected behavior?

A user reading `concepts/supervisor.md` who tries to override the monitoring interval by editing `task-tracking/orchestrator-state.md` gets no error and no effect — the Supervisor ignores this file. The user thinks they configured a longer interval; the Supervisor still wakes every 5 minutes.

A user reading `concepts/workers.md` who expects only two worker types (Build and Review) will be confused when their session log shows entries for `Fix Worker`, `Cleanup Worker`, and `Completion Worker` — three additional worker types the docs never mention.

### 3. What data makes this produce wrong results?

The task spec specifies documenting 16 agents. The docs correctly document 22. However, the task spec was written with an outdated agent count — this is a spec issue, not a doc issue, but it would cause the acceptance criteria check ("All 16 agents documented") to be ambiguous.

The `concepts/tasks.md` BUGFIX pipeline entry omits the optional Research phase: the design doc says `[Research] → Team-Leader → QA`. A user who has a BUGFIX task that triggers the Researcher agent will not understand why that agent ran.

### 4. What happens when dependencies fail?

The docs describe pre-flight as checking 5 conditions. The actual SKILL.md defines 6+ items: it additionally checks for a writable `task-tracking/` directory (listed in `auto-pilot/index.md` but missing from `concepts/supervisor.md`) and runs a Stale Session Archive Check before MCP validation. A user relying on `concepts/supervisor.md`'s pre-flight list to diagnose why a session won't start has an incomplete picture.

### 5. What's missing that the requirements didn't mention?

The actual Supervisor has a **Concurrent Session Guard** (aborts if another auto-pilot is running unless `--force` is passed). No documentation page mentions this. A user running two `/auto-pilot` sessions simultaneously will get an unexpected abort with no explanation from the docs.

The `auto-pilot` skill supports four invocation modes (`/auto-pilot`, `/auto-pilot --limit N`, `/auto-pilot TASK_YYYY_NNN`, `/auto-pilot --dry-run`). The docs only describe two (the full loop and single-task via `/run`). The `--limit` and `--dry-run` flags are undocumented.

---

## Failure Mode Analysis

### Failure Mode 1: Silent Configuration Miss

- **Trigger**: User edits `task-tracking/orchestrator-state.md` to set `monitoring_interval_minutes: 10` before starting Auto-Pilot
- **Symptoms**: Supervisor reads session-scoped `state.md` under `task-tracking/sessions/SESSION_.../`, ignores user's edit. Monitoring happens at the default 5-minute interval with no warning.
- **Impact**: User thinks they configured the system; configuration is silently discarded
- **Current Handling**: The docs actively direct users to edit `orchestrator-state.md` ("Edit this file before starting a session to override defaults" — `auto-pilot/index.md` line 26)
- **Recommendation**: Correct the configuration location to reflect the actual session directory structure, or document the `--interval` flag

### Failure Mode 2: Health State Enumeration Mismatch

- **Trigger**: User reads worker health states from `concepts/workers.md`; Supervisor logs or session reports show state `compacting`
- **Symptoms**: `compacting` is a real health state in the MCP design doc and referenced in the SKILL.md log format. Neither `concepts/workers.md` nor `auto-pilot/index.md` lists it. User cannot find it in the docs.
- **Impact**: User cannot interpret session logs; "compacting" appears to be an undocumented bug
- **Current Handling**: Not handled — health state table is incomplete in both workers and auto-pilot pages
- **Recommendation**: Add `compacting` to both health state tables with explanation

### Failure Mode 3: Worker Type Incompleteness

- **Trigger**: User reads `concepts/workers.md` which documents exactly two worker types (Build Worker, Review Worker). User then reads session logs showing `Fix Worker`, `Cleanup Worker`, and `Completion Worker` entries.
- **Symptoms**: User is confused; three worker types are undocumented
- **Impact**: User cannot understand what their session did; no reference to consult
- **Current Handling**: None — only Build and Review Workers are documented
- **Recommendation**: Add Fix Worker, Cleanup Worker, and Completion Worker to the worker types table with their triggers and exit states

### Failure Mode 4: Concurrent Session Abort with No Doc Reference

- **Trigger**: User runs `/auto-pilot` twice in the same project (e.g., opened Claude Code in two windows)
- **Symptoms**: Second session aborts with "WARNING: Another supervisor session may still be running". User searches docs for explanation — finds nothing
- **Impact**: User thinks something is broken; may not realize the `--force` flag exists
- **Current Handling**: Not documented anywhere
- **Recommendation**: Add Concurrent Session Guard to `auto-pilot/index.md` under a new "Safety" section

### Failure Mode 5: Monitoring Interval Discrepancy

- **Trigger**: User reads "default: 10 min" in multiple doc pages, tunes expectations accordingly
- **Symptoms**: Supervisor wakes twice as often as expected (every 5 min). Session cost is higher than predicted based on docs.
- **Impact**: Cost surprise; user loses trust in documentation accuracy
- **Current Handling**: All doc pages consistently state 10-minute default; SKILL.md states 5-minute default
- **Recommendation**: Correct `concepts/supervisor.md` line 103 and `auto-pilot/index.md` lines 31-32 to say "5 min" default

### Failure Mode 6: orchestrator-state.md Wrong Location

- **Trigger**: User follows "Configuration is stored in `task-tracking/orchestrator-state.md`" (`concepts/supervisor.md` line 104-105) to inspect or set config
- **Symptoms**: No such file at that path at session start; actual state lives in per-session directory. User cannot find the file or edits the wrong file.
- **Impact**: User cannot inspect live state; config edits are ignored
- **Current Handling**: Multiple pages consistently reference wrong path
- **Recommendation**: Correct path to `task-tracking/sessions/SESSION_.../state.md` and explain session directory lifecycle

---

## Critical Issues

### Issue 1: Monitoring Interval Default is Wrong — 10 min vs 5 min

- **Files**: `packages/docs/src/content/docs/concepts/supervisor.md:103`, `packages/docs/src/content/docs/auto-pilot/index.md:31`
- **Scenario**: User reads the docs to understand how frequently the Supervisor wakes
- **Impact**: User gets the wrong number. The actual SKILL.md (`/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` line 60) states "Monitoring interval: 5 minutes". This is a direct factual error in two separate pages.
- **Evidence**:
  - `supervisor.md` table row: `| Monitoring interval | 10 min | — | Time between health checks |`
  - `auto-pilot/index.md` table row: `| monitoring_interval_minutes | 10 | — | Time between health checks per worker |`
  - SKILL.md: `| Monitoring interval | 5 minutes   | --interval Nm    | Time between health checks |`
- **Fix**: Change both doc pages to `5 min` / `5` in the default column

---

### Issue 2: orchestrator-state.md Path Is Factually Wrong

- **Files**: `packages/docs/src/content/docs/concepts/supervisor.md:104-119`, `packages/docs/src/content/docs/auto-pilot/index.md:26,113-144`
- **Scenario**: User wants to inspect Supervisor state, tune configuration, or understand recovery
- **Impact**: The docs say configuration and state live in `task-tracking/orchestrator-state.md` (a flat file). The actual implementation writes state to a per-session directory: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM-SS}/state.md`. The docs actively instruct users to "edit this file before starting a session to override defaults" — they would be editing a file that does not exist at that path.
- **Evidence**:
  - `auto-pilot/index.md` line 26: "Auto-Pilot configuration lives in `task-tracking/orchestrator-state.md`. Edit this file before starting a session..."
  - SKILL.md line 190: "Directory path: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM-SS}/`"
  - SKILL.md line 213: "state.md — Live supervisor state"
- **Fix**: Update both pages. Describe the session directory structure. Change configuration override to use CLI flags (`--concurrency`, `--interval`, `--retries`) per SKILL.md, not manual file editing.

---

### Issue 3: `compacting` Health State Is Missing from All Docs

- **Files**: `packages/docs/src/content/docs/concepts/workers.md:38-44`, `packages/docs/src/content/docs/auto-pilot/index.md:89-94`
- **Scenario**: Worker hits context compaction; session log shows `compacting` health state
- **Impact**: Users cannot find `compacting` in any documentation. The MCP design doc explicitly defines it (`/Volumes/SanDiskSSD/mine/nitro-fueled/docs/mcp-session-orchestrator-design.md` line 307) as a distinct health state returned by `assessHealth()`. SKILL.md log format also shows `HEALTH CHECK — TASK_X: compacting`. Both health-state tables in the docs omit this entry.
- **Evidence**:
  - mcp-session-orchestrator-design.md line 307: `if (stats.tokens.compaction_count >= 2) return 'compacting';`
  - SKILL.md line 106: `| Worker compacting | ... auto-pilot | HEALTH CHECK — TASK_X: compacting |`
  - workers.md health table: lists only `healthy`, `high_context`, `stuck`, `finished`
- **Fix**: Add `compacting` row to both health state tables

---

## Serious Issues

### Issue 4: Three Worker Types Are Completely Undocumented

- **Files**: `packages/docs/src/content/docs/concepts/workers.md:14-17`
- **Scenario**: User reads session logs and sees Fix Worker, Cleanup Worker, or Completion Worker entries
- **Impact**: The docs present exactly two worker types. The SKILL.md defines five: Build Worker, Review Worker/ReviewLead, TestLead, Fix Worker, Cleanup Worker, and Completion Worker. Specifically:
  - **Fix Worker** — spawned after a failed review when findings require code changes
  - **Cleanup Worker** — spawned to salvage uncommitted work from a killed Build Worker
  - **Completion Worker** — spawned to write completion-report.md when reviews and tests are clean
- **Evidence**: SKILL.md lines 118-121 show log events for `FIX DONE`, `COMPLETION DONE`, `CLEANUP DONE`. SKILL.md line 163 describes Fix Worker as part of the single-task mode flow.
- **Fix**: Add a "Additional Worker Types" section to `concepts/workers.md` covering Fix Worker, Cleanup Worker, and Completion Worker with their triggers and exit states

---

### Issue 5: BUGFIX Pipeline Omits Optional Research Phase

- **Files**: `packages/docs/src/content/docs/concepts/tasks.md:134`, `packages/docs/src/content/docs/task-format/index.md:29`
- **Scenario**: User writes a BUGFIX task that requires investigation. Researcher agent runs.
- **Impact**: Both docs and the design doc's task template show `BUGFIX: Team-Leader → Developer → Review Lead + Test Lead`. The source of truth design doc (`nitro-fueled-design.md`) and `task-template-guide.md` both list BUGFIX as `[Research] → Team-Leader → QA` — the Research step is optional but real. The docs present it as non-existent.
- **Evidence**: `docs/task-template-guide.md` line 78: `| BUGFIX | [Research] → Team-Leader → QA |`
- **Fix**: Restore the `[Research]` bracket notation to the BUGFIX row in both tables

---

### Issue 6: Supervisor Loop Steps Are a Simplified Model (Not "9 Steps")

- **Files**: `packages/docs/src/content/docs/concepts/supervisor.md:10-56`
- **Scenario**: User tries to understand exactly what the Supervisor does during each cycle
- **Impact**: The actual loop in SKILL.md has: Step 1 (Read State/Recovery), Step 2 (Read Registry), Step 2b (JIT Quality Validation), Step 3 (Dependency Graph), Step 3b (Plan Consultation), Step 3c (File Scope Overlap Detection), Step 4 (Order Queues), Step 5 (Spawn Workers), Step 6 (Monitor Health), Step 7 (Detect Completions), Step 8+ (Update State, Analytics, Session Archive). The "9 steps" in the docs are a condensed version from the design doc, which predates the current implementation. Two sub-steps with real user impact are absent: **3c (File Scope Overlap Detection)** and **3b (Plan Consultation step with ESCALATE handling)**. The page title "9-Step Control Loop" is inaccurate.
- **Fix**: Either update the title to "Supervisor Control Loop" and add File Scope Overlap Detection and Plan Consultation as steps, or add a note that the steps are a conceptual overview

---

### Issue 7: `/auto-pilot` Flags Are Undocumented

- **Files**: `packages/docs/src/content/docs/commands/index.md:125-136`, `packages/docs/src/content/docs/auto-pilot/index.md:13-21`
- **Scenario**: User wants to test with just one or two tasks, or do a dry-run before committing
- **Impact**: SKILL.md documents four invocation modes: no args, `--limit N`, `TASK_YYYY_NNN`, and `--dry-run`. The commands page and auto-pilot guide document only two: no args and (implicitly) single-task via `/run`. The `--limit` flag and `--dry-run` flag are completely absent. These are genuinely useful and a user who would benefit from them has no path to discover them.
- **Evidence**: SKILL.md line 21-24:
  - `/auto-pilot --limit N` — Process N tasks then stop
  - `/auto-pilot --dry-run` — Show plan without spawning
- **Fix**: Add `--limit` and `--dry-run` to both the commands page and the auto-pilot guide

---

## Moderate Issues

### Issue 8: Pre-Flight Check Lists Are Inconsistent Across Pages

- **Files**: `packages/docs/src/content/docs/concepts/supervisor.md:62-70`, `packages/docs/src/content/docs/auto-pilot/index.md:50-59`
- **Scenario**: User diagnoses pre-flight failure
- **Impact**: `concepts/supervisor.md` lists 5 pre-flight checks. `auto-pilot/index.md` lists 6 (adds "task-tracking/ directory is writable"). They should be identical; instead they differ. Neither page mentions the **Stale Session Archive Check** (Step 0 in SKILL.md) that runs before MCP validation — it is silent and non-blocking but a user who sees commit messages from it during startup would be confused.
- **Fix**: Align both pages to the same 6-item list. Add a note about the Stale Session Archive Check.

---

### Issue 9: agents/index.md Documents 22 Agents but Categories Do Not Match Task Spec

- **Files**: `packages/docs/src/content/docs/agents/index.md`
- **Scenario**: Cross-referencing agents by category
- **Impact**: The task spec says "16 agents" and lists them under Planning/Orchestration/Development/QA/Research/Creative. The design doc says 22 agents. The docs correctly document 22 but the category labels in the task spec ("Orchestration: Team Leader" and "Creative: UI/UX Designer, Technical Content Writer") differ from what's in the docs. Minor impact — docs are internally consistent.
- **Fix**: No action needed in the docs themselves; the task spec was outdated. This is noted for completeness.

---

### Issue 10: first-run.md Claims "The Review Worker Is Automatically Spawned"

- **Files**: `packages/docs/src/content/docs/getting-started/first-run.md:131`
- **Scenario**: User runs single-task via `npx nitro-fueled run TASK_2026_001`
- **Impact**: The page states "a Review Worker is automatically spawned" after the Build Worker finishes. This is only true when running via the full Auto-Pilot loop (`npx nitro-fueled run` without a task ID). When running a single task with `npx nitro-fueled run TASK_2026_001`, the Supervisor is not active — no automatic Review Worker spawn will occur. The user would need to run the review separately or start the full loop.
- **Fix**: Clarify that automatic Review Worker spawning requires the full Supervisor loop. For single-task runs, the review phase runs inline within the same session.

---

### Issue 11: Concurrent Session Guard Is Entirely Absent

- **Files**: `packages/docs/src/content/docs/auto-pilot/index.md` (missing section)
- **Scenario**: User opens two Claude Code windows and runs `/auto-pilot` in both
- **Impact**: Second invocation aborts with a warning about a running session. User has no documentation to consult. The `--force` flag to override is also unknown.
- **Fix**: Add a "Running Multiple Sessions" or "Safety Checks" section to `auto-pilot/index.md`

---

### Issue 12: `getting-started/installation.md` References GitHub URL That May Not Exist

- **Files**: `packages/docs/src/content/docs/getting-started/installation.md:100`
- **Scenario**: User clones session-orchestrator
- **Impact**: The page contains `git clone https://github.com/iamb0ody/session-orchestrator`. This repository URL may be private or not exist publicly. If the project is open-sourced, it needs a real URL; if it remains private, the install instructions are broken for all external users.
- **Fix**: Either confirm the URL is correct and public, or replace with a placeholder noting the path to the local/private copy

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| All stub pages replaced with complete content | COMPLETE | No stubs or TODOs found |
| Getting Started section works standalone | COMPLETE | Covers install, first run, prerequisites |
| Task Format covers all fields with examples | COMPLETE | All fields documented, examples for each type |
| Commands covers all 10+ slash commands + CLI | PARTIAL | 11 slash commands documented (missing `/evaluate-agent`, `/create-agent`, `/create-skill`, `/create` — exist in `.claude/commands/` but are optional/tooling commands, not user-facing orchestration commands) |
| All 16 agents documented with role, inputs, outputs | PARTIAL | 22 agents documented (task spec count is outdated), but `nitro-visual-reviewer` lacks inputs/outputs detail; `nitro-modernization-detector` has no invocation path documented |
| Auto-Pilot covers all parameters and recovery | PARTIAL | Configuration location is wrong; `compacting` health state missing; concurrent session guard absent |
| Both examples are complete end-to-end | COMPLETE | Both walkthroughs cover all 5 steps with concrete output |
| All pages build with no Astro/MDX errors | NOT VERIFIED | No build was run as part of this review |
| Cross-links between pages are accurate | COMPLETE | All relative links appear structurally correct |
| No TODO or placeholder content | COMPLETE | No TODOs or placeholders found |

### Implicit Requirements NOT Addressed

1. **Session directory structure** — users need to understand where state, logs, and worker logs actually live (`task-tracking/sessions/`) to be effective operators
2. **CLI flags for configuration** — configuration overrides happen via `--concurrency`, `--interval`, `--retries` flags, not file editing; this is the primary mechanism but is absent from docs
3. **Worker orchestration complexity** — the Review phase involves spawning ReviewLead AND TestLead simultaneously (consuming 2 concurrency slots), then potentially a Fix Worker or Completion Worker; the docs present it as a single "Review Worker"
4. **Dry-run capability** — `--dry-run` is a safe first step for users unsure about their dependency graph; it should be documented in the "Getting Started" flow

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Two auto-pilot sessions running simultaneously | NO | Concurrent Session Guard exists but undocumented | User has no guidance |
| Worker compaction during long task | PARTIAL | Workers page mentions compaction detection | Missing `compacting` health state in table |
| `--dry-run` before first run | NO | Feature exists, not documented | Users may spawn workers unnecessarily |
| Monitoring interval configuration | PARTIAL | Documented with wrong value (10 vs 5 min) | Users configure against wrong default |
| Config location | CRITICAL | Documented as flat file, is actually per-session | Users editing wrong file |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| User editing orchestrator-state.md for config | HIGH | Config silently ignored | Fix documentation to use CLI flags |
| User expecting `compacting` health state | MED | Session log confusion | Add to health state tables |
| User not knowing about Fix/Cleanup Workers | MED | Cannot interpret session artifacts | Document additional worker types |
| GitHub URL for session-orchestrator | UNKNOWN | Installation fails for external users | Verify URL or add note |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The `orchestrator-state.md` configuration location is factually wrong and actively misleads users. Users who follow the documented instructions to set configuration will edit a file the Supervisor does not read. This, combined with the wrong monitoring interval default, means the two most practically important pieces of configuration information in the docs are both incorrect.

---

## What Robust Implementation Would Include

The docs do a genuinely good job on conceptual accuracy and completeness for the happy path. What they are missing:

1. **Session directory explainer** — a short section in `auto-pilot/index.md` showing the `task-tracking/sessions/` structure and what each file contains
2. **CLI flag reference** — a table of `--concurrency`, `--interval`, `--retries`, `--limit`, `--dry-run` flags with defaults
3. **Complete worker type table** — Build, Review (ReviewLead + TestLead), Fix, Cleanup, Completion Workers
4. **Complete health state table** — add `compacting` to both workers and auto-pilot pages
5. **Concurrent Session Guard note** — one paragraph in auto-pilot guide
6. **Correct monitoring interval** — change 10 min to 5 min in all tables
