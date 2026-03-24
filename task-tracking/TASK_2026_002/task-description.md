# Requirements Document - TASK_2026_002

## Introduction

Nitro-Fueled is a reusable AI development orchestration package that provides a full PM -> Architect -> Dev -> QA pipeline via Claude Code. The orchestration system currently operates in a manual, single-task mode: a user invokes `/orchestrate TASK_YYYY_NNN` and the orchestrator drives one task through its agent sequence in the current session. There is no mechanism to autonomously process a backlog of tasks, resolve dependencies between them, run tasks in parallel, or monitor worker sessions over time.

The auto-pilot is the missing control loop that transforms Nitro-Fueled from a manually-triggered pipeline into an autonomous development system. It reads the task registry and task folders, builds a dependency graph, identifies which tasks are unblocked, generates orchestration prompts, spawns worker sessions via the MCP session-orchestrator, monitors their health and progress, handles completions and failures, and loops continuously until the backlog is drained.

This task delivers two artifacts: the auto-pilot skill (`.claude/skills/auto-pilot/SKILL.md`) containing the core loop logic, and the auto-pilot command (`.claude/commands/auto-pilot.md`) providing the `/auto-pilot` entry point. Both are markdown files -- no application code. The auto-pilot wraps and invokes the existing `/orchestrate` command within spawned worker sessions.

---

## Existing Patterns and Constraints

The following codebase realities inform these requirements:

1. **Auto-pilot loop spec** (`docs/claude-orchestrate-package-design.md` lines 98-113) defines the 8-step loop: read registry -> find unblocked -> pick tasks -> generate prompt -> spawn worker -> monitor -> handle completion -> loop.
2. **Orchestrator state** (`docs/claude-orchestrate-package-design.md` lines 115-123) specifies `task-tracking/orchestrator-state.md` as the persistence mechanism for surviving compactions, tracking active workers, completed tasks, and next queue.
3. **Task template guide** (`docs/task-template-guide.md` lines 89-102) documents how task.md fields feed into auto-pilot decisions: Type determines agent sequence, Priority determines queue ordering, Dependencies determine unblocked status.
4. **MCP session-orchestrator** (`docs/mcp-session-orchestrator-design.md`) provides 5 MCP tools: `spawn_worker`, `list_workers`, `get_worker_stats`, `get_worker_activity`, `kill_worker`. Workers run in iTerm2 tabs with independent context windows.
5. **Orchestration skill** (`.claude/skills/orchestration/SKILL.md`) is the existing single-task orchestrator. Auto-pilot spawns workers that invoke `/orchestrate TASK_YYYY_NNN` -- it does not replace or modify the orchestration skill.
6. **Task tracking reference** (`.claude/skills/orchestration/references/task-tracking.md`) defines task ID format (`TASK_YYYY_NNN`), registry format (markdown table with ID, Status, Type, Description, Created), status values (CREATED, IN_PROGRESS, COMPLETE, BLOCKED, CANCELLED), and folder structure.
7. **Registry status values**: CREATED (ready to be picked up), IN_PROGRESS (worker actively running), COMPLETE (all phases done), BLOCKED (waiting on external dependency), CANCELLED (abandoned).
8. **Existing command pattern** (`.claude/commands/orchestrate.md`, `.claude/commands/create-task.md`): markdown files with Usage section, Execution steps, Quick Reference, and references to skills.
9. **Existing skill pattern** (`.claude/skills/orchestration/SKILL.md`): YAML frontmatter with name/description, then markdown body with sections for role definition, core loop, reference index, and key principles.
10. **Worker spawning** uses `spawn_worker` MCP tool with parameters: `prompt` (the full orchestration prompt), `working_directory` (project root), `label` (human-readable identifier like "TASK_2026_003-Feature"), and optional `model` override.
11. **Worker health states** from session-orchestrator: `healthy`, `high_context`, `compacting`, `stuck`, `finished`.
12. **All deliverables are markdown** -- the auto-pilot skill and command are prompt instructions that guide Claude Code's behavior, not executable application code.

