# Task: Evaluation Supervisor — A/B Comparison and Role Testing

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

Extend the evaluation mode (built in TASK_2026_124) with A/B comparison and role-based testing. This enables users to compare two models side-by-side on the same benchmark tasks, and to test a model specifically as a Builder, Reviewer, or both.

This is Part 3 of 4 of the Model Evaluation Pipeline feature.

### What to Build

1. **A/B comparison mode**: `--compare <baseline-model>` flag
   - Runs the same benchmark tasks in parallel worktrees for both models
   - Same metrics collection for both
   - Results stored in `evaluations/<date>-<modelA>_vs_<modelB>/`

2. **Role testing**: `--role builder|reviewer|both` flag
   - `builder` (default for single model): model under test as Build Worker, baseline as Reviewer
   - `reviewer`: baseline model as Build Worker, model under test as Review Worker
   - `both`: two passes — tests the model in both roles independently
   - When testing as reviewer: spawns Build Workers with the baseline model to produce known-good code, then spawns Review Workers with the test model to evaluate that code

3. **Reviewer model override**: `--reviewer <model-id>` flag
   - Overrides which model is used for Review Workers in the evaluation
   - Defaults to baseline model (or system default if no --compare)

### Design Considerations

- A/B mode doubles the number of workers — ensure worktrees are isolated per model
- Role "both" means two full passes through the benchmark suite — ensure results are clearly separated in the output
- Must work cleanly with the single-model mode from TASK_2026_124 (additive, not breaking)

## Dependencies

- TASK_2026_124 — Evaluation Supervisor Single Model Mode (provides the base evaluation loop)

## Acceptance Criteria

- [ ] `--compare <baseline>` runs same tasks on both models in parallel worktrees
- [ ] `--role builder|reviewer|both` controls which role the model is tested in
- [ ] `--reviewer <model>` overrides the reviewer model
- [ ] A/B results stored separately with clear model labeling
- [ ] Role "both" produces separate builder and reviewer scores

## References

- This task is Part 3 of 4 — Model Evaluation Pipeline for Auto-Pilot
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Single model evaluation: TASK_2026_124

## File Scope

- .claude/skills/auto-pilot/SKILL.md (modified — evaluation mode sections E1-E7, modes table, review worker prompt template)
- .claude/commands/nitro-auto-pilot.md (modified — usage examples, parameters table, argument parsing, quick reference)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_124 — both modify `.claude/skills/auto-pilot/SKILL.md`
Suggested wave: Wave 3, after TASK_2026_124 completes
