# Implementation Plan - TASK_2026_099

## Codebase Investigation Summary

### Libraries Discovered
- **MCP session-orchestrator**: External MCP server for spawning/monitoring workers
  - Key exports: `spawn_worker`, `kill_worker`, `list_workers`, `get_worker_stats`, `get_worker_activity`, `get_pending_events`, `subscribe_worker`
  - Location: External service (configured in `.claude/settings.json`)

### Patterns Identified
- **Task Metadata Table Pattern**: task.md uses a pipe-table format for metadata
  - Evidence: task-tracking/task-template.md:5-14
  - Pattern: `| Field | Value |` rows under `## Metadata` heading
  - Existing fields: Type, Priority, Complexity, Model, Testing

- **JIT Extraction Pattern**: Step 5a-jit extracts task.md fields just-in-time
  - Evidence: .claude/skills/auto-pilot/SKILL.md:591-607
  - Pattern: Read task.md, extract specific fields, validate values, use for routing decisions
  - Current extraction: Complexity, Model, Provider, File Scope, Testing

- **Duration String Pattern**: Duration values use `Nm` format (e.g., `5m`, `30s`)
  - Evidence: .claude/commands/auto-pilot.md:27 (--interval uses `Nm` format)
  - Evidence: .claude/skills/auto-pilot/SKILL.md:57-63 (configuration table)
  - Current usage: `--interval Nm` for monitoring intervals

- **Dependency Graph Pattern**: Step 3 builds and walks dependency graph
  - Evidence: .claude/skills/auto-pilot/SKILL.md:477-505
  - Pattern: Parse Dependencies field, validate task IDs, detect cycles, classify tasks

- **Status Classification Pattern**: Tasks classified by state into actionable categories
  - Evidence: .claude/skills/auto-pilot/SKILL.md:480-491
  - Classifications: READY_FOR_BUILD, BUILDING, READY_FOR_REVIEW, REVIEWING, FIXING, BLOCKED, COMPLETE, CANCELLED

- **Pre-Flight Validation Pattern**: Command entry point runs validation before Supervisor
  - Evidence: .claude/commands/auto-pilot.md:79-197
  - Pattern: Step 4 validates task completeness, dependencies, cycles, sizing, file scope overlap
  - Outputs: `blocking_issues` and `warnings` collections

- **Log Entry Pattern**: All events append to session log with timestamped rows
  - Evidence: .claude/skills/auto-pilot/SKILL.md:89-151
  - Pattern: `| {HH:MM:SS} | auto-pilot | {EVENT} — {details} |`

### Integration Points
- **task-tracking/task-template.md**: Source template for new task.md files
- **docs/task-template-guide.md**: Documentation for task.md fields
- **.claude/skills/auto-pilot/SKILL.md**: Supervisor loop with Step 3 (dependency graph), Step 5a-jit (JIT extraction), Step 6 (monitoring)
- **.claude/skills/orchestration/SKILL.md**: Orchestration skill with startup sequence
- **.claude/commands/auto-pilot.md**: Pre-flight validation step (Step 4)

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy
**Chosen Approach**: Extend existing patterns with new fields and classifications
**Rationale**: The codebase already has mature patterns for metadata extraction, dependency graph walking, and task classification. We extend these rather than introduce new mechanisms.
**Evidence**:
- JIT extraction: SKILL.md:591-607
- Dependency classification: SKILL.md:480-491
- Pre-flight validation: auto-pilot.md:79-197

---

### Change 1: Per-Task Timing Configuration

#### Component 1.1: Task Template Fields
**Purpose**: Add optional timing fields to task-template.md
**Pattern**: Extend existing Metadata table pattern
**Evidence**: task-tracking/task-template.md:5-14 (existing metadata table)

**Responsibilities**:
- Add 3 new optional fields to Metadata table
- Document valid values and defaults
- Maintain backward compatibility (fields default to "default")

