# Requirements Document - TASK_2026_099

## Introduction

This task enhances the Nitro-Fueled Supervisor and orchestration system with two complementary capabilities: (1) per-task timing and retry configuration for fine-grained control over worker monitoring, and (2) a blocked dependency guardrail to prevent spawning work on tasks whose dependencies are blocked.

**Business Value:**
- **Per-task configuration** allows complex tasks to receive longer health check windows and more retry attempts, reducing false-positive stuck detection while keeping simple tasks on tight monitoring cycles.
- **Blocked dependency guardrail** prevents wasted effort on tasks built on unstable foundations, stopping cascading failures before they compound. It also surfaces orphan blocked tasks that need manual attention, ensuring nothing silently fails.

---

## Requirements

### Requirement 1: Per-Task Supervisor Timing Configuration

**User Story:** As a Product Owner running the Supervisor, I want to configure timing and retry limits per-task in task.md, so that complex tasks get longer health check windows and more retry attempts without compromising tight monitoring for simple tasks.

#### Acceptance Criteria

1. WHEN the task.md Metadata table includes `Poll Interval` field THEN the Supervisor SHALL use this value as the event poll interval for that task's worker instead of the global default.
2. WHEN the task.md Metadata table includes `Health Check Interval` field THEN the Supervisor SHALL use this value as the stuck/health check interval for that task's worker instead of the global default.
3. WHEN the task.md Metadata table includes `Max Retries` field THEN the Supervisor SHALL use this value as the retry limit for that task instead of the global default, clamped to maximum 5.
4. WHEN a per-task timing field is absent or set to `default` THEN the Supervisor SHALL fall back to global configuration flags (`--interval`, `--retries`).
5. WHEN `Max Retries` value exceeds 5 THEN the Supervisor SHALL clamp to 5 and log a warning: `"TASK_X: Max Retries value {N} clamped to 5"`.
6. WHEN `Poll Interval` or `Health Check Interval` is an invalid duration string THEN the Supervisor SHALL skip the task this iteration and log: `"TASK_X: invalid {field} value '{value}', using global default"`.
7. WHEN Step 5a-jit extracts timing fields THEN it SHALL parse them alongside Complexity, Model, and Testing fields, treating them as opaque data for validation only.

#### Valid Duration String Format

- **Poll Interval**: Accepts duration strings like `30s`, `60s`, `2m`, `90s`. Minimum: `10s`. Maximum: `10m`.
- **Health Check Interval**: Accepts duration strings like `5m`, `10m`, `15m`. Minimum: `1m`. Maximum: `30m`.
- **Max Retries**: Accepts integers 0-5. Values above 5 are clamped to 5.

---

### Requirement 2: Blocked Dependency Guardrail

**User Story:** As a Product Owner running the Supervisor, I want the system to refuse spawning tasks that depend on BLOCKED tasks, so that downstream work does not start on an incomplete or unstable foundation.

#### Acceptance Criteria

1. WHEN the Supervisor reads the registry in Step 2 THEN it SHALL identify all tasks with status `BLOCKED`.
2. WHEN building the dependency graph in Step 3 THEN the Supervisor SHALL walk transitive dependencies to find all tasks that depend (directly or transitively) on any BLOCKED task.
3. WHEN a task has a BLOCKED dependency THEN the Supervisor SHALL classify it as `BLOCKED_BY_DEPENDENCY` (distinct from `BLOCKED`).
4. WHEN a task is classified as `BLOCKED_BY_DEPENDENCY` THEN the Supervisor SHALL NOT spawn a worker for it and SHALL log: `"BLOCKED DEPENDENCY — TASK_X is BLOCKED and blocks TASK_Y, TASK_Z. These tasks will NOT be spawned until TASK_X is resolved."`
5. WHEN `/orchestrate TASK_ID` is invoked for a task with BLOCKED dependencies THEN the orchestrator SHALL refuse to proceed and display a clear warning listing the blocking task(s).
6. WHEN a BLOCKED task is resolved (status changes to non-BLOCKED) THEN downstream `BLOCKED_BY_DEPENDENCY` tasks SHALL be automatically reclassified based on their dependency status in the next loop iteration.
7. WHEN a task is `BLOCKED_BY_DEPENDENCY` THEN it SHALL NOT count against the retry limit (it is not a failure, just a hold).

#### Dependency Graph Walking Algorithm

```
For each task T:
  For each dependency D of T:
    If D.status == BLOCKED:
      Classify T as BLOCKED_BY_DEPENDENCY
      Log: "TASK_T blocked by TASK_D (BLOCKED)"
    Else If D has transitive dependency on BLOCKED task B:
      Classify T as BLOCKED_BY_DEPENDENCY
      Log: "TASK_T blocked by TASK_B (transitive, BLOCKED)"
```

---

### Requirement 3: Orphan BLOCKED Task Warning

**User Story:** As a Product Owner, I want to be notified on every `/orchestrate` and `/auto-pilot` invocation about BLOCKED tasks with no dependents, so that failed tasks do not silently sit in the backlog without attention.

#### Acceptance Criteria

1. WHEN the Supervisor scans for BLOCKED tasks THEN it SHALL separate them into two categories: (a) blocking others, (b) orphan blocked (no downstream dependents).
2. WHEN orphan blocked tasks exist THEN the Supervisor SHALL surface a non-blocking warning at the start of every `/auto-pilot` invocation.
3. WHEN the orchestration skill is invoked THEN it SHALL surface the same orphan blocked warning at the start of every `/orchestrate` invocation.
4. WHEN the orphan blocked warning is displayed THEN it SHALL include each task's ID and reason (from status or log): `"TASK_X: exceeded N retries"` or `"TASK_X: blocked for reason Y"`.
5. WHEN the orphan blocked warning is displayed THEN it SHALL include an action prompt: `"Action needed: investigate and either fix + reset to CREATED, or CANCEL."`
6. WHEN the Supervisor logs orphan blocked tasks THEN it SHALL write: `"ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution"` to the session log.
7. WHEN no orphan blocked tasks exist THEN no warning SHALL be displayed.

