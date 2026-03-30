# Auto-Pilot -- Supervisor Task Processing

## STOP — HARD RULES (read FIRST, re-read after every compaction)

1. **NO Bash for file reads** — never `cat`, `head`, `for` loops on task files. Use Read tool or MCP.
2. **NO task.md reads during pre-flight** — registry columns only. task.md reads happen JIT at spawn.
3. **NO reference file loads during Steps 1-4** — zero. Load only when entering the Core Loop.
4. **NO hallucinated providers** — only use what `get_available_providers()` returned. Nothing else exists.
5. **NO tables in monitoring loop** — heartbeat is ONE line, then `Bash: sleep 30`, then poll. Nothing else.
6. **NO thinking >10s without a tool call** — if you're not calling a tool, you're stalling. Call sleep.
7. **NO tangents** — don't explore, don't check for "newer tasks", don't investigate. Follow the steps.
8. **NO ending your turn after spawning** — after `spawn_worker`, your next tool call MUST be `Bash: sleep 30`. No text, no tables, no summaries between spawn and sleep. This is the #1 stall cause.
9. **NO wave tables, queue summaries, or notes to conversation** — structured output goes to log/DB only. Conversation = one line per event: `SPAWNED worker=X task=Y`.

---

Start the Supervisor loop. Reads the task backlog, spawns Build Workers
and Review Workers via MCP nitro-cortex, monitors state transitions,
and loops until all tasks are complete or blocked.

## Usage

```
/nitro-auto-pilot                                    # Process all unblocked tasks
/nitro-auto-pilot TASK_YYYY_NNN                      # Process single task only
/nitro-auto-pilot --dry-run                          # Show plan without spawning
/nitro-auto-pilot --concurrency 3 --interval 5m      # Override defaults
/nitro-auto-pilot --force                            # Override stale RUNNING state
/nitro-auto-pilot --pause                            # Run one monitoring cycle then stop cleanly (workers keep running)
/nitro-auto-pilot --continue                         # Resume most recent paused/stopped session
/nitro-auto-pilot --continue SESSION_2026-03-28_14-00-00  # Resume specific session
/nitro-auto-pilot --evaluate claude-opus-4-6          # Evaluate a model against the benchmark suite
/nitro-auto-pilot --evaluate claude-sonnet-4-6 --compare claude-opus-4-6  # A/B comparison
/nitro-auto-pilot --evaluate claude-sonnet-4-6 --compare claude-opus-4-6 --role reviewer  # Test as reviewer
/nitro-auto-pilot --evaluate claude-sonnet-4-6 --compare claude-opus-4-6 --role both      # Test both roles
/nitro-auto-pilot --evaluate claude-opus-4-6 --reviewer claude-sonnet-4-6  # Override reviewer model
/nitro-auto-pilot --sequential                       # Process backlog inline (no MCP workers)
/nitro-auto-pilot --sequential TASK_YYYY_NNN         # Process single task inline
/nitro-auto-pilot --sequential --limit 3             # Process up to 3 tasks inline
```

### Parameters

| Parameter       | Format                       | Default | Description                                              |
|-----------------|------------------------------|---------|----------------------------------------------------------|
| [TASK_ID]       | TASK_YYYY_NNN                | (all)   | Process single task only                                 |
| --dry-run       | flag                         | false   | Show execution plan, no spawn                            |
| --concurrency   | integer                      | 3       | Max simultaneous workers                                 |
| --interval      | Nm                           | 10m     | Monitoring interval                                      |
| --retries       | integer                      | 2       | Max retries per task                                     |
| --force         | flag                         | false   | Override stale RUNNING state                             |
| --pause         | flag                         | false   | Stop cleanly after current monitoring cycle; workers keep running |
| --continue      | flag or SESSION_ID string    | —       | Resume a paused/stopped session (latest if no ID given; invalid format exits immediately) |
| --evaluate      | model-id string              | —       | Enter evaluation mode: run benchmark suite against specified model |
| --compare       | model-id string              | —       | A/B comparison: run same benchmarks for both models (parallel worktrees in builder mode; sequential phases in reviewer/both modes) |
| --role          | builder\|reviewer\|both       | builder | Which role to test the model in. `reviewer` and `both` require `--compare` |
| --reviewer      | model-id string              | —       | Override the reviewer model for evaluation (defaults to baseline or system default) |
| --sequential    | flag                         | false   | Process tasks inline in same session instead of spawning MCP workers. No concurrency, no health checks, no polling overhead. Compatible with [TASK_ID] and --limit N. |