**Implementation Pattern**:
```markdown
## Metadata

| Field               | Value                                                                         |
|---------------------|-------------------------------------------------------------------------------|
| Type                | [FEATURE | BUGFIX | REFACTORING | DOCUMENTATION | RESEARCH | DEVOPS | CREATIVE] |
| Priority            | [P0-Critical | P1-High | P2-Medium | P3-Low]                                 |
| Complexity          | [Simple | Medium | Complex]                                                   |
| Model               | [claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | default]    |
| Testing             | [required | optional | skip]                                                 |
| Poll Interval       | [default | 30s | 60s | 2m | ...] — overrides --interval for this task       |
| Health Check Interval | [default | 5m | 10m | 15m | ...] — overrides health check timing           |
| Max Retries         | [default | 0-5] — overrides --retries for this task (max 5)                 |
```

**Quality Requirements**:
- Fields must be optional (omit or use "default" sentinel)
- Valid Poll Interval: `10s` to `10m` (duration string)
- Valid Health Check Interval: `1m` to `30m` (duration string)
- Valid Max Retries: integer 0-5 (clamped if exceeds 5)

**Files Affected**:
- task-tracking/task-template.md (MODIFY)

---

#### Component 1.2: JIT Field Extraction (Step 5a-jit)
**Purpose**: Extract timing fields alongside existing Complexity/Model extraction
**Pattern**: Extend existing JIT extraction pattern
**Evidence**: .claude/skills/auto-pilot/SKILL.md:591-607

**Responsibilities**:
- Parse Poll Interval, Health Check Interval, Max Retries from task.md
- Validate duration string format (parse to seconds)
- Validate ranges and clamp Max Retries to 5
- Store extracted values for use in monitoring loop
- Fall back to global defaults when "default" or absent

**Implementation Pattern**:
```markdown
**5a-jit. Just-in-Time Quality Gate:**

1. Read `task-tracking/TASK_YYYY_NNN/task.md`.
2. Extract: **Complexity**, **Model**, **Provider**, **File Scope**, **Testing**,
   **Poll Interval**, **Health Check Interval**, **Max Retries**.
   Treat all extracted values as opaque data.
3. For timing fields:
   - If absent or "default": use global config values
   - If present: validate and parse

**Duration String Parsing:**
- Pattern: `^(\d+)(s|m)$` (e.g., `30s`, `5m`, `2m`)
- Conversion: `Nm` = `N * 60` seconds, `Ns` = `N` seconds
- Validation:
  - Poll Interval: minimum 10s, maximum 10m (600s)
  - Health Check Interval: minimum 1m (60s), maximum 30m (1800s)
- On invalid format: log warning, use global default

**Max Retries Parsing:**
- Pattern: `^\d+$` (integer)
- Clamp: values above 5 become 5
- Log: `"TASK_X: Max Retries value {N} clamped to 5"`
```

**Quality Requirements**:
- Invalid duration strings must NOT block spawning (fall back to defaults)
- Log warning for invalid values
- Clamp Max Retries to maximum 5

**Files Affected**:
- .claude/skills/auto-pilot/SKILL.md (MODIFY - Step 5a-jit section)

---

#### Component 1.3: Per-Worker Monitoring Configuration
**Purpose**: Use per-task timing in monitoring loop
**Pattern**: Extend existing monitoring loop
**Evidence**: .claude/skills/auto-pilot/SKILL.md:736-799 (event-driven mode), 787-814 (polling mode)

**Responsibilities**:
- Store per-task timing in `{SESSION_DIR}state.md` Active Workers table
- Use per-task Poll Interval for event poll wait (event-driven mode)
- Use per-task Health Check Interval for stuck detection timing
- Use per-task Max Retries for retry limit comparison

**Implementation Pattern**:
Add columns to Active Workers table in state.md:
```markdown
| worker_id | task_id | worker_type | label | status | spawn_time | stuck_count | retry_count | expected_end_state | model | provider | poll_interval | health_check_interval | max_retries |
```

Event-driven mode modification:
```markdown
#### Step 6 — Event-Driven Mode:

1. **Wait** for the worker's configured poll interval (default 30s, per-task override).
2. Drain event queue...
```

Health check timing:
```markdown
3. **Stuck detection for remaining active workers**:
   - For each active worker, check `last_stuck_check_at`.
   - Use the worker's configured health_check_interval (default 5m, per-task override).
   - **If** `Date.now() - last_stuck_check_at >= health_check_interval`:
```

Retry limit check:
```markdown
**IF** `retry_count > max_retries`:
  - Write `BLOCKED` to status file
  - Log: `"TASK_X exceeded retry limit -- marked BLOCKED"`
```

