# Context — TASK_2026_123

## User Intent

Create a generic benchmark suite of reusable evaluation tasks that can be used to test AI model capabilities. The benchmark suite is the foundation for the Model Evaluation Pipeline (TASK_2026_123-126), which enables testing any model as a Builder, Reviewer, or both, with A/B comparison support.

The benchmark tasks must be project-agnostic (work in any JS/TS repo), span difficulty tiers (easy/medium/hard) and task types (feature/bugfix/refactoring), and include requirements checklists that reviewers can score against.

## Strategy

FEATURE flow: PM -> Architect -> Team-Leader -> QA

## Key Constraints

- Tasks MUST be project-agnostic — no project-specific imports or assumptions
- Requirements checklists must be specific enough for automated reviewer scoring
- Structure should be extensible for future project-specific benchmark tasks
- This is Part 1 of 4 — no dependencies on other tasks

## Parent Feature

Model Evaluation Pipeline for Auto-Pilot (TASK_2026_123 through TASK_2026_126)
