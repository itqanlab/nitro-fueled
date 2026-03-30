# Task: Add Phase-Boundary Git Commits to Orchestration Pipeline

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | default     |
| Testing    | skip        |

## Description

Planning artifacts (context.md, task-description.md, implementation-plan.md), review artifacts (review-*.md), new task folders from /create-task, and retrospective files are all created during the orchestration pipeline but never committed. This causes orphaned uncommitted files that pile up across sessions and clutter git status with dozens of untracked files unrelated to any active work.

The fix is to add one git commit instruction at each phase transition boundary in the pipeline. This ensures:
1. Crash recovery works — each phase's output is persisted before the next agent starts
2. The continuation/phase detection table (which decides next action based on which files exist) works correctly after recovery
3. Clean git history with small, logical commits per phase

## Changes Required

### 1. Orchestration SKILL.md — 3 commit points

- **After Phase 0 (task init)**: commit context.md + status file
  - Message: `docs(tasks): create TASK_YYYY_NNN — {title}`
- **After PM completes**: commit task-description.md
  - Message: `docs(tasks): add requirements for TASK_YYYY_NNN`
- **After Architect completes**: commit implementation-plan.md
  - Message: `docs(tasks): add implementation plan for TASK_YYYY_NNN`

### 2. Review Lead agent (nitro-review-lead.md) — 1 commit point

- **After all review sub-workers complete, before fix phase**: commit all review-*.md files
  - Message: `docs(tasks): add review reports for TASK_YYYY_NNN`

### 3. /create-task command (create-task.md) — 1 commit point

- **After task folder + status file created**: commit the new task folder
  - Message: `docs(tasks): create TASK_YYYY_NNN — {title}`

### 4. /retrospective command (retrospective.md) — 1 commit point

- **After retrospective file written**: commit the retro file
  - Message: `docs(retro): add RETRO_{date} retrospective`

## Dependencies

- None

## Acceptance Criteria

- [ ] Orchestration SKILL.md has commit instructions after Phase 0, PM phase, and Architect phase
- [ ] nitro-review-lead.md commits review artifacts before entering fix phase
- [ ] /create-task command commits new task folder after creation
- [ ] /retrospective command commits retrospective file after writing
- [ ] All commit messages follow `docs(tasks):` or `docs(retro):` prefix convention

## Parallelism

- Can run in parallel with TASK_2026_109 through TASK_2026_112 (no file scope overlap)
- Touches only orchestration infrastructure files, not application code

## References

- `.claude/skills/orchestration/SKILL.md` — Phase 0, PM phase, Architect phase
- `.claude/agents/nitro-review-lead.md` — review aggregation phase
- `.claude/commands/create-task.md` — task creation flow
- `.claude/commands/retrospective.md` — retrospective flow

## File Scope

**Files Modified:**
- `.claude/skills/orchestration/SKILL.md` — Added Phase 0, Post-PM, Post-Architect commit instructions
- `.claude/agents/nitro-review-lead.md` — Added review artifacts commit instruction
- `.claude/commands/nitro-create-task.md` — Added task creation commit instruction
- `.claude/commands/nitro-retrospective.md` — Added retrospective artifacts commit instruction