## Execution Steps

### Step 1: Load Skill

Read `.claude/skills/auto-pilot/SKILL.md` -- this contains the full
Supervisor loop logic, worker type determination, state management,
and monitoring protocol.

### Step 2: Parse Arguments

Parse $ARGUMENTS for:
- A task ID (matches `/^TASK_\d{4}_\d{3}$/`) -> single-task mode
- `--dry-run` flag -> dry-run mode
- `--concurrency N` -> override concurrency limit
- `--interval Nm` -> override monitoring interval
- `--retries N` -> override retry limit
- `--force` flag -> override stale RUNNING state from a previous session
- `--pause` flag -> pause after current monitoring cycle (see Pause Mode in SKILL.md)
- `--continue [SESSION_ID]` -> resume mode: if the next whitespace-separated argument does
  not start with `--`, treat it as the SESSION_ID token and validate it against the regex
  `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$` before use. If the token does NOT match,
  **STOP IMMEDIATELY** — do not strip or modify the token. Display:
  `ERROR: Invalid SESSION_ID format. Expected SESSION_YYYY-MM-DD_HH-MM-SS (e.g. SESSION_2026-03-28_14-00-00). Refusing to proceed to prevent path traversal.`
  **EXIT.**
  If the token matches, or no SESSION_ID was provided, use the validated SESSION_ID as the
  target session, or auto-detect the most recent paused/stopped session if no SESSION_ID was
  given (see Continue Mode in SKILL.md). **If `--continue` is present and the SESSION_ID is
  valid, or no SESSION_ID was provided, skip Steps 3 and 4 entirely** and jump directly to
  the Continue Mode sequence in SKILL.md.
- `--evaluate <model-id>` -> evaluation mode: enter single-model evaluation against the
  benchmark suite. The `<model-id>` is required (e.g., `claude-opus-4-6`, `claude-sonnet-4-6`,
  `glm-5`). **If `--evaluate` is present, skip Steps 3, 4, 5, and 6 entirely** and jump
  directly to the Evaluation Mode sequence in SKILL.md.
- `--compare <baseline-model>` -> A/B comparison mode (requires `--evaluate`). Runs same
  benchmarks on both models in separate worktrees. Results stored in
  `evaluations/<date>-<modelA>_vs_<modelB>/`.
- `--role builder|reviewer|both` -> controls which role the model under test plays in
  evaluation. `builder` (default): model builds, baseline reviews. `reviewer`: baseline
  builds, model reviews. `both`: two full passes. Requires `--compare` when `reviewer`
  or `both`.
- `--reviewer <model-id>` -> overrides the model used for Review Workers in evaluation.
  Defaults to `--compare` model if A/B mode, or no review phase if single-model builder.
- `--sequential` flag -> sequential mode (set `sequential_mode = true`). **If `--sequential` is present, skip Step 3c** (MCP validation) entirely — jump to Step 4 after Steps 3a and 3b. All other pre-flight checks still run. **Then skip Steps 5–6** and jump directly to the Sequential Mode sequence in SKILL.md.

### Step 3: Pre-Flight Checks

