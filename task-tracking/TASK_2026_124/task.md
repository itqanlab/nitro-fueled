# Task: Evaluation Supervisor — Single Model Mode

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Complex        |
| preferred_tier        | heavy          |
| Model                 | claude-opus-4-6 |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Add the `--evaluate <model-id>` flag to the Auto-Pilot Supervisor. When this flag is present, the Supervisor enters evaluation mode: it reads benchmark tasks from `benchmark-suite/`, creates isolated worktree(s), spawns Build Workers using the specified model, collects execution metrics, and stores results.

This is Part 2 of 4 of the Model Evaluation Pipeline feature. This task covers single-model evaluation only — A/B comparison and role testing come in Part 3.

### What to Build

1. **Flag parsing** in auto-pilot skill: `--evaluate <model-id>` enters evaluation mode
2. **Benchmark task loader**: reads `benchmark-suite/config.md` and task directories, converts them into the format the Supervisor expects
3. **Worktree isolation**: each evaluation run creates an isolated git worktree so benchmark tasks don't pollute the real codebase
4. **Worker spawning**: spawns Build Workers for each benchmark task using the target model (overrides the task.md Model field)
5. **Metrics collection**: for each worker, track:
   - Wall-clock time (spawn to completion)
   - Success/failure status
   - Retry count
   - Compaction count (if available from MCP)
6. **Results storage**: write per-task results to `evaluations/<date>-<model>/per-task/`
7. **Evaluation session directory**: `evaluations/<date>-<model>/` with session metadata

### Integration Points

- Extends `.claude/skills/auto-pilot/SKILL.md` (new mode, not replacing existing behavior)
- Uses MCP session-orchestrator `spawn_worker` with model override
- Uses `benchmark-suite/` tasks created by TASK_2026_123

## Dependencies

- TASK_2026_123 — Benchmark Suite (provides the tasks to evaluate against)

## Acceptance Criteria

- [ ] `--evaluate <model-id>` flag is recognized by auto-pilot and enters evaluation mode
- [ ] Benchmark tasks are loaded from benchmark-suite/ and spawned as Build Workers
- [ ] Workers run in isolated worktree(s)
- [ ] Per-task metrics (time, success, retries) are collected and stored
- [ ] Results directory `evaluations/<date>-<model>/` is created with per-task results

## References

- This task is Part 2 of 4 — Model Evaluation Pipeline for Auto-Pilot
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- MCP session-orchestrator: `apps/session-orchestrator/`
- Benchmark suite: TASK_2026_123

## File Scope

- .claude/skills/auto-pilot/SKILL.md (modified — added Evaluation Mode section, Evaluation Build Worker Prompt Template, Evaluate entry in Modes table)
- .claude/commands/nitro-auto-pilot.md (modified — added --evaluate flag, parameter, parsing, evaluation mode handler, Quick Reference update)
- evaluations/ (new directory, created at runtime by the evaluation flow)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_125 — both modify `.claude/skills/auto-pilot/SKILL.md`
Suggested wave: Wave 2, after TASK_2026_123 completes