---

## Requirements

### Requirement 1: Auto-Pilot Skill Definition

**User Story:** As the Claude Code session running auto-pilot, I want a skill definition at `.claude/skills/auto-pilot/SKILL.md` that contains the complete autonomous loop logic, so that I can continuously process the task backlog without human intervention.

#### Acceptance Criteria

1. WHEN the auto-pilot skill is loaded THEN it SHALL contain YAML frontmatter with `name: auto-pilot` and a description indicating its purpose (autonomous task processing loop).
2. WHEN the auto-pilot skill defines the core loop THEN it SHALL specify these steps in order:
   a. Read `task-tracking/registry.md` and all `task-tracking/TASK_*/task.md` files
   b. Build a dependency graph from task Dependencies fields and registry statuses
   c. Identify unblocked tasks: status is CREATED and all dependencies have status COMPLETE
   d. Order unblocked tasks by Priority (P0-Critical first, P3-Low last)
   e. Select next task(s) to process (respecting concurrency limits)
   f. Generate an orchestration prompt from the task's `task.md` content
   g. Spawn a worker session via MCP `spawn_worker`
   h. Monitor active workers on a configurable interval
   i. Handle worker completion (verify deliverables, update registry)
   j. Loop back to step (a)
3. WHEN the auto-pilot skill describes state persistence THEN it SHALL specify writing `task-tracking/orchestrator-state.md` after every significant event (worker spawned, worker completed, worker failed, loop iteration) so that context can be recovered after compaction.
4. WHEN the auto-pilot skill is loaded THEN it SHALL define the orchestrator-state.md format including: active workers (worker ID, task ID, label, status, spawn time), completed tasks this session, failed tasks this session, next tasks in queue, and last loop timestamp.
5. WHEN the skill references external systems THEN it SHALL reference MCP session-orchestrator tools by their exact names (`spawn_worker`, `list_workers`, `get_worker_stats`, `get_worker_activity`, `kill_worker`) and describe when each is used in the loop.

### Requirement 2: Auto-Pilot Command Entry Point

**User Story:** As a developer using Claude Code with Nitro-Fueled, I want a `/auto-pilot` slash command that starts the autonomous processing loop, so that I can kick off batch task execution with a single command.

#### Acceptance Criteria

1. WHEN a user invokes `/auto-pilot` with no arguments THEN the command SHALL start the auto-pilot loop processing all unblocked CREATED tasks in priority order.
2. WHEN a user invokes `/auto-pilot [TASK_YYYY_NNN]` with a specific task ID THEN the command SHALL process only that single task (spawn one worker, monitor to completion, then stop).
3. WHEN a user invokes `/auto-pilot --dry-run` THEN the command SHALL display the dependency graph, unblocked tasks, and planned execution order WITHOUT spawning any workers.
4. WHEN the command starts THEN it SHALL perform a pre-flight check: verify `task-tracking/registry.md` exists, verify MCP session-orchestrator is available (by calling `list_workers`), and report errors if either is missing.
5. WHEN the command file is created THEN it SHALL follow the existing command pattern in `.claude/commands/`: markdown with Usage section, Execution steps, parameter descriptions, and references to the auto-pilot skill. It SHALL be placed at `.claude/commands/auto-pilot.md`.
6. WHEN the command starts the loop THEN it SHALL display a summary: number of total tasks, number of unblocked tasks, concurrency limit, and monitoring interval before proceeding.

### Requirement 3: Dependency Graph Building

**User Story:** As the auto-pilot loop, I want to build a complete dependency graph from the registry and task folders, so that I can determine which tasks are ready to execute and which are blocked.

#### Acceptance Criteria

1. WHEN the auto-pilot reads the registry THEN it SHALL parse every row and extract: Task ID, Status, Type, and Description.
2. WHEN the auto-pilot reads task.md files THEN it SHALL extract the Dependencies field and parse it into a list of task IDs that the current task depends on.
3. WHEN the dependency graph is built THEN a task SHALL be classified as "unblocked" only if ALL of the following are true:
   a. Its registry status is CREATED
   b. It has zero dependencies, OR all of its dependencies have registry status COMPLETE