**3a. Stale Archive Check** (see ## Stale Session Archive Check in `.claude/skills/auto-pilot/SKILL.md`) — Before any other checks, commit any session artifacts left uncommitted by a previous crashed session. Best-effort — never blocks startup.

**3b.** Verify `task-tracking/registry.md` exists.
If missing: ERROR -- "Registry not found. Run /nitro-initialize-workspace first."

**3c.** Verify MCP nitro-cortex is available:
Call MCP `list_workers` (status_filter: 'running', compact: true).
If MCP call fails or the tool does not exist: **STOP IMMEDIATELY.**
Display: "FATAL: MCP nitro-cortex is not configured or not running.
The Supervisor REQUIRES nitro-cortex to spawn separate
worker sessions in their own terminal windows. Without it, tasks cannot
be processed. Do NOT use the Agent tool as a fallback — sub-agents share
context and break the architecture. Configure nitro-cortex in
.mcp.json and restart."
**EXIT. Do not continue to Step 4.**

**3d. Provider Discovery (MANDATORY)**

Before any task validation, discover which providers are actually available using MCP tools:

1. **Call MCP `get_available_providers()`**: Returns each provider's availability status and supported models. This is a single MCP call (~3 lines output) — no config file reads needed.
2. **Call MCP `get_provider_stats()`** (no filters): Returns historical success rates and avg costs per provider/model from all past workers. Use this to identify unreliable providers (e.g., glm-5 with high kill rate) and inform routing defaults.
3. **Build `available_providers` map** from the MCP response: `{ providerName: { available: bool, models: string[] } }`.
4. **Read routing config**: Read `.nitro-fueled/config.json` for the `routing` section only (which tier maps to which provider). If missing, use defaults: all tiers → `claude`.
5. **Validate routing config against available providers**: For each routing slot, check that the configured provider is in `available_providers` and marked available. If not, override to `claude` and log: `"ROUTING OVERRIDE — slot '{slot}' configured for '{provider}' but it's unavailable, falling back to claude"`.
6. **Log discovery results**: For each provider, log one line:
   `| {HH:MM:SS} | auto-pilot | PROVIDER {name}: {available|unavailable} — models=[{list}] |`
   For provider stats (if any history exists), log:
   `| {HH:MM:SS} | auto-pilot | PROVIDER STATS — {provider}/{model}: {success_rate}% success, avg ${cost} |`
7. **If NO providers are available** (not even claude): FATAL error, exit.
8. **Store in session**: Write `## Available Providers` table to `{SESSION_DIR}state.md` so routing decisions survive compaction.

**The `available_providers` map is the ONLY source of truth for spawn decisions.** Any Provider field in task.md that references an unavailable provider is overridden to the fallback chain — never blindly trusted.

**3e.** If single-task mode: verify the task ID exists in the registry
and its status is CREATED or IMPLEMENTED. If status is IN_PROGRESS or
IN_REVIEW, the Supervisor will spawn the appropriate worker type to resume.
If COMPLETE, warn and confirm. If BLOCKED or CANCELLED, error.
- If `--sequential` is active and status is IMPLEMENTED: ERROR — "TASK_X is IMPLEMENTED. Sequential mode requires CREATED status. Use /auto-pilot TASK_X (without --sequential) to run a Review Worker."

### Step 4: Pre-Flight Task Validation

> **Isolation contract**: This step runs entirely in the command entry point, NOT inside the Supervisor context. The Supervisor only receives a "proceed" or "abort" signal — it never executes pre-flight logic.

> **Strict mode deferred**: A `--strict` flag (treat all warnings as blocking) is not yet implemented. All warnings currently allow the run to proceed.

**4a. Preparation**

1. **Parallel initial reads**: In a single round, read ALL of the following simultaneously:
   - `task-tracking/registry.md` (or reuse if already read from Step 3)
   - `task-tracking/active-sessions.md` (for stale session cleanup and Concurrent Session Guard — reuse in session startup Step 5)
   - `task-tracking/sizing-rules.md` (for Validation D — if missing, use inline fallbacks)
   All three reads are independent and MUST be issued in parallel.
2. Determine scope based on invocation mode:
   - **Single-task mode** (`/nitro-auto-pilot TASK_YYYY_NNN`): scope = the specified task ID plus its transitive dependencies only. Warnings for out-of-scope tasks are still printed to the user but do NOT trigger an abort.
   - **All-tasks or dry-run mode**: scope = all CREATED and IMPLEMENTED tasks.
3. **Do NOT read task.md files here.** Pre-flight validation runs against the **registry only** (metadata columns: Task ID, Status, Type, Priority, Dependencies). Full task.md reads happen JIT at spawn time (Step 5a-jit) — this keeps the supervisor's context lean.
   - Validations that require task.md content (acceptance criteria count, file scope, description length) are **deferred to Step 5a-jit** and run per-task immediately before spawn, not in bulk at pre-flight.
   - The only pre-flight validations are: dependency checks (4c), circular dependency detection (4d), and registry-level completeness (4b uses registry columns only).
4. Use `sizing-rules.md` (already read in step 1). If it was not found, use the inline fallback limits in Validation D below.
5. Initialize two collections: `blocking_issues = []`, `warnings = []`.
6. **Initialize session directory**: Capture timestamp once (see session-lifecycle.md Step 1). Create directory `task-tracking/sessions/{SESSION_ID}/`. Create `{SESSION_DIR}state.md` with `Loop Status: PENDING` header — do NOT set to RUNNING until the first worker is successfully spawned (Step 5 of the Core Loop). Create `{SESSION_DIR}log.md` with the unified log header if it does not exist. Store `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/` as the working path for all subsequent log writes in this command.
7. **Dry-run shortcut**: If `--dry-run` is active, run all validations (4b through 4f) and print the Pre-Flight Report (4g), but do NOT write to `{SESSION_DIR}`. Then skip to Step 6 (dry-run handler).

**4b. Validation A: Task Completeness — Registry-Only (Warning)**

For each CREATED task, check the **registry columns** (Type, Priority) only — do NOT read task.md:

| Field | Requirement | Warning if violated |
|-------|-------------|---------------------|
| Type | One of: FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE | "TASK_X: missing or invalid Type" |
| Priority | One of: P0-Critical, P1-High, P2-Medium, P3-Low | "TASK_X: missing or invalid Priority" |

Description length and acceptance criteria count are validated **at spawn time** (Step 5a-jit), not here. This keeps pre-flight context-free of task.md content.

Add each violation to `warnings`.

**4c. Validation B: Dependency Check (Blocking)**

For each CREATED or IMPLEMENTED task in scope, parse the Dependencies section. For each referenced task ID (format `TASK_YYYY_NNN`):

- If the task ID is NOT in registry.md → add to `blocking_issues`: `"TASK_X: dependency TASK_Y not in registry"`
- If the dependency has status FAILED → add to `blocking_issues`: `"TASK_X: dependency TASK_Y is FAILED"`
- If the dependency has status CANCELLED → add to `blocking_issues`: `"TASK_X: dependency TASK_Y is CANCELLED"`
- If the dependency has status BLOCKED → add to `blocking_issues`: `"TASK_X: dependency TASK_Y is BLOCKED — unsatisfiable"`
- If the dependency has any unrecognized status value → record warning: `"TASK_X: dependency TASK_Y has unrecognized status '{value}' — verify manually"`

**4c-ii. Validation B-ii: Orphan BLOCKED Task Detection (Warning)**

1. For each task with status BLOCKED:
   - Check if any other task has it in its Dependencies field (directly or transitively)
   - If NO dependents found: classify as "orphan blocked"
2. For each orphan blocked task:
   - Add to `warnings`: `"ORPHAN BLOCKED: TASK_{ID} — blocked with no dependents, needs manual resolution"`
3. This detection is informational only — orphan blocked warnings do NOT block the run.
4. Orphan detection is computed during the dependency graph walk in Validation B — no separate pass needed.

**4d. Validation C: Circular Dependency Detection (Blocking)**

Build a dependency graph of all non-COMPLETE, non-CANCELLED tasks. Run DFS cycle detection:

1. For each task with status other than COMPLETE or CANCELLED, collect its direct dependency IDs from task.md (empty set if task.md missing or task is out of scope).
2. Walk each task's dependency chain recursively using a visited set and a current-path set.
3. If a task ID appears in the current-path set during traversal, a cycle exists. Record the full path at the point of detection.
4. For each cycle found → add to `blocking_issues`: `"Circular dependency: TASK_A -> TASK_B -> ... -> TASK_A"`

Deduplicate cycles by their normalized node set (e.g., `{A,B,C}` — report each cycle only once regardless of which node started the traversal).

**4e. Validation D: Task Sizing Validation — Deferred to JIT (Step 5a-jit)**

Task sizing validation (file scope count, acceptance criteria count, description length, complexity) requires reading task.md content. To preserve supervisor context, these checks are **deferred to Step 5a-jit** and run per-task immediately before spawn.

At Step 5a-jit, if any sizing limit is exceeded:
1. Log: `"TASK_X: {dimension} limit exceeded ({actual}, max {limit}) — auto-splitting"`
2. Invoke `/nitro-create-task` with `--split TASK_X` to auto-split the oversized task.
3. **Never ask the user for permission to split** — auto-split by default. Only skip if `--no-split` is passed.

**No task.md reads happen at pre-flight time.**

**4f. Validation E: File Scope Overlap Detection — Deferred to Step 3 of Core Loop**

File scope overlap requires reading task.md content. Deferred to Step 3 of the Core Loop (dependency graph + file-scope overlap detection) where it runs against only the tasks about to be spawned in the current wave, not the entire backlog.

**4g. Pre-Flight Report**

Print to the user:

```
PRE-FLIGHT VALIDATION REPORT
=============================
Tasks scanned: {N} ({CREATED_count} CREATED, {IMPLEMENTED_count} IMPLEMENTED)
Blocking issues: {N}
Warnings: {N}

BLOCKING ISSUES (must fix before proceeding):
  {list each blocking issue, one per line — or "(none)"}

WARNINGS (logged to session log — will proceed):
  {list each warning, one per line — or "(none)"}
```

**4h. Decision**

**If `blocking_issues` is non-empty:**

1. Append to `{SESSION_DIR}log.md` (source `auto-pilot`):
   - One entry per blocking issue: `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT BLOCKING — {blocking_issue_message} |`
   - One entry per warning (if any): `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT WARNING — {warning_message} |`
   - Summary line: `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT FAILED — {N} blocking issue(s) found |`
   - Update `{SESSION_DIR}state.md` header: `Loop Status: ABORTED`
2. Display: `"ABORT: Pre-flight validation failed. Fix the issues listed above and re-run /nitro-auto-pilot."`
3. **EXIT. Do not continue to Step 5.**

**If warnings only (no blocking issues):**

1. Append to `{SESSION_DIR}log.md`:
   - One entry per warning: `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT WARNING — {warning_message} |`
   - Summary line: `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT PASSED — {N} warning(s) |`
2. Continue to Step 5.

**If no issues at all:**

1. Append to `{SESSION_DIR}log.md`: `| {HH:MM:SS} | auto-pilot | PRE-FLIGHT PASSED — no issues found |`
2. Continue to Step 5.

---

### Step 5: Display Summary

Before entering the loop, display:

```
SUPERVISOR STARTING
-------------------
Total tasks in registry: {N}
Ready for build (CREATED): {N}
Building (IN_PROGRESS): {N}
Ready for review (IMPLEMENTED): {N}
Reviewing (IN_REVIEW): {N}
Complete: {N}
Blocked/Cancelled: {N}
Concurrency limit: {N}
Monitoring interval: {N} minutes
Mode: {all | single-task TASK_ID | dry-run}
```

If `--sequential` is active, display instead:
```
SEQUENTIAL SUPERVISOR STARTING
-------------------------------
Total tasks in registry: {N}
Ready for sequential execution (CREATED): {N}
Complete: {N}
Blocked/Cancelled: {N}
Task limit: {N | "unlimited"}
Retry limit: {N}
Mode: {all | single-task TASK_ID}
```

### Step 6: Handle Mode

**IF `--dry-run`:**

Display the dependency graph, task classifications by state,
and the planned execution order with worker types. Format:

```
DRY RUN -- Execution Plan
========================

Dependency Graph:
  TASK_2026_003 -> [no dependencies] (READY_FOR_BUILD)
  TASK_2026_004 -> TASK_2026_003 (WAITING)
  TASK_2026_005 -> [no dependencies] (READY_FOR_REVIEW)

Execution Order:
  Wave 1 (immediate):
    Review: TASK_2026_005 (P1-High, FEATURE) -- Review Worker
    Build:  TASK_2026_003 (P0-Critical, FEATURE) -- Build Worker
  Wave 2 (after 003):
    Build:  TASK_2026_004 (P1-High, BUGFIX) -- Build Worker
  Blocked: TASK_2026_006 (dependency cycle)

No workers spawned (dry run).
```

STOP. Do not enter the loop.

**IF single-task mode (TASK_ID provided):**

Determine worker type from current registry state.
Spawn appropriate worker (Build or Review).
Monitor until that worker completes and state transitions.
If state transitioned to IMPLEMENTED (Build Worker done),
automatically spawn Review Worker and monitor until COMPLETE.
STOP after task reaches COMPLETE or failure.

**IF all-tasks mode (no task ID, no `--dry-run`):**

Enter the full Supervisor loop from SKILL.md (Steps 1-8).

**IF `--sequential` mode:**

1. If a TASK_ID was also provided: single-task sequential mode.
2. Skip MCP validation (already skipped in Step 3).
3. Load the Sequential Mode flow from SKILL.md and execute it.

## Quick Reference

**Worker Types**: Build Worker (CREATED -> IMPLEMENTED), Review Worker (IMPLEMENTED -> COMPLETE)
**Modes**: all-tasks (default), single-task, dry-run, pause, continue, sequential, evaluate, evaluate-ab, evaluate-role
**MCP Tools**: spawn_worker, list_workers, get_worker_activity, get_worker_stats,
              kill_worker, subscribe_worker, get_pending_events, emit_event
**State Dir**: task-tracking/sessions/SESSION_{timestamp}/
**Skill Path**: .claude/skills/auto-pilot/SKILL.md

## References

- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration skill (used by workers): `.claude/skills/orchestration/SKILL.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- MCP nitro-cortex design: `docs/mcp-session-orchestrator-design.md`
- Task template guide: `docs/task-template-guide.md`
- Benchmark suite: `benchmark-suite/config.md`
