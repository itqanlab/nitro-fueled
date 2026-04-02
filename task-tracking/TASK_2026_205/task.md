# Task: Write Prep Worker prompt and exit gate


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






## Description

Create the Prep Worker prompt in worker-prompts.md. The Prep Worker runs pre-implementation phases (PM → Researcher → Architect → Team Leader MODE 1) and produces prep-handoff.md.

The prompt must:
- Run PM, optional Researcher, Architect, Team Leader MODE 1 phases
- Write prep-handoff.md with 5 sections: Implementation Plan Summary, Files to Touch, Batches, Key Decisions, Gotchas
- Call write_handoff(task_id, worker_type='prep') via cortex MCP
- Set status to PREPPED and commit all planning artifacts
- Use nitro-software-architect as agent, default to sonnet model

Define exit gate: plan.md exists, tasks.md has batches, prep-handoff.md has all 5 sections, status=PREPPED.

## Dependencies

- TASK_2026_208 — needs PREPPED status and Worker Mode field in template/docs
- TASK_2026_207 — needs prep handoff schema in cortex MCP

## Acceptance Criteria

- [ ] Prep Worker prompt section exists in worker-prompts.md with full phase sequence
- [ ] prep-handoff.md format documented with all 5 sections
- [ ] Exit gate checks defined matching the prep handoff contract
- [ ] Cortex write_handoff call with worker_type='prep' included in prompt
- [ ] Status transition CREATED → IN_PROGRESS → PREPPED documented

## References

- task-tracking/task-template.md

## File Scope

- .claude/skills/auto-pilot/references/worker-prompts.md


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_206 — both modify worker-prompts.md