4. WHEN a dependency cycle is detected (Task A depends on Task B, Task B depends on Task A, directly or transitively) THEN the auto-pilot SHALL flag all tasks in the cycle as BLOCKED in the registry and log a warning, rather than entering an infinite wait.
5. WHEN a task references a dependency that does not exist in the registry THEN the auto-pilot SHALL flag that task as BLOCKED and log a warning indicating the missing dependency.
6. WHEN the dependency graph is built THEN it SHALL also identify tasks that are IN_PROGRESS (workers already running) so the auto-pilot does not spawn duplicate workers.

### Requirement 4: Task Selection and Queue Ordering

**User Story:** As the auto-pilot loop, I want to select the highest-priority unblocked tasks for execution, so that critical work is processed before lower-priority items.

#### Acceptance Criteria

1. WHEN multiple unblocked tasks exist THEN the auto-pilot SHALL order them by Priority: P0-Critical before P1-High before P2-Medium before P3-Low.
2. WHEN multiple unblocked tasks share the same priority THEN the auto-pilot SHALL order them by task ID (lower NNN first, i.e., older tasks first).
3. WHEN selecting tasks to spawn THEN the auto-pilot SHALL respect the configured concurrency limit (maximum number of simultaneous workers). It SHALL NOT spawn a new worker if the number of active workers (IN_PROGRESS status) equals or exceeds the concurrency limit.
4. WHEN no unblocked tasks exist and no workers are active THEN the auto-pilot SHALL report "All tasks complete or blocked" and stop the loop.
5. WHEN no unblocked tasks exist but workers are still active THEN the auto-pilot SHALL continue monitoring active workers and re-evaluate unblocked tasks after each worker completes (a completion may unblock downstream tasks).

### Requirement 5: Orchestration Prompt Generation

**User Story:** As the auto-pilot loop, I want to generate a complete orchestration prompt from a task's `task.md` content, so that the spawned worker session has all the context needed to execute the task autonomously.

#### Acceptance Criteria

1. WHEN generating a prompt for a task THEN it SHALL include the `/orchestrate TASK_YYYY_NNN` command invocation so the worker uses the existing orchestration skill.
2. WHEN generating a prompt THEN it SHALL include the task's working directory (project root) so the worker operates in the correct project context.
3. WHEN generating a prompt THEN it SHALL instruct the worker to run autonomously without user validation checkpoints (auto-approve all checkpoints), since there is no human at the worker terminal.
4. WHEN generating a prompt for a task that was previously attempted but failed or was left incomplete THEN the prompt SHALL include context about the previous attempt (what was completed, what failed) so the continuation worker can resume rather than restart.
5. WHEN the prompt is generated THEN it SHALL be suitable for passing directly to the MCP `spawn_worker` tool's `prompt` parameter.

### Requirement 6: Worker Spawning via MCP Session-Orchestrator

**User Story:** As the auto-pilot loop, I want to spawn worker sessions through the MCP session-orchestrator, so that each task runs in an isolated Claude Code session with its own context window.

#### Acceptance Criteria

1. WHEN spawning a worker THEN the auto-pilot SHALL call the MCP `spawn_worker` tool with: the generated orchestration prompt, the project's working directory, and a descriptive label (format: `TASK_YYYY_NNN-[Type]`, e.g., `TASK_2026_003-FEATURE`).
2. WHEN a worker is successfully spawned THEN the auto-pilot SHALL update the task's registry status from CREATED to IN_PROGRESS.
3. WHEN a worker is successfully spawned THEN the auto-pilot SHALL record the worker ID, task ID, label, and spawn timestamp in `orchestrator-state.md`.
4. WHEN spawning fails (MCP tool returns error) THEN the auto-pilot SHALL log the error, leave the task status as CREATED (so it can be retried on the next loop iteration), and continue processing other tasks.
5. WHEN the concurrency limit would be exceeded THEN the auto-pilot SHALL queue the task and wait for an active worker to complete before spawning.