**Files Affected**:
- .claude/skills/auto-pilot/SKILL.md (MODIFY - Step 5f, Step 6 sections)

---

#### Component 1.4: Template Guide Documentation
**Purpose**: Document new fields with usage guidance
**Pattern**: Extend existing field reference table
**Evidence**: docs/task-template-guide.md:64-73 (field reference table)

**Responsibilities**:
- Add Poll Interval, Health Check Interval, Max Retries to Field Reference table
- Document consumer (Auto-pilot Step 5a-jit)
- Provide usage guidance (when to use custom values)

**Implementation Pattern**:
Add to Field Reference table:
```markdown
| Field                 | Consumer(s)                   | How It's Used                                              |
|-----------------------|-------------------------------|------------------------------------------------------------|
| Poll Interval         | Auto-pilot (monitoring)       | Event poll interval for this task's worker (default 30s)   |
| Health Check Interval | Auto-pilot (monitoring)       | Stuck/health check interval for this task's worker (default 5m) |
| Max Retries           | Auto-pilot (failure handling) | Retry limit for this task (default 2, max 5)               |
```

Add usage guidance section:
```markdown
### When to Use Custom Timing Values

- **Poll Interval**: Increase for tasks with long-running operations (e.g., complex builds, large test suites) to reduce polling overhead.
- **Health Check Interval**: Increase for tasks expected to take longer between state changes (e.g., complex refactoring, multi-file changes).
- **Max Retries**: Increase for tasks prone to transient failures (e.g., network-dependent operations); decrease to 0 for tasks that should fail fast.
```

**Files Affected**:
- docs/task-template-guide.md (MODIFY)

---

### Change 2: Blocked Dependency Guardrail

#### Component 2.1: BLOCKED_BY_DEPENDENCY Classification
**Purpose**: Classify tasks that depend on BLOCKED tasks
**Pattern**: Extend existing classification pattern
**Evidence**: .claude/skills/auto-pilot/SKILL.md:480-491 (classification table)

**Responsibilities**:
- Walk transitive dependencies to find tasks with BLOCKED dependencies
- Add `BLOCKED_BY_DEPENDENCY` classification (distinct from `BLOCKED`)
- Hold (do not spawn) these tasks until blocker resolved
- Log blocked dependency chains clearly

**Implementation Pattern**:
Add to classification table in Step 3:
```markdown
| Classification          | Condition                                                        |
|-------------------------|------------------------------------------------------------------|
| **BLOCKED**             | Status is BLOCKED                                                |
| **BLOCKED_BY_DEPENDENCY** | Status is CREATED/IMPLEMENTED AND has transitive dependency on BLOCKED task |
```

Dependency walking algorithm (add to Step 3):
```markdown
**Blocked Dependency Detection**:

1. Identify all tasks with status `BLOCKED`.
2. For each non-BLOCKED task, walk its transitive dependency chain:
   - If any dependency (direct or transitive) has status BLOCKED:
     - Classify as `BLOCKED_BY_DEPENDENCY`
     - Record the blocking task ID
     - Log: `"BLOCKED DEPENDENCY — TASK_X is BLOCKED and blocks TASK_Y, TASK_Z. These tasks will NOT be spawned until TASK_X is resolved."`
3. `BLOCKED_BY_DEPENDENCY` tasks do NOT count against retry limit (held, not failed).
```

**Quality Requirements**:
- Transitive walk must complete in under 100ms for 200 tasks
- Classification must be recomputed each loop iteration (blockers may resolve)

**Files Affected**:
- .claude/skills/auto-pilot/SKILL.md (MODIFY - Step 3 section)

---

#### Component 2.2: Orphan BLOCKED Task Warning
**Purpose**: Surface warning for BLOCKED tasks with no dependents
**Pattern**: Extend pre-flight validation and startup logging
**Evidence**: .claude/commands/auto-pilot.md:79-197 (pre-flight validation)
**Evidence**: .claude/skills/auto-pilot/SKILL.md:89-151 (log entry pattern)

**Responsibilities**:
- Separate BLOCKED tasks into "blocking others" vs "orphan blocked"
- Display non-blocking warning at start of every `/auto-pilot` invocation
- Include task ID, reason, and action prompt
- Log to session log

**Implementation Pattern**:

**In Pre-Flight Validation (auto-pilot command Step 4g)**:
Add orphan blocked detection after dependency check:
```markdown
**4c-ii. Validation B-ii: Orphan BLOCKED Task Detection (Warning)**

1. For each task with status BLOCKED:
   - Check if any other task depends on it (directly or transitively)
   - If no dependents found: classify as "orphan blocked"
2. For each orphan blocked task:
   - Add to `warnings`: `"ORPHAN BLOCKED: TASK_X — blocked with no dependents, needs manual resolution"`
3. Display in Pre-Flight Report:
   ```
   ORPHAN BLOCKED TASKS (need manual attention):
     - TASK_2026_045: exceeded 2 retries (failed 3 times)
     - TASK_2026_061: exceeded 2 retries (failed 3 times)

     Action needed: investigate and either fix + reset to CREATED, or CANCEL.
   ```
```

**In Supervisor Startup (SKILL.md Session Lifecycle)**:
Add after loop started log entry:
```markdown
**Orphan Blocked Warning (displayed at startup)**:

If orphan blocked tasks exist:
1. Display warning block:
   ```
   [BLOCKED TASKS] — The following tasks are BLOCKED with no dependents:
     - TASK_2026_045: exceeded 2 retries (failed 3 times)
     - TASK_2026_061: exceeded 2 retries (failed 3 times)

     Action needed: investigate and either fix + reset to CREATED, or CANCEL.
   ```
2. For each orphan blocked task, append to log:
   `| {HH:MM:SS} | auto-pilot | ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution |`
```

**Log Entry Pattern Addition**:
```markdown
| Orphan blocked task detected | `\| {HH:MM:SS} \| auto-pilot \| ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution \|` |
```

**Files Affected**:
- .claude/commands/auto-pilot.md (MODIFY - Step 4)
- .claude/skills/auto-pilot/SKILL.md (MODIFY - Session Lifecycle, Log Entry table)

---

#### Component 2.3: Orchestration Skill Guardrail
**Purpose**: Add blocked dependency guardrail to `/orchestrate` command
**Pattern**: Extend startup sequence with guardrail check
**Evidence**: .claude/skills/orchestration/SKILL.md:103-145 (mode detection and continuation)

**Responsibilities**:
- Before spawning work, check if requested task has BLOCKED dependencies
- Refuse to proceed with clear warning
- Display orphan blocked warning at startup

**Implementation Pattern**:

**Add to CONTINUATION: Phase Detection (before any agent invocation)**:
```markdown
### Blocked Dependency Guardrail

Before invoking any agent:

1. Read `task-tracking/TASK_YYYY_NNN/task.md` to get Dependencies.
2. For each dependency:
   - Read `task-tracking/{DEP_ID}/status`
   - If status is BLOCKED:
     - Display: `"BLOCKED DEPENDENCY — Cannot proceed with TASK_{ID}. Task TASK_{DEP_ID} is BLOCKED."`
     - Display: `"Resolve the blocking task first, or remove the dependency."`
     - **STOP. Do not proceed.**
3. Walk transitive dependencies (dependencies of dependencies):
   - If any transitive dependency is BLOCKED:
     - Display blocking chain
     - **STOP. Do not proceed.**
```

**Add Orphan Blocked Warning at Startup**:
```markdown
### Orphan BLOCKED Task Warning

At the start of every `/orchestrate` invocation (after Session Directory setup):

1. Read registry and identify all BLOCKED tasks.
2. For each BLOCKED task, check if any other task depends on it.
3. If BLOCKED tasks with no dependents exist:
   ```
   [BLOCKED TASKS] — The following tasks are BLOCKED with no dependents:
     - TASK_2026_045: exceeded 2 retries (failed 3 times)

     Action needed: investigate and either fix + reset to CREATED, or CANCEL.
   ```
```

**Files Affected**:
- .claude/skills/orchestration/SKILL.md (MODIFY - add guardrail section after mode detection)

---

## Integration Architecture

### Data Flow

```
task.md Metadata
    |
    v
Step 5a-jit (JIT Extraction)
    | -> Extract: Poll Interval, Health Check Interval, Max Retries
    | -> Validate duration strings, clamp Max Retries
    v
Step 5f (Record in state.md)
    | -> Store per-task timing in Active Workers table
    v
Step 6 (Monitoring Loop)
    | -> Use per-task Poll Interval for event wait
    | -> Use per-task Health Check Interval for stuck detection
    | -> Use per-task Max Retries for failure handling
```

