# Context — TASK_2026_027

**Task ID**: TASK_2026_027
**Type**: FEATURE
**Strategy**: PM -> Architect -> Team-Leader -> QA
**Complexity**: Medium
**Created**: 2026-03-24

## User Intent

Add shared review context and task file-scope isolation to prevent cross-task interference during parallel review phases.

## Problem Statement

From e2e testing (TASK_2026_014 findings), two related issues emerged:

1. **BUG-3**: Cross-task interference - TASK_001 reviewer fixed code belonging to TASK_002 because both tasks edit the same file.

2. **BUG-4**: Contradictory decisions - TASK_001 reviewer changed `var` to `const`/`let`, then TASK_002 reviewer changed them back to `var`.

## Solution Approach

Two-part fix:

**Part A - Shared Review Context File**
- Generate `review-context.md` before spawning review workers
- Include project conventions from plan.md decisions log
- Include style decisions from completed reviews
- Include tech stack constraints
- All review workers read this file before starting

**Part B - Task File Scope Tracking**
- Add `## File Scope` section to task template
- Build workers populate file scope after implementation
- Supervisor detects overlapping file scopes and warns
- When overlap detected: serialize reviews or add scope boundaries
- Reviewers instructed to only fix code within their task's scope

## Related Files

- `task-tracking/TASK_2026_014/e2e-test-findings.md` - BUG-3, BUG-4, ENH-3, ENH-4
- `.claude/skills/auto-pilot/SKILL.md` - supervisor review spawning logic
- `.claude/skills/orchestration/SKILL.md` - review phase instructions
- `task-tracking/task-template.md` - task template to extend

## Current State

- Task status: IN_PROGRESS
- Registry updated to IN_PROGRESS
- No existing deliverables yet