### Requirement 7: Monitoring Loop

**User Story:** As the auto-pilot loop, I want to periodically check on active workers, so that I can detect stuck workers, track progress, and respond to completions promptly.

#### Acceptance Criteria

1. WHEN workers are active THEN the auto-pilot SHALL check their status at a configurable monitoring interval (default: every 10 minutes) using the MCP `get_worker_stats` tool.
2. WHEN a worker's health status is `finished` THEN the auto-pilot SHALL trigger the completion handler for that worker's task.
3. WHEN a worker's health status is `stuck` (no activity for a configurable threshold) THEN the auto-pilot SHALL:
   a. First attempt: log a warning and wait one more monitoring interval
   b. Second consecutive stuck detection: kill the worker via MCP `kill_worker`, set the task status to CREATED (for retry), and log the failure.
4. WHEN a worker's health status is `high_context` or `compacting` THEN the auto-pilot SHALL log the status but take no action (the worker is still progressing, just nearing context limits).
5. WHEN the monitoring check runs THEN the auto-pilot SHALL update `orchestrator-state.md` with the latest status of all active workers.
6. WHEN monitoring THEN the auto-pilot SHALL use `get_worker_activity` (not `get_worker_stats`) for routine checks to minimize context consumption in the orchestrator session, reserving `get_worker_stats` for when detailed metrics are needed (stuck detection, completion verification).

### Requirement 8: Completion Handling

**User Story:** As the auto-pilot loop, I want to properly handle worker completions, so that finished tasks are marked complete, the registry is updated, and downstream tasks become unblocked.

#### Acceptance Criteria

1. WHEN a worker finishes THEN the auto-pilot SHALL verify that the task's `completion-report.md` exists in the task folder as evidence of successful completion.
2. WHEN `completion-report.md` exists THEN the auto-pilot SHALL update the task's registry status to COMPLETE.
3. WHEN `completion-report.md` does NOT exist but the worker process has ended THEN the auto-pilot SHALL treat the task as incomplete:
   a. Set the task status back to CREATED
   b. Increment a retry counter for that task in `orchestrator-state.md`
   c. If retry count exceeds the configured retry limit (default: 2), set status to BLOCKED and log a warning
4. WHEN a task is marked COMPLETE THEN the auto-pilot SHALL immediately re-evaluate the dependency graph (a newly completed task may unblock other tasks).
5. WHEN the worker process is still running after `completion-report.md` exists THEN the auto-pilot SHALL wait one monitoring interval, then kill the worker if it is still running (worker stuck post-completion).

### Requirement 9: State Management and Compaction Survival

**User Story:** As the auto-pilot session that may undergo context compaction during long runs, I want persistent state in `orchestrator-state.md`, so that I can recover my full context after compaction and continue the loop seamlessly.

#### Acceptance Criteria

1. WHEN `orchestrator-state.md` is written THEN it SHALL contain all state necessary to resume the loop:
   - Active workers: worker ID, task ID, label, status, spawn timestamp, last health check, retry count
   - Completed tasks this session: task ID, completion timestamp, worker cost
   - Failed tasks this session: task ID, failure reason, retry count
   - Task queue: ordered list of next unblocked tasks
   - Configuration: concurrency limit, monitoring interval, retry limit
   - Last loop iteration timestamp
2. WHEN the auto-pilot session starts (or resumes after compaction) THEN it SHALL read `orchestrator-state.md` if it exists and restore loop state from it rather than starting fresh.
3. WHEN restoring from state THEN the auto-pilot SHALL validate that active workers listed in state are still actually running (by calling MCP `list_workers`) and reconcile any discrepancies (e.g., worker finished while orchestrator was compacted).
4. WHEN `orchestrator-state.md` is updated THEN it SHALL be written atomically (full file overwrite) to avoid partial state corruption.
5. WHEN the auto-pilot loop terminates normally (all tasks complete or blocked) THEN it SHALL write a final state with a `loop_status: STOPPED` indicator and a summary of the session.

