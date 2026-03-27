# Task: `/evaluate-agent` Command

## Metadata

| Field      | Value                                                                         |
|------------|-------------------------------------------------------------------------------|
| Type       | FEATURE                                                                       |
| Priority   | P1-High                                                                       |
| Complexity | Medium                                                                        |
| Model      | default                                                                       |
| Testing    | skip                                                                          |

## Description

Build the `/evaluate-agent <agent-name>` command that runs the full calibration loop for any agent: read its record, generate a targeted test task, run it through the pipeline, score the result, update the agent definition if it fails, and record everything.

### The loop

1. **Read** the agent's record from `task-tracking/agent-records/{agent-name}-record.md`
2. **Identify** the most frequent failure tag from the failure log (or use a generic quality test if no failures recorded yet)
3. **Generate** a small targeted `task.md` that exercises the agent's known weak area — scoped to a single simple scenario the agent should handle correctly
4. **Run** the task through the orchestration pipeline (single-agent mode — only the agent under evaluation, no full PM→Dev chain)
5. **Score** the output against the quality bar:
   - Did it stay in scope? (scope check)
   - Did it follow its instructions? (instruction check)
   - Is the output quality adequate? (quality check)
6. **If pass**: write eval result to record, done
7. **If fail**: identify what failed (map to failure taxonomy tag), update the agent's `.md` definition with a targeted fix for that failure pattern, write changes to record, re-run from step 3
8. **Loop** up to 3 iterations. After 3 consecutive failures: mark agent as `FLAGGED` in record, print a clear human-readable summary of what kept failing and what was tried, stop

The quality bar is: output scope correct, instructions followed, output quality adequate. All three must pass.

### Record update format

Each evaluation appends to the agent record's `## Evaluation History` section:

```
### Eval YYYY-MM-DD
- Test task: TASK_YYYY_NNN (or inline description if no task ID)
- Trigger: [failure tag that prompted this eval, or "initial"]
- Result: PASS | FAIL
- Failures found: [list of failure tags, or "none"]
- Changes made: [description of what was updated in agent .md, or "none"]
- Iteration: N of 3
```

## Dependencies

- TASK_2026_061 — provides the record schema and taxonomy that this command reads and writes

## Parallelism

⚠️ Run after TASK_2026_061 completes. Depends on the record format and taxonomy definitions.

## Acceptance Criteria

- [ ] `.claude/commands/evaluate-agent.md` command file exists and is invokable as `/evaluate-agent <name>`
- [ ] Command reads the agent record and surfaces known failure patterns before generating the test
- [ ] Test task is generated targeting the top failure tag (or a generic quality test if no failures recorded)
- [ ] Evaluation scores against all three quality bar dimensions: scope, instructions, quality
- [ ] Eval result (pass/fail, what failed, what was changed) is written to agent record in the specified format
- [ ] Agent `.md` definition is updated with a targeted instruction fix on failure
- [ ] Re-evaluation loop runs up to 3 iterations before flagging
- [ ] After 3 failures, agent is marked `FLAGGED` in record with a human-readable summary
- [ ] Command works on any of the 22 agents by name

## References

- `.claude/skills/orchestration/references/agent-calibration.md` — taxonomy and record format (TASK_2026_061)
- `task-tracking/agent-records/` — per-agent records
- `.claude/agents/` — agent definitions to read and potentially update
- `.claude/commands/` — where the command file lives

## File Scope

- `.claude/commands/evaluate-agent.md` (new)
