# Task: Updated Pipeline Flow — Parallel Review + Test with Fix Phase

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

Update the auto-pilot supervisor and orchestration pipeline to support the new parallel Review Lead + Test Lead flow. Currently the pipeline is:

```
Build Worker → Review Worker → Complete
```

The new pipeline is:

```
Build Worker → Review Lead ──┐ parallel → Fix Worker (if needed) → Complete
              Test Lead   ──┘
```

This task handles the supervisor-side changes to support the new flow. It does NOT implement the Review Lead or Test Lead themselves (those are TASK_2026_035 and TASK_2026_036).

### Changes to supervisor state machine

**Current states:**
```
CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE (or FAILED)
```

**New states:**
```
CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → FIXING → COMPLETE (or FAILED)
                                          │
                                    (Review Lead + Test Lead
                                     run in parallel)
```

- `IN_REVIEW` now means both Review Lead and Test Lead are active
- `FIXING` is a new state: fix worker is addressing findings from both reviews and tests
- Supervisor waits for BOTH leads to complete before transitioning out of IN_REVIEW

### Changes required

**Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`):
1. After IMPLEMENTED, spawn Review Lead AND Test Lead in parallel
2. Track both as active workers for the same task
3. Wait for both to complete before deciding next step
4. Decision logic after both complete:
   - Both clean (no blocking findings, tests pass) → COMPLETE
   - Findings or test failures → spawn Fix Worker → FIXING
   - Fix Worker completes → re-run tests → COMPLETE (or FAILED if max retries)
5. Update orchestrator-state.md Active Workers table to support multiple workers per task

**State machine updates**:
6. Add FIXING state to valid transitions
7. Update registry.md state documentation
8. Update task-template.md state documentation

**Orchestration skill** (`.claude/skills/orchestration/SKILL.md`):
9. Update pipeline documentation to show parallel Review + Test flow
10. Update Exit Gate to require both review reports AND test report

**Fix Worker prompt**:
11. Fix Worker reads both review reports and test report
12. Prioritizes: test failures first (broken code), then blocking review findings, then serious
13. Commits fixes
14. If test fixes needed: re-runs test suite to verify

### Edge cases

- **No test framework**: Test Lead exits immediately with "no tests required". Supervisor treats this as Test Lead complete.
- **Test Lead fails but Review Lead succeeds**: Supervisor can proceed with review findings, log test failure as warning.
- **Review Lead fails but Test Lead succeeds**: Supervisor retries Review Lead. Test results preserved.
- **Task has `Testing: skip`**: Supervisor only spawns Review Lead (current behavior).

## Dependencies

- TASK_2026_035 — Review Lead (must exist to be spawned)
- TASK_2026_036 — Test Lead (must exist to be spawned)

## Acceptance Criteria

- [ ] Supervisor spawns Review Lead and Test Lead in parallel after IMPLEMENTED
- [ ] Supervisor tracks multiple active workers for the same task
- [ ] Supervisor waits for both leads before transitioning from IN_REVIEW
- [ ] FIXING state added to state machine with proper transitions
- [ ] Fix Worker spawned when findings or test failures exist
- [ ] Fix Worker addresses both review findings and test failures
- [ ] Tasks without test framework skip Test Lead gracefully
- [ ] Pipeline documentation updated to reflect new flow
- [ ] Exit Gate updated to require review reports + test report

## References

- `.claude/skills/auto-pilot/SKILL.md` — supervisor state machine and spawn logic
- `.claude/skills/orchestration/SKILL.md` — pipeline phases
- `TASK_2026_035` — Review Lead
- `TASK_2026_036` — Test Lead