### Requirement 10: Error Handling and Resilience

**User Story:** As the auto-pilot loop, I want robust error handling for all failure modes, so that a single worker failure or transient error does not crash the entire auto-pilot session.

#### Acceptance Criteria

1. WHEN a worker fails (process crashes, MCP reports failure) THEN the auto-pilot SHALL NOT stop the loop. It SHALL log the failure, update the task status, and continue processing remaining tasks.
2. WHEN the MCP session-orchestrator becomes unreachable THEN the auto-pilot SHALL retry the MCP call up to 3 times with a configurable backoff interval, then pause the loop and alert the user if still unreachable.
3. WHEN a dependency cycle is detected THEN the auto-pilot SHALL mark all tasks in the cycle as BLOCKED, log the cycle details, and continue processing non-cyclic tasks.
4. WHEN reading a task.md file fails (missing, malformed) THEN the auto-pilot SHALL skip that task, log a warning, and continue with other tasks.
5. WHEN the auto-pilot encounters an unexpected error THEN it SHALL write current state to `orchestrator-state.md` before surfacing the error, so that state is preserved for recovery.

### Requirement 11: Configuration

**User Story:** As a developer running auto-pilot, I want configurable parameters for concurrency, monitoring, and retries, so that I can tune the auto-pilot behavior for my project's needs and API limits.

#### Acceptance Criteria