#### Warning Format

```
[BLOCKED TASKS] — The following tasks are BLOCKED with no dependents:
  - TASK_2026_045: exceeded 2 retries (failed 3 times)
  - TASK_2026_061: exceeded 2 retries (failed 3 times)

  Action needed: investigate and either fix + reset to CREATED, or CANCEL.
```

---

### Requirement 4: Template and Documentation Updates

**User Story:** As a developer creating tasks, I want the task template and documentation to include guidance on the new timing and retry fields, so that I can use them correctly without searching through code.

#### Acceptance Criteria

1. WHEN a developer reads task-template.md THEN they SHALL see `Poll Interval`, `Health Check Interval`, and `Max Retries` fields with valid values and guidance comments.
2. WHEN a developer reads docs/task-template-guide.md THEN they SHALL find documentation for the new fields with consumer mapping (Auto-pilot Step 5a-jit).
3. WHEN the template guide documents the new fields THEN it SHALL explain when to use custom values vs defaults.
4. WHEN the template includes the new fields THEN they SHALL be marked as optional with `default` as the sentinel value.

---

## Non-Functional Requirements

### Performance Requirements

- **Dependency Graph Walking**: Transitive dependency walk SHALL complete in under 100ms for backlogs under 200 tasks.
- **Per-Task Field Extraction**: Step 5a-jit field extraction SHALL add no more than 50ms latency per spawn.
- **Orphan Detection**: Classification of orphan vs blocking others SHALL be computed during normal Step 3 dependency graph building (no separate pass).

### Compatibility Requirements

- **Backward Compatibility**: Tasks with no per-task config SHALL behave identically to current behavior (use global defaults).
- **Registry Format**: No changes to registry.md format required.
- **Status File Format**: No changes to status file format required.
- **MCP Contract**: No changes to MCP session-orchestrator API required.

### Reliability Requirements

- **Graceful Degradation**: Invalid duration strings SHALL fall back to global defaults rather than blocking task execution.
- **Log Persistence**: All blocked dependency and orphan blocked warnings SHALL be written to session log for post-mortem analysis.

---

## Stakeholder Analysis

### Primary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|--------------|-------------|------------------|
| Product Owner | High | Configuration, monitoring | Complex tasks get appropriate retry/timing; no silent blocked tasks |
| Build/Review Workers | Medium | Execute with per-task config | Correct retry limits applied; stuck detection respects custom intervals |
| Supervisor Loop | High | Implementation | Correct classification of BLOCKED_BY_DEPENDENCY; accurate orphan detection |

### Secondary Stakeholders

| Stakeholder | Impact Level | Involvement | Success Criteria |
|-------------|--------------|-------------|------------------|
| Task Authors | Medium | Writing task.md | Clear documentation on when/how to use new fields |
| QA Reviewers | Low | Verifying implementation | All acceptance criteria pass |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Score | Mitigation Strategy |
|------|-------------|--------|-------|---------------------|
| Duration string parsing errors | Medium | Low | 4 | Strict validation with fallback to defaults; log warnings |
| Transitive dependency walk performance on large backlogs | Low | Medium | 3 | Cache walked graphs; skip already-visited nodes |
| Orphan detection false positives | Low | Low | 2 | Use exact dependency graph walking; test with edge cases |
| Per-task config conflicts with global flags | Low | Medium | 3 | Clear precedence: per-task > command-line > defaults |

### Business Risks

| Risk | Probability | Impact | Score | Mitigation Strategy |
|------|-------------|--------|-------|---------------------|
| Users confused about BLOCKED vs BLOCKED_BY_DEPENDENCY | Medium | Low | 4 | Clear log messages and documentation |
| Over-warning on orphan tasks causes alert fatigue | Low | Low | 2 | Format warning concisely; group by reason |

---

## Success Metrics

1. **Per-task configuration adoption**: Complex tasks (Complexity=Complex) should use `Max Retries >= 3` within 1 month of feature availability.
2. **Blocked dependency detection accuracy**: Zero tasks spawned with BLOCKED dependencies (verified via log audit).
3. **Orphan blocked task resolution time**: Median time from BLOCKED status to resolution reduced by 50% (measured via status file timestamps).

---

## File Scope

| File | Change Type | Purpose |
|------|-------------|---------|
| task-tracking/task-template.md | Modify | Add Poll Interval, Health Check Interval, Max Retries fields |
| docs/task-template-guide.md | Modify | Document new fields with usage guidance |
| .claude/skills/auto-pilot/SKILL.md | Modify | Step 3: Add BLOCKED_BY_DEPENDENCY classification; Step 5a-jit: Extract timing fields; Startup: Orphan blocked warning |
| .claude/skills/orchestration/SKILL.md | Modify | Add blocked dependency guardrail check; Add orphan blocked warning at startup |

---

## Dependencies

- None

---

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md` (Steps 3, 5a-jit, 6, 7)
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Task template: `task-tracking/task-template.md`
- Template guide: `docs/task-template-guide.md`
- Configuration defaults: Auto-pilot SKILL.md lines 56-63

---

## Parallelism

- **Can run in parallel** — no file scope conflicts with any CREATED tasks in the registry.
- **No wave conflicts** — this task only modifies orchestration/config files, not implementation code that other tasks might touch.
