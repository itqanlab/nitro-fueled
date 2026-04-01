# Task: Skip pre-flight file dependency guardrail when WORKER_ID is in prompt


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Orchestration workers currently run a file-based dependency guardrail (reads registry.md + task.md + N status files) even when spawned by the Supervisor, which has already pre-validated all dependencies. This is redundant and wastes tokens on every worker spawn.

## What to change
- Add one rule to orchestration SKILL.md Step B (pre-flight): 'If WORKER_ID is present in your prompt, the Supervisor has already validated dependencies — skip the file-based dependency check entirely'
- The guardrail remains active for manually-spawned workers (no WORKER_ID in prompt)

## Acceptance Criteria
- Rule added to orchestration SKILL.md pre-flight section
- Supervisor-spawned workers skip file-based dependency reads
- Manually-spawned workers still run the full guardrail

## Dependencies

- TASK_2026_327

## Acceptance Criteria

- [ ] Pre-flight skip rule added to SKILL.md
- [ ] Rule conditioned on WORKER_ID presence in prompt
- [ ] Manual workers still run full dependency guardrail

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/orchestration/SKILL.md


## Parallelism

Independent. Can run in parallel with TASK_2026_326.
