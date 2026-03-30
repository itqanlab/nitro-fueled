# Task: Evaluation Review Scoring and Report Generation

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| preferred_tier        | balanced       |
| Model                 | claude-opus-4-6 |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Build the review scoring and report generation layer for the Model Evaluation Pipeline. After Build Workers complete benchmark tasks, this phase spawns Review Workers to score the output against the benchmark requirements checklist, then aggregates all metrics into a structured evaluation report.

This is Part 4 of 4 of the Model Evaluation Pipeline feature.

### What to Build

1. **Review scoring integration**:
   - After each Build Worker completes, spawn a Review Worker on the output
   - Reviewer compares the implementation against the benchmark task's requirements checklist
   - Scores each dimension: code quality (1-10), logic correctness (1-10), style (1-10)
   - Stores per-task review scores in `evaluations/<session>/per-task/`

2. **Report generation** (`evaluation-report.md`):
   - **Capability matrix**: building score, reviewing score, overall (for role "both" mode)
   - **Per-task breakdown**: individual scores, time, retries, pass/fail
   - **Cost summary**: tokens and estimated dollars per task (if available)
   - **Speed summary**: average time per task, per difficulty tier
   - **Retry/failure analysis**: which tasks needed retries, which failed outright
   - **Speed vs Quality vs Cost tradeoff table**: a single comparison table that shows each model's average speed, quality score, cost per task, and a computed Value Score (quality/cost ratio). This is the primary decision-making artifact — it answers "which model gives the best results for the money?" Include:
     - Per-difficulty-tier breakdown (a model might be cost-effective for easy tasks but wasteful for hard ones)
     - Per-role breakdown (builder value vs reviewer value)
     - Explicit tradeoff callouts (e.g., "Model X is 30% cheaper but 15% lower quality")
   - **Recommendation**: adopt / don't adopt / use for specific role — derived from the tradeoff analysis, not just raw scores. Should include role-specific recommendations (e.g., "use as reviewer but not builder") and tier-specific recommendations (e.g., "use for easy/medium tasks only")

3. **Machine-readable output** (`metrics.json`):
   - All metrics in JSON format for future cross-evaluation comparison
   - Schema designed for diffing two evaluation runs
   - Must include computed tradeoff scores (value ratio, per-tier averages) so external tools can consume them without re-computing

4. **History support**:
   - Results persist in `evaluations/` directory (never auto-cleaned)
   - Each run has its own subdirectory with timestamp and model name

## Dependencies

- TASK_2026_124 — Evaluation Supervisor Single Model Mode (provides execution metrics and per-task results)
- TASK_2026_125 — A/B and Role Testing (provides dual-model results to compare)

## Acceptance Criteria

- [ ] Review Workers are spawned on Build Worker output and score against requirements checklist
- [ ] evaluation-report.md generated with capability matrix, per-task breakdown, and recommendation
- [ ] metrics.json generated with machine-readable metrics
- [ ] Reports support both single-model and A/B comparison formats
- [ ] Results persist in evaluations/ directory with clear naming

## References

- This task is Part 4 of 4 — Model Evaluation Pipeline for Auto-Pilot
- Review Lead agent: `.claude/agents/nitro-review-lead.md`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Evaluation Supervisor: TASK_2026_124, TASK_2026_125

## File Scope

- .claude/skills/auto-pilot/SKILL.md (modified — added E8/E9/E10 sections, modified E7, added Scoring Worker Prompt template)
- task-tracking/TASK_2026_126/context.md (created)
- task-tracking/TASK_2026_126/implementation-plan.md (created)
- task-tracking/TASK_2026_126/tasks.md (created)
- evaluations/ (report output directory — runtime artifacts)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_124 or TASK_2026_125 — all modify `.claude/skills/auto-pilot/SKILL.md`
Suggested wave: Wave 4, after TASK_2026_125 completes
