# Task: Enforce Review-Lessons Pre-Read in Build Worker Prompt

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P2-Medium   |
| Complexity | Simple      |
| Model      | default     |
| Testing    | skip        |

## Description

Build Workers are implementing code that violates existing review lessons. TASK_2026_080 violated 5 lessons already documented in `.claude/review-lessons/frontend.md` (hardcoded hex colors, template method calls instead of computed(), SVG data URIs bypassing token system, per-item method calls in @for, DOMPurify catch block bypass). This indicates workers are not reading the lessons file before starting implementation.

Add explicit "Read `.claude/review-lessons/*.md` and `.claude/anti-patterns.md`" step to the Build Worker prompt in auto-pilot SKILL.md, positioned after task artifact reading and before implementation begins. This ensures accumulated project knowledge is loaded into context before code is written.

## Dependencies

- None

## Acceptance Criteria

- [ ] Build Worker prompt in auto-pilot SKILL.md includes an explicit step to read all `.claude/review-lessons/*.md` files before implementation begins
- [ ] The step is positioned after task artifact reading and before the first code write
- [ ] Anti-patterns file (`.claude/anti-patterns.md`) is also included in the pre-read step

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_099, TASK_2026_100, TASK_2026_106, TASK_2026_112 — all touch `.claude/skills/auto-pilot/SKILL.md` in their File Scope.
Suggested wave: after those tasks complete, or serialize carefully.

## References

- `.claude/skills/auto-pilot/SKILL.md` — Build Worker prompt section
- `.claude/review-lessons/` — lesson files that should be pre-read
- task-tracking/retrospectives/RETRO_2026-03-28_2.md — source analysis showing 5 violated lessons

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
