# Task: Test Lead — Parallel Test Writing and Execution with Model Routing

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Complex     |

## Description

Add a Test Lead to the orchestration pipeline. Currently the "QA" phase is code review only — no one writes or runs actual tests. The Test Lead spawns parallel test workers that write and execute tests, then reports results.

### Proposed flow

```
Supervisor → Build Worker (implements code)
          → Review Lead (parallel code reviews)    ──┐ can run in parallel
          → Test Lead (parallel test writing + run) ──┘
```

### How the Test Lead works

**1. Startup**
- Spawned by Supervisor after task reaches IMPLEMENTED
- Reads task folder: `task.md`, `design-handoff.md`, `tasks.md`, committed code
- Detects test framework from project config (package.json, vitest.config, jest.config, playwright.config, etc.)
- Determines which test types are needed based on task type and what changed

**2. Test type decision matrix**

| Task Type | Unit Tests | Integration Tests | E2E Tests |
|-----------|-----------|-------------------|-----------|
| FEATURE | Yes | If has API/DB | If has UI |
| BUGFIX | Yes (regression test) | If touches API | No |
| REFACTORING | Yes (verify no regression) | If touches boundaries | No |
| CREATIVE | No | No | Optional (visual) |
| DEVOPS | No | Yes (pipeline test) | No |

The Test Lead skips itself entirely for task types that don't need tests (CREATIVE with no framework, DOCUMENTATION). It writes a brief `test-report.md` noting "no tests required" and exits.

**3. Spawn test writers (parallel)**

| Worker | Model | What it does |
|--------|-------|-------------|
| Unit Test Writer | Sonnet | Writes unit tests for new/changed functions. Template-driven, high coverage. |
| Integration Test Writer | Opus | Writes integration tests for cross-boundary interactions (API routes, DB queries, service interactions). Needs deep understanding. |
| E2E Test Writer | Sonnet | Writes e2e/UI tests using the project's e2e framework (Playwright, Cypress). Template-driven. |

Each writer:
- Reads the implementation code + design-handoff.md
- Reads existing test patterns in the codebase (convention matching)
- Writes test files following project conventions
- Commits test files

**4. Test execution**
- After all writers complete, Test Lead runs the test suite (`npm test`, `npx vitest`, etc.)
- Captures pass/fail results
- If tests fail: analyzes failures, either fixes tests (if test bug) or flags implementation issues

**5. Reporting**
- Writes `test-report.md` to task folder:
  - Tests written (count by type)
  - Test results (pass/fail/skip)
  - Coverage delta (if coverage tool available)
  - Any implementation issues found
- If implementation issues found: writes findings to task folder for the Review Lead or Supervisor to act on

### Integration with orchestration pipeline

The Test Lead runs **in parallel with the Review Lead** — they're independent:
- Review Lead reads code and writes review reports
- Test Lead writes tests and runs them
- Neither depends on the other's output
- Both can spawn sub-workers simultaneously

After both complete, the Supervisor:
1. Checks review reports — any blocking findings?
2. Checks test report — any failing tests?
3. If issues: spawns a Fix Worker to address both review findings and test failures
4. If clean: proceeds to completion

### Changes required

**Auto-pilot skill** (`.claude/skills/auto-pilot/SKILL.md`):
1. After IMPLEMENTED, spawn Review Lead AND Test Lead in parallel (not sequential)
2. Wait for both to complete before proceeding to fix/completion phase
3. Add test-related state transitions and health checks

**New agent**: `.claude/agents/test-lead.md`
4. Test Lead agent definition with orchestration instructions
5. Test framework detection logic
6. Test type decision matrix
7. Sub-worker prompt templates for each test type

**New agents**: `.claude/agents/unit-tester.md`, `.claude/agents/integration-tester.md`
8. Focused test writer agents that follow project conventions
9. Read implementation + design, write tests, commit

**Task template** (`task-tracking/task-template.md`):
10. Add optional `Testing` field: `required | optional | skip` (default: based on task type matrix)

**Orchestration skill** (`.claude/skills/orchestration/SKILL.md`):
11. Document the test phase in the pipeline
12. Update Exit Gate to include test results check

### Stack detection for test frameworks

Test Lead needs to detect available test tools:

| Detection | Framework |
|-----------|-----------|
| `vitest` in package.json | Vitest |
| `jest` in package.json | Jest |
| `playwright` in package.json | Playwright |
| `cypress` in package.json | Cypress |
| `pytest` in requirements.txt | pytest |
| `go test` (Go project) | Go testing |
| No test framework found | Skip tests, recommend setup |

## Dependencies

- TASK_2026_035 — Review Lead (establishes the Lead→sub-worker pattern; Test Lead reuses same pattern)
- TASK_2026_020 — Per-Task Model Selection (model routing for sub-workers)

## Acceptance Criteria

- [ ] Test Lead agent created with framework detection and test type decision matrix
- [ ] Test Lead spawns parallel test writers via MCP with appropriate models
- [ ] Unit Test Writer produces tests following project conventions
- [ ] Integration Test Writer produces cross-boundary tests
- [ ] Test Lead executes test suite after writers complete
- [ ] `test-report.md` written to task folder with results and coverage
- [ ] Test Lead runs in parallel with Review Lead (not sequential)
- [ ] Tasks with `Testing: skip` or CREATIVE type skip test phase gracefully
- [ ] Implementation issues found by tests are flagged for fix phase
- [ ] Test framework auto-detected from project config

## References

- `.claude/agents/senior-tester.md` — existing tester agent (currently unused in auto-pilot flow)
- `.claude/skills/orchestration/SKILL.md` — pipeline phases
- `.claude/skills/auto-pilot/SKILL.md` — supervisor spawn logic
- `TASK_2026_035` — Review Lead (same Lead→sub-worker pattern)
- `.claude/skills/orchestration/references/stack-detection-registry.md` — stack detection patterns
