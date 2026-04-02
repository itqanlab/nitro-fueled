# Task: Prep Worker: Task Decomposition into Subtasks


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Update the Prep Worker prompt and orchestration skill to analyze a parent task and decompose it into subtasks when complexity warrants it.

Decomposition logic:
- **Simple tasks**: No decomposition -- Prep Worker proceeds as before (single implement worker)
- **Medium tasks**: Prep Worker MAY decompose if the task spans multiple files/concerns. Decision is part of the analysis.
- **Complex tasks**: Prep Worker SHOULD decompose into 2-5 subtasks, each targeting a single concern/layer.

For each subtask the Prep Worker creates:
- Title and description (scoped to one concern)
- file_scope (which files this subtask touches)
- Complexity rating (Simple/Medium -- subtasks should never be Complex)
- Suggested model based on subtask complexity
- Dependencies on other subtasks within the parent (e.g., subtask 2 depends on subtask 1 if it builds on its output)

The Prep Worker calls `bulk_create_subtasks` MCP tool to create all subtasks at once. After decomposition, the Prep Worker writes a handoff noting that the parent task has been decomposed and the Supervisor should schedule subtasks.

The orchestration skill must be updated to recognize when a Prep Worker has created subtasks -- the parent task status moves to a new intermediate state or the Supervisor detects subtasks exist and switches to subtask scheduling mode.

## Dependencies

- TASK_2026_263 -- provides create_subtask and bulk_create_subtasks MCP tools

## Acceptance Criteria

- [ ] Prep Worker prompt includes decomposition analysis section that evaluates whether to split a task into subtasks
- [ ] Prep Worker calls bulk_create_subtasks to create subtasks with title, description, file_scope, complexity, model, and intra-parent dependencies
- [ ] Simple tasks pass through without decomposition (existing behavior preserved)
- [ ] Orchestration skill detects subtask creation and signals Supervisor to schedule subtasks instead of a single implement worker

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/orchestration/SKILL.md (modified -- prep worker decomposition section)
- .claude/agents/nitro-team-leader.md (modified -- add decomposition instructions for MODE 1)
- .claude/skills/orchestration/references/prep-worker-prompt.md (modified or new -- decomposition prompt)


## Parallelism

Cannot run in parallel with TASK_2026_263 (depends on it). No file overlap with other tasks.