1. WHEN the auto-pilot skill defines configuration THEN it SHALL specify these parameters with their defaults:
   - **Concurrency limit**: Maximum simultaneous workers (default: 2)
   - **Monitoring interval**: Time between health checks (default: 10 minutes)
   - **Stuck threshold**: Inactivity duration before a worker is considered stuck (default: 5 minutes, matching session-orchestrator's 120-second last_action_age with a buffer)
   - **Retry limit**: Maximum retry attempts for a failed task (default: 2)
   - **MCP retry backoff**: Wait time between MCP retry attempts (default: 30 seconds)
2. WHEN configuration is specified THEN it SHALL be overridable via command arguments (e.g., `/auto-pilot --concurrency 3 --interval 5m`).
3. WHEN no overrides are provided THEN the auto-pilot SHALL use the default values defined in the skill.

---

## Non-Functional Requirements

### Consistency Requirements

- The auto-pilot skill SHALL use the exact same registry format, task ID format, and status values defined in `.claude/skills/orchestration/references/task-tracking.md`. No alternative naming or synonyms.
- The auto-pilot command SHALL follow the same structural pattern as existing commands in `.claude/commands/` (Usage, Execution steps, References sections).
- The auto-pilot skill SHALL follow the same structural pattern as `.claude/skills/orchestration/SKILL.md` (YAML frontmatter, role definition, core loop, reference index).

### Context Efficiency Requirements

- The auto-pilot loop SHALL minimize context consumption in the orchestrator session. It SHALL prefer `get_worker_activity` (compact summaries) over `get_worker_stats` (full details) for routine monitoring.
- The `orchestrator-state.md` file SHALL be concise enough that reading it after compaction does not consume excessive context, yet complete enough to fully restore loop state.

### Reliability Requirements

- The auto-pilot SHALL survive context compaction without losing track of active workers or task state (via orchestrator-state.md persistence).
- The auto-pilot SHALL handle all MCP tool failures gracefully without crashing the loop.
- The auto-pilot SHALL never spawn duplicate workers for the same task (checked via both registry status and orchestrator-state.md active workers list).

### Maintainability Requirements

- The auto-pilot skill SHALL not duplicate logic from the orchestration skill. It wraps/invokes `/orchestrate` within workers -- it does not re-implement strategy selection, agent sequencing, or phase detection.
- The auto-pilot skill SHALL reference the task-tracking reference and MCP design doc rather than restating their specifications.

### Project-Agnostic Requirements

- The auto-pilot SHALL make zero assumptions about the target project's tech stack, languages, frameworks, or directory structure beyond the Nitro-Fueled `task-tracking/` convention.
- The auto-pilot SHALL work in any project that has been initialized with Nitro-Fueled and has the MCP session-orchestrator configured.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Role | Needs | Success Criteria |
|---|---|---|---|
| Developer (end user) | Starts auto-pilot, monitors progress | Simple command to start, visibility into worker status, reliable completion | Can start `/auto-pilot` and walk away; returns to find tasks completed |
| Orchestrator session | Runs the auto-pilot loop | Clear loop logic, state persistence, compaction survival | Processes full backlog without human intervention or state loss |
| MCP session-orchestrator | Spawns/monitors workers | Well-formed spawn requests, reasonable monitoring frequency | Receives valid parameters, not overwhelmed by excessive health checks |
| Orchestration skill (in workers) | Executes individual tasks | Properly formatted orchestration prompts, autonomous mode | Workers complete tasks using existing `/orchestrate` without modification |

### Secondary Stakeholders

| Stakeholder | Role | Needs |
|---|---|---|
| CLI (future) | `npx nitro-fueled run` will wrap `/auto-pilot` | Auto-pilot logic that can be invoked programmatically |
| Task template system (TASK_2026_001) | Provides task.md structure | Auto-pilot correctly parses task.md fields defined by the template |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Orchestrator session hits context limit during long auto-pilot runs | High | High | orchestrator-state.md persistence enables full recovery after compaction; context-efficient monitoring via `get_worker_activity` |
| Worker spawned but orchestrator loses track of it after compaction | High | High | orchestrator-state.md records all active workers; reconciliation step validates against MCP `list_workers` on recovery |
| MCP session-orchestrator not running when auto-pilot starts | Medium | High | Pre-flight check verifies MCP availability before entering loop; clear error message with setup instructions |
| Dependency cycle causes infinite wait | Medium | High | Explicit cycle detection during graph building; cyclic tasks marked BLOCKED with logged warning |
| Worker appears stuck but is actually making progress (slow task) | Medium | Medium | Two-strike stuck detection (warn first, kill on second consecutive detection); configurable stuck threshold |
| Duplicate workers spawned for same task after compaction | Medium | High | Reconciliation checks both registry status (IN_PROGRESS) and MCP `list_workers` before spawning |
| Task.md missing or malformed for a task in the registry | Low | Medium | Graceful skip with warning; other tasks continue processing |
| Registry becomes corrupted during concurrent updates (orchestrator + worker both writing) | Low | High | Only the auto-pilot updates registry status transitions; workers write completion-report.md as the signal, not registry directly |

---

## Deliverables Summary

| # | Deliverable | Path | Description |
|---|---|---|---|
| 1 | Auto-pilot skill definition | `.claude/skills/auto-pilot/SKILL.md` | Core loop logic, state management, monitoring, error handling |
| 2 | Auto-pilot command | `.claude/commands/auto-pilot.md` | `/auto-pilot` entry point with usage, parameters, pre-flight checks |
| 3 | CLAUDE.md update | `CLAUDE.md` | Mark "Build auto-pilot skill/command" as DONE in Development Priority |

---

## References

- Auto-pilot loop spec: `docs/claude-orchestrate-package-design.md` (lines 98-123)
- Task template guide (auto-pilot integration): `docs/task-template-guide.md` (lines 89-102)
- MCP session-orchestrator design (tools, health states): `docs/mcp-session-orchestrator-design.md`
- Orchestration skill (wraps within workers): `.claude/skills/orchestration/SKILL.md`
- Task tracking reference (registry, statuses, folder structure): `.claude/skills/orchestration/references/task-tracking.md`
- Existing command pattern: `.claude/commands/orchestrate.md`, `.claude/commands/create-task.md`
- Predecessor task: `task-tracking/TASK_2026_001/` (task template system -- defines task.md structure auto-pilot consumes)
