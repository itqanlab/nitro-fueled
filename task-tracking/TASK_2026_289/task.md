# Task: Worker Prompts: MCP-Only Artifact Access (Eliminate File I/O)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
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

Update all worker prompt templates to use MCP artifact tools exclusively instead of reading/writing files in task-tracking/. Build Worker: replace Write task-tracking/TASK_YYYY_NNN/status with update_task MCP call, replace Write handoff.md with write_handoff MCP call, remove git add of task-tracking files. Prep Worker: replace Write prep-handoff.md with write_handoff(worker_type=prep), replace Write status with update_task. Implement Worker: replace Read prep-handoff.md with read_handoff, replace Write handoff.md with write_handoff. Review+Fix Worker: replace Write review-*.md with write_review MCP calls, replace Read review files with read_reviews, replace Write completion-report.md with write_completion_report, replace Write test-report.md with write_test_report. Eliminate the status file concept — workers only call update_task for state changes.

## Dependencies

- TASK_2026_288

## Acceptance Criteria

- [ ] Zero references to Read/Write task-tracking/TASK_YYYY_NNN/ in any worker prompt
- [ ] All state changes use update_task MCP call only (no status file writes)
- [ ] All artifact reads/writes use MCP tools (no file reads/writes)
- [ ] Worker exit gates verify artifacts via MCP (not file existence checks)

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/references/worker-prompts.md
- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/orchestration/SKILL.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_288 — depends on MCP tools being available.
