# Agent Calibration Reference

This reference defines the agent record schema and failure taxonomy used by the agent calibration system. The calibration system tracks agent performance over time so that the Supervisor, team-leader, and `/evaluate-agent` command can make evidence-based decisions about agent assignment and definition updates.

---

## Overview

Agent records are per-agent tracking files stored under `task-tracking/agent-records/`. Each file captures the full history of an agent across three dimensions:

- **Task history** — which tasks the agent ran on and whether outcomes were positive or negative
- **Failure log** — structured failure events tagged with a canonical failure type
- **Evaluation history** — results of deliberate test-task evaluations and what changes were made to the agent definition as a result

Records are the single source of truth for an agent's track record. They are created empty and grow over time as workers append entries after task completion, review workers log failures, and evaluation runs record results.

**Why this matters**: Without calibration records, agent assignment is pure guesswork. With them, the Supervisor can detect patterns (e.g., `backend-developer` repeatedly tagged `scope_exceeded` on infra tasks) and route work differently or trigger an evaluation cycle.

---

## Failure Taxonomy

Exactly 4 failure tags are defined. Every failure entry in a record must use one of these tags — no freeform tags.

### `scope_exceeded`

**Definition**: The agent touched files, made decisions, or took actions outside its defined role boundary as specified in its agent definition file.

**Examples**:

- `systems-developer` modified a TypeScript source file in `src/` while implementing an agent definition — systems-developer's role covers `.claude/` files only
- `code-style-reviewer` rewrote logic in a component to fix a bug it noticed instead of reporting it — reviewer's role is to report findings, not implement fixes

---

### `instruction_ignored`

**Definition**: The agent did not follow an explicit instruction stated in its agent definition file or in the task prompt provided to it.

**Examples**:

- `team-leader` was instructed to write a single batch per developer type (max one batch for backend, one for frontend) but created four backend batches — a direct constraint from the definition was ignored
- `backend-developer` was instructed "do not start git commit process" (from CLAUDE.md) but ran `git commit` at the end of implementation

---

### `quality_low`

**Definition**: The agent's output did not meet the quality bar expected for its role. This includes incomplete deliverables, incorrect content, poorly structured output, or stubs/placeholders where real content was required.

**Examples**:

- `software-architect` produced an `implementation-plan.md` with section headers but no content inside them — placeholders accepted as a completed deliverable
- `systems-developer` created a skill file where the Workflow section listed steps as `[TODO: define step logic]` instead of real procedural steps

---

### `wrong_tool_used`

**Definition**: The agent used tools, methods, or approaches that are outside its expected workflow as defined in its agent definition file.

**Examples**:

- `code-logic-reviewer` used the `mcp__session-orchestrator__spawn_worker` tool to spawn a sub-agent to help with the review — reviewers are not authorized to spawn workers
- `researcher-expert` used the `Edit` tool to modify source files during a research task — researcher's workflow is read-only investigation and reporting

---

## Agent Record Format

Each agent has one record file at `task-tracking/agent-records/{agent-name}-record.md`.

### Section Descriptions

| Section | Purpose |
|---------|---------|
| `## Metadata` | Identifies the agent: name, definition file path, and record creation date |
| `## Task History` | One row per task the agent worked on — task ID, date, outcome (Pass / Fail / Partial), and brief notes |
| `## Failure Log` | One row per failure event — failure tag, task ID, date, and description of what happened |
| `## Evaluation History` | One row per deliberate evaluation run — date, test task ID, result (Pass / Fail), and what changed in the agent definition |

### Outcome Values for Task History

| Value | Meaning |
|-------|---------|
| Pass | Agent completed the task within its role, output met quality bar |
| Fail | Agent triggered one or more failure log entries |
| Partial | Agent completed some work but with noted gaps; no full failure tag warranted |

### Complete Filled Example

The following is a realistic record for `backend-developer` after several tasks and one evaluation cycle.

```markdown
# Agent Record — backend-developer

## Metadata

| Field | Value |
|-------|-------|
| Name | backend-developer |
| Definition File | .claude/agents/backend-developer.md |
| Created | 2026-01-15 |

## Task History

| Task ID | Date | Outcome | Notes |
|---------|------|---------|-------|
| TASK_2026_031 | 2026-01-15 | Pass | Implemented auth service, all acceptance criteria met |
| TASK_2026_038 | 2026-01-22 | Fail | Modified CI workflow file outside role scope |
| TASK_2026_044 | 2026-02-03 | Pass | API handler batch completed cleanly |
| TASK_2026_051 | 2026-02-18 | Partial | Implemented routes but left error handling as TODO |
| TASK_2026_057 | 2026-03-01 | Pass | Database migration and repository layer complete |

## Failure Log

| Tag | Task ID | Date | Description |
|-----|---------|------|-------------|
| scope_exceeded | TASK_2026_038 | 2026-01-22 | Modified .github/workflows/ci.yml to add a build step — infrastructure files are outside backend-developer scope |
| quality_low | TASK_2026_051 | 2026-02-18 | Error handling in POST /sessions handler left as `// TODO: add error handling` comment |

## Evaluation History

| Date | Test Task ID | Result | Changes Made |
|------|-------------|--------|--------------|
| 2026-02-10 | TASK_2026_EVAL_003 | Pass | Added explicit prohibition against modifying workflow files to agent definition (line 47) |
```

---

## Usage

### Reading Records (Before Task Assignment)

Workers and the Supervisor should read the relevant agent record before assignment when:

- The agent has 3 or more prior task entries (enough signal to check for patterns)
- The task type matches a domain where past failures were logged
- The Supervisor is deciding between two candidate agents for the same task

Read the `## Failure Log` first. If the same tag appears twice or more, flag this to the team-leader before assigning. If the agent has never worked on this task type, note it as `no prior history` — not as a disqualifier.

### Writing Records (After Task Completion)

The following workers are responsible for record updates:

| Event | Who Writes | What to Append |
|-------|-----------|----------------|
| Task completes successfully | team-leader | One row to `## Task History` with outcome `Pass` |
| Task completes with failures | review-lead or team-leader | One row to `## Task History` with outcome `Fail`, plus one row per failure to `## Failure Log` |
| Task completes with minor gaps | team-leader | One row to `## Task History` with outcome `Partial`, no Failure Log entry required |
| Evaluation run completes | `/evaluate-agent` command | One row to `## Evaluation History`, update definition file if changes were made |

**Append-only rule**: Never delete or edit existing rows. Records are append-only. If a finding was incorrect, add a correction row with a note — do not remove the original entry.

**One record per agent**: Never create multiple record files for the same agent. If the file does not exist yet, create it using the template below. If it exists, append to the appropriate section.

### Record File Naming

```
task-tracking/agent-records/{agent-name}-record.md
```

Use the agent's kebab-case name exactly as it appears in the YAML `name` field of the agent definition file. Examples: `backend-developer-record.md`, `code-logic-reviewer-record.md`.
