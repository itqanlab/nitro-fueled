# Review Context — TASK_2026_099

## Task Scope
- Task ID: 2026_099
- Task type: FEATURE
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - task-tracking/task-template.md
  - docs/task-template-guide.md
  - .claude/skills/auto-pilot/SKILL.md
  - .claude/skills/orchestration/SKILL.md

## Git Diff Summary

Implementation was delivered across two commits:
- `8ec9c53 wip(TASK_2026_099)`: First salvage — auto-pilot SKILL.md blocked dependency/orphan detection + per-task timing; task-template.md timing fields; docs/task-template-guide.md timing docs
- `5593ad1 salvage(TASK_2026_099)`: Second salvage — preferred_tier field in task-template.md + preferred_tier routing in auto-pilot SKILL.md

**task-tracking/task-template.md** (both commits):
- Added `preferred_tier` metadata field with values `[light | balanced | heavy | auto]`
- Added `Poll Interval`, `Health Check Interval`, `Max Retries` timing override fields
- Added comment block documenting `preferred_tier` mapping (light=glm-4.7, balanced=glm-5, heavy=claude-opus-4-6, auto=fallback)

**docs/task-template-guide.md** (wip commit only):
- Extended Field → Consumer table with three new rows: Poll Interval, Health Check Interval, Max Retries
- Added "When to Use Custom Timing Values" section with guidance on each field
- Added "Fallback Behavior" subsection

**.claude/skills/auto-pilot/SKILL.md** (both commits):
- Step 3 (Dependency Classification): Added `BLOCKED_BY_DEPENDENCY` status class
- Added blocked dependency detection algorithm (steps 4-6): transitive walk, classification, logging
- Added orphan blocked task detection algorithm (steps 7-11): no-dependent check, warning display, logging
- Added Step 3d: Cross-session task exclusion (read other sessions' state.md, build foreign_claimed_set)
- Step 5a-jit: Extended extraction to include Poll Interval, Health Check Interval, Max Retries
- Added Duration String Parsing rules (regex, validation, clamping for Max Retries)
- Step 5d: Changed Provider Routing Table — replaced Complexity=Complex/Medium/Simple rows with preferred_tier=heavy/balanced/light rows
- Added "Reading `preferred_tier`" instruction paragraph

**.claude/skills/orchestration/SKILL.md** (NOT modified by task 099):
- The task file scope includes this file, and the task description requires adding a blocked-dependency guardrail to `/orchestrate`
- However, no commits from TASK_2026_099 touched this file
- The changes visible in diff 1238ae4..HEAD come from `bfc1774 fix(TASK_2026_113)` — a different task
- **Possible missing implementation**: acceptance criterion "Orchestration SKILL.md refuses to start a task that depends on a BLOCKED task" may not be fulfilled

## Project Conventions
- Agent files are markdown with YAML frontmatter. Skill files are plain markdown.
- Conventional commits with scopes (e.g., `feat(TASK_2026_099):`, `fix(...)`)
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED
- Agent naming: all agents use the `nitro-` prefix
- Enum values must match canonical source character-for-character (review-general.md rule)
- Cross-file section references must use names, not numbers
- Step numbering in command docs must be flat and sequential
- "Delegating to a single source of truth" means removing the duplicate, not adding a summary

## Style Decisions from Review Lessons
- **Enum values must match canonical source character-for-character** — if SKILL.md defines statuses or types, every template, command, and guide must use the exact same values, casing, and separators.
- **Named concepts must use one term everywhere** — if a mode or concept has a name, every file must use that exact phrase.
- **Step numbering in command docs must be flat and sequential** — avoid mixed schemes like Step 5, Step 5b, Step 5c.
- **Summary sections must be updated when the steps they describe change** — stale summaries contradict authoritative step logic.
- **Multi-sentinel columns must document the sentinel contract inline** — document when a field uses different null representations.
- **Algorithm specs that count discrete items must define the counting rule precisely** — avoid ambiguous instructions.
- **Hard limit tables must only include rules enforceable against the target artifact**.
- **Fallback tables that expand a canonical row's detection method must acknowledge the divergence**.
- **New status/enum values must be added to the canonical reference first** — `BLOCKED_BY_DEPENDENCY` is a new status used only in memory (not written to disk registry). Verify it is documented.

## Findings Summary
- Blocking: 0
- Serious: 4
- Minor: 10

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- task-tracking/task-template.md
- docs/task-template-guide.md
- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/orchestration/SKILL.md

Issues found outside this scope: document only, do NOT fix.
