# Task: Stack-Aware Anti-Patterns Generation at Init

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

During e2e testing on a plain HTML/CSS/JS project, the `anti-patterns.md` file contained Angular lifecycle rules, Tailwind rules, and soft-delete DB patterns -- none of which apply. The file ships as-is from the core package and references "142 QA findings across 14 tasks" from prior projects.

Two issues:
1. **anti-patterns.md is not adapted to the project's tech stack at init** (BUG-6)
2. **Workers did not consult anti-patterns during implementation** (BUG-7)

Meanwhile, `review-lessons/` worked correctly -- growing from 0 to 15 entries.

### Fix

**Part A -- Stack-aware anti-patterns at init**
- `nitro-fueled init` already does stack detection (stack-detection-registry.md)
- After detecting stack, generate a project-specific `anti-patterns.md` with only relevant rules
- Split the master anti-patterns into categories tagged by tech (angular, react, node, vanilla-js, database, etc.)
- Init selects and merges only matching categories
- For empty/minimal projects: use a minimal "universal" set (HTML correctness, accessibility, JS basics)

**Part B -- Plan phase re-assessment**
- When `/plan` runs on a project with minimal stack detection (e.g., only tsconfig.json), the planner should:
  - Note the actual tech choices in plan.md decisions log
  - Update anti-patterns.md if the chosen stack differs from what init detected

**Part C -- Workers consult anti-patterns**
- Build workers should check anti-patterns.md before submitting (add to Exit Gate)
- Review workers should reference anti-patterns.md during review

## Dependencies

- TASK_2026_015 -- Stack Detection Registry (already COMPLETE, provides the detection logic)

## Acceptance Criteria

- [ ] Anti-patterns master file is split into tech-category sections (tagged)
- [ ] `nitro-fueled init` generates project-specific anti-patterns based on detected stack
- [ ] Empty/minimal projects get a "universal" anti-patterns set (not Angular/Tailwind rules)
- [ ] Plan phase updates anti-patterns when tech choices are made
- [ ] Build worker Exit Gate includes anti-patterns check
- [ ] Review workers reference anti-patterns during review
- [ ] Anti-patterns header states which tech stack it covers

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-6, BUG-7, ENH-7
- `.claude/anti-patterns.md` -- current generic file
- `.claude/skills/orchestration/references/stack-detection-registry.md` -- stack detection
- Test project `.claude/anti-patterns.md` -- evidence of mismatch
