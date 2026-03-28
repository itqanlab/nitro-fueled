# Context — TASK_2026_126

## User Intent
Build the review scoring and report generation layer for the Model Evaluation Pipeline (Part 4 of 4). After Build Workers complete benchmark tasks, spawn Review Workers to score output, then aggregate metrics into structured evaluation reports.

## Strategy
FEATURE — PM -> Architect -> Team-Leader -> Dev

## Complexity
Medium

## Key Requirements
1. Review scoring integration — spawn Review Workers on Build Worker output, score against requirements checklist
2. Report generation — evaluation-report.md with capability matrix, per-task breakdown, speed vs quality vs cost tradeoff table, recommendations
3. Machine-readable output — metrics.json with schema for diffing evaluation runs
4. History support — results persist in evaluations/ directory

## Files in Scope
- .claude/skills/auto-pilot/SKILL.md (primary — add new evaluation steps E8-E10)
- .claude/commands/nitro-auto-pilot.md (may need minor updates)

## Dependencies
- TASK_2026_124 (COMPLETE) — Single model evaluation mode
- TASK_2026_125 (IN_PROGRESS) — A/B comparison and role testing
