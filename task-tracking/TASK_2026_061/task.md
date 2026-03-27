# Task: Agent Record Schema and Failure Taxonomy

## Metadata

| Field      | Value                                                                         |
|------------|-------------------------------------------------------------------------------|
| Type       | FEATURE                                                                       |
| Priority   | P1-High                                                                       |
| Complexity | Simple                                                                        |
| Model      | default                                                                       |
| Testing    | skip                                                                          |

## Description

Define the data structure for agent records and the failure taxonomy that powers the agent calibration system. No code — this task is pure schema design and documentation.

Create `task-tracking/agent-records/` as the home for per-agent record files (one `{agent-name}-record.md` per agent). Define the record format covering: agent metadata (name, definition file path), task history (task IDs the agent ran on, outcome), failure log (failure tag, task ID, date, description), and evaluation history (date, test task ID, result, changes made to agent definition).

Define the failure taxonomy with exactly 4 tags:
- `scope_exceeded` — agent touched files or made decisions outside its defined role
- `instruction_ignored` — agent did not follow explicit instructions in its definition
- `quality_low` — agent output did not meet the quality bar (incomplete, incorrect, or poorly structured)
- `wrong_tool_used` — agent used tools or methods outside its expected workflow

Document the schema and taxonomy in `.claude/skills/orchestration/references/agent-calibration.md` so the `/evaluate-agent` command (TASK_2026_062) and future workers can reference it.

Create initial empty record files for all 22 existing agents under `task-tracking/agent-records/`.

## Dependencies

- None

## Parallelism

✅ Can run in parallel with any current backlog task. Only creates new files, touches nothing existing.

## Acceptance Criteria

- [ ] `agent-calibration.md` reference doc exists with full taxonomy definitions (each tag defined with examples)
- [ ] Record format fully specified in `agent-calibration.md` with a filled example
- [ ] `task-tracking/agent-records/` exists with one empty record `.md` per agent (all 22 agents)

## References

- `.claude/agents/` — 22 agent definitions (the agents to create records for)
- `.claude/skills/orchestration/references/` — where to place the reference doc
- TASK_2026_062 — the `/evaluate-agent` command that consumes these records

## File Scope

- `.claude/skills/orchestration/references/agent-calibration.md` (new)
- `task-tracking/agent-records/*.md` (22 new files, one per agent)