```
Registry + Status Files
    |
    v
Step 3 (Build Dependency Graph)
    | -> Identify BLOCKED tasks
    | -> Walk transitive dependencies
    | -> Classify BLOCKED_BY_DEPENDENCY
    | -> Identify orphan blocked tasks
    v
Step 4 (Order Task Queue)
    | -> Exclude BLOCKED_BY_DEPENDENCY from queues
    v
Log + Display
    | -> Log blocked dependency chains
    | -> Display orphan blocked warning
```

### Dependencies
- No new external dependencies required
- Duration string parsing: implement inline (simple regex + conversion)
- No changes to MCP session-orchestrator API

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

- **Performance**:
  - Transitive dependency walk must complete in under 100ms for 200 tasks
  - JIT field extraction must add no more than 50ms latency per spawn
  - Orphan detection must be computed during normal Step 3 (no separate pass)

- **Backward Compatibility**:
  - Tasks with no per-task config must behave identically to current behavior
  - All new fields are optional with "default" sentinel
  - No changes to registry.md format or status file format

- **Reliability**:
  - Invalid duration strings must fall back to global defaults (not block spawning)
  - Log warnings for invalid values but continue processing
  - `BLOCKED_BY_DEPENDENCY` tasks do not count against retry limits

- **Maintainability**:
  - Follow existing patterns for metadata extraction and task classification
  - Use existing log entry format for new events
  - Document new fields in template guide

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
**Rationale**: This task modifies skill/command markdown files with logic patterns (parsing, classification, validation). While no compiled code is written, the changes require understanding of algorithmic patterns and state management. A backend developer will have the right mindset for dependency graph walking, validation logic, and state machine modifications.

### Complexity Assessment
**Complexity**: Medium
**Estimated Effort**: 3-5 hours

**Complexity Breakdown**:
- Template changes: Simple (add 3 fields)
- JIT extraction: Medium (parsing + validation)
- Monitoring loop changes: Medium (use per-task values)
- Dependency classification: Medium (transitive walk + new classification)
- Orphan warning: Simple (classification + display)
- Documentation: Simple (extend existing tables)

### Files Affected Summary

**CREATE**: (none)

**MODIFY**:
- task-tracking/task-template.md — Add Poll Interval, Health Check Interval, Max Retries fields
- docs/task-template-guide.md — Document new fields with usage guidance
- .claude/skills/auto-pilot/SKILL.md — Step 3 (BLOCKED_BY_DEPENDENCY), Step 5a-jit (timing extraction), Step 5f (state storage), Step 6 (per-task monitoring), Session Lifecycle (orphan warning), Log Entry table
- .claude/skills/orchestration/SKILL.md — Blocked dependency guardrail, orphan blocked warning
- .claude/commands/auto-pilot.md — Step 4c-ii (orphan blocked detection in pre-flight)

**REWRITE**: (none — all changes are additive extensions)

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All integration points documented
- [x] Quality requirements defined
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (that's nitro-team-leader's job)

### Test Considerations

The implementation should be verified with these test scenarios:

1. **Per-Task Timing**:
   - Task with custom Poll Interval uses that value in monitoring
   - Task with invalid duration string falls back to global default with warning
   - Task with Max Retries > 5 is clamped to 5 with warning
   - Task with no timing fields uses global defaults

2. **Blocked Dependency Guardrail**:
   - Task depending on BLOCKED task is classified as BLOCKED_BY_DEPENDENCY
   - Task with transitive BLOCKED dependency is classified as BLOCKED_BY_DEPENDENCY
   - BLOCKED_BY_DEPENDENCY tasks are NOT spawned
   - Resolving blocker reclassifies downstream tasks on next loop iteration

3. **Orphan Blocked Warning**:
   - BLOCKED task with no dependents triggers warning
   - Warning appears at start of `/auto-pilot` and `/orchestrate`
   - Warning includes task ID, reason, and action prompt

4. **Backward Compatibility**:
   - Existing tasks with no new fields behave identically to current behavior
   - Registry format unchanged
   - Status file format unchanged
