# Task: End-to-End Test on Fresh Project

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | RESEARCH   |
| Priority   | P0-Critical |
| Complexity | Complex    |

## Description

Install nitro-fueled into a brand new project and validate the entire pipeline works end-to-end. This is the final validation before the package can be considered ready.

**Test plan:**

1. **Create a fresh project**: Set up a new Node.js (or other stack) project in an empty directory

2. **Run init**: `npx nitro-fueled init` — verify scaffold, stack detection, agent generation

3. **Create tasks via Planner**: Run `/plan` to create 2-3 small tasks through discussion

4. **Run Supervisor**: `npx nitro-fueled run` — verify:
   - Build Workers spawn and implement tasks
   - Workers mark tasks IMPLEMENTED
   - Review Workers spawn for implemented tasks
   - Workers mark tasks COMPLETE
   - Supervisor handles the full lifecycle

5. **Verify artifacts**: Check that all expected files were created (context.md, task-description.md, implementation-plan.md, tasks.md, review files, completion-report.md)

6. **Test failure recovery**: Kill a worker mid-task, verify Supervisor retries

7. **Test status**: `npx nitro-fueled status` shows accurate state

**Document all findings**: What worked, what broke, what needs fixing. Create follow-up tasks for any issues found.

## Dependencies

- TASK_2026_009 — init command must work
- TASK_2026_010 — run command must work
- TASK_2026_013 — MCP handling must work

## Acceptance Criteria

- [ ] Fresh project initialized successfully with `npx nitro-fueled init`
- [ ] Stack detection proposes correct agents for the project
- [ ] Tasks created via `/plan` are well-scoped
- [ ] Supervisor processes tasks through full lifecycle (CREATED → IMPLEMENTED → COMPLETE)
- [ ] Build Workers and Review Workers spawn correctly
- [ ] State transitions happen as expected
- [ ] Worker failure triggers retry
- [ ] `npx nitro-fueled status` shows accurate state
- [ ] All task artifacts created (reviews, completion reports)
- [ ] Follow-up tasks created for any issues found

## References

- All CLI commands (init, run, status, create)
- Supervisor SKILL.md: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
- Planner: `.claude/agents/planner.md`
