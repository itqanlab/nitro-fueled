# Task: /create-agent Command with Catalog Integration

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | FEATURE   |
| Priority   | P1-High   |
| Complexity | Medium    |

## Description

Build the `/create-agent` command that generates new developer agents from the canonical template. This is the user-facing entry point for on-demand agent generation.

The command reads `developer-template.md` and `stack-detection-registry.md` (from TASK_2026_015), gathers agent info (interactively or from arguments), populates template variables using AI knowledge of the target stack, writes the agent file, and updates the agent catalog.

Includes the **Agent Catalog Update Protocol** — instructions for updating all 4 sections of `agent-catalog.md` when a new agent is generated.

Split from TASK_2026_006 (CANCELLED — too large for a single worker session).

## Dependencies

- TASK_2026_015 — Stack Detection Registry and Developer Template (this command reads both files)

## Acceptance Criteria

- [ ] `create-agent.md` exists at `.claude/commands/`
- [ ] Under 200 lines
- [ ] Follows thin-wrapper command pattern from `create-task.md`
- [ ] Pre-flight checks verify required files exist and agent doesn't already exist
- [ ] Reads `developer-template.md` as source of truth (never hardcodes template)
- [ ] Supports interactive mode (`/create-agent`) and pre-filled mode (`/create-agent [name] [description]`)
- [ ] Agent Catalog Update Protocol covers all 4 sections: Capability Matrix, Development Agents entry, Category Summary, header count
- [ ] Also updates `orchestrate.md` Quick Reference agent list
- [ ] Validates generated agent has all 14 required sections and is under 400 lines

## References

- TASK_2026_006 implementation plan: `task-tracking/TASK_2026_006/implementation-plan.md` (Components 3 & 5)
- TASK_2026_006 tasks.md: `task-tracking/TASK_2026_006/tasks.md` (Batch 3, Task 3.1)
- Command pattern: `.claude/commands/create-task.md`
- Agent catalog: `.claude/skills/orchestration/references/agent-catalog.md`
