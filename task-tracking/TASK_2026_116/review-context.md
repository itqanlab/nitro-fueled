# Review Context — TASK_2026_116

## Task Scope
- Task ID: 2026_116
- Task type: REFACTORING
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - `.claude/commands/*.md` (17 files renamed)
  - `CLAUDE.md`
  - `.claude/skills/orchestration/references/task-tracking.md`
  - `.claude/skills/orchestration/references/checkpoints.md`

## Git Diff Summary

Implementation commit: `095bc86` — `feat(TASK_2026_116): rename all commands to nitro-* prefix`

Files changed (17 renames with content edits):

```
.claude/commands/auto-pilot.md          → nitro-auto-pilot.md       (18 lines changed — self-reference updates)
.claude/commands/create-agent.md        → nitro-create-agent.md     (20 lines changed)
.claude/commands/create-skill.md        → nitro-create-skill.md     (8 lines changed)
.claude/commands/create-task.md         → nitro-create-task.md      (14 lines changed)
.claude/commands/create.md              → nitro-create.md           (12 lines changed)
.claude/commands/evaluate-agent.md      → nitro-evaluate-agent.md   (4 lines changed)
.claude/commands/initialize-workspace.md → nitro-initialize-workspace.md (0 lines — rename only)
.claude/commands/orchestrate-help.md    → nitro-orchestrate-help.md (2 lines changed)
.claude/commands/orchestrate.md         → nitro-orchestrate.md      (4 lines changed)
.claude/commands/plan.md                → nitro-plan.md             (12 lines changed)
.claude/commands/project-status.md      → nitro-project-status.md   (0 lines — rename only)
.claude/commands/retrospective.md       → nitro-retrospective.md    (8 lines changed)
.claude/commands/review-code.md         → nitro-review-code.md      (0 lines — rename only)
.claude/commands/review-logic.md        → nitro-review-logic.md     (0 lines — rename only)
.claude/commands/review-security.md     → nitro-review-security.md  (0 lines — rename only)
.claude/commands/run.md                 → nitro-run.md              (12 lines changed)
.claude/commands/status.md              → nitro-status.md           (6 lines changed)
```

Total: 17 files changed, 60 insertions(+), 60 deletions(-)

**Notable observations**:
- `CLAUDE.md` was NOT changed in the implementation commit, but it still references old command names: line 22 lists `/orchestrate, /plan, /auto-pilot, /review-*, /create-task, /initialize-workspace, /project-status, /orchestrate-help`. This is one of the explicitly listed acceptance criteria.
- `.claude/skills/orchestration/references/task-tracking.md` and `checkpoints.md` were NOT changed — their current content does not contain old-style command name references (verified by grep).
- Files with 0-line changes (initialize-workspace, project-status, review-code, review-logic, review-security) were rename-only — no internal references to update.
- Files with content changes updated internal usage examples to use the new `/nitro-*` prefix.

## Project Conventions

From CLAUDE.md:
- **Git**: conventional commits with scopes
- **Agent naming**: all agents use the `nitro-` prefix (e.g., `nitro-planner`, `nitro-software-architect`). This prefix scopes agents to the nitro-fueled namespace.
- **Commands**: Claude Code uses the filename as the slash command name — `status.md` becomes `/status`, `nitro-status.md` becomes `/nitro-status`.
- **Command files**: markdown files in `.claude/commands/` defining slash command behavior.
- **Kebab-case** for file names.
- **This project IS the library being tested on itself** — `.claude/` is the scaffold that `npx @itqanlab/nitro-fueled init` copies into target projects.

## Style Decisions from Review Lessons

Relevant rules from `.claude/review-lessons/review-general.md` for command markdown files:

- **Named concepts must use one term everywhere** — if a command is renamed, every file that references it must use the new name. Do not mix old and new names.
- **Prompt templates must reference canonical definitions, not duplicate them** — where commands reference skills (e.g., SKILL.md), they should do so by name.
- **Commands that claim "read template as source of truth" must not hardcode template content** — duplicated enum values require multi-file updates.
- **Cross-file section references must use names, not numbers** — descriptive references survive renumbering.
- **Summary sections must be updated when the steps they describe change** — when a skill or command has a "Responsibilities" summary and a step is rewritten, the summary bullet must be updated.
- **Implementation-era language must be removed before merge** — phrases that imply the feature is novel or recently added must be rewritten.

## Scope Boundary (CRITICAL)

Reviewers MUST only flag and fix issues in these files:
- `.claude/commands/nitro-auto-pilot.md`
- `.claude/commands/nitro-create-agent.md`
- `.claude/commands/nitro-create-skill.md`
- `.claude/commands/nitro-create-task.md`
- `.claude/commands/nitro-create.md`
- `.claude/commands/nitro-evaluate-agent.md`
- `.claude/commands/nitro-initialize-workspace.md`
- `.claude/commands/nitro-orchestrate-help.md`
- `.claude/commands/nitro-orchestrate.md`
- `.claude/commands/nitro-plan.md`
- `.claude/commands/nitro-project-status.md`
- `.claude/commands/nitro-retrospective.md`
- `.claude/commands/nitro-review-code.md`
- `.claude/commands/nitro-review-logic.md`
- `.claude/commands/nitro-review-security.md`
- `.claude/commands/nitro-run.md`
- `.claude/commands/nitro-status.md`
- `CLAUDE.md`
- `.claude/skills/orchestration/references/task-tracking.md`
- `.claude/skills/orchestration/references/checkpoints.md`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 8
- Serious: 3
- Minor: 4

### Blocking Issues (8 total — overlapping across Style + Logic + Security)
1. `nitro-auto-pilot.md:61` — `/initialize-workspace` → `/nitro-initialize-workspace` in error string
2. `nitro-auto-pilot.md:193` — `/auto-pilot` → `/nitro-auto-pilot` in abort string
3. `nitro-create.md:34` — `/plan` → `/nitro-plan` in notes (mixed naming)
4. `nitro-plan.md:12` — `/plan` → `/nitro-plan` in Usage block
5. `nitro-plan.md:19` — `nitro-nitro-planner.md` → `nitro-planner.md` (double prefix bug — breaks command execution)
6. `nitro-status.md:15` — `project-status` → `nitro-project-status` in prose reference
7. `CLAUDE.md:22` — All 8 command names not updated (explicit acceptance criterion)
8. `.claude/skills/orchestration/references/task-tracking.md:166–168,215` — `/orchestrate` → `/nitro-orchestrate` in code-block examples (3 occurrences)

### Serious Issues (3 — Security MEDIUM)
1. `nitro-create-task.md:133` — Commit message template inserts user-supplied title without shell-quoting guidance (command injection risk)
2. `nitro-auto-pilot.md:91–96` — Missing prompt injection guard for task.md reads in pre-flight (Step 4a)
3. `nitro-project-status.md` Phase 1 — Missing prompt injection guard for task artifact reads

### Minor Issues (4)
1. `nitro-orchestrate-help.md:107–112` — Phantom `/validate-*` commands that don't exist in `.claude/commands/`
2. `nitro-evaluate-agent.md` Step 3 — Missing prompt injection guard (Low)
3. `nitro-auto-pilot.md:61,193` — Stale command names in error messages (Low — overlaps Blocking #1 and #2)
4. `nitro-plan.md:19` — Double-prefix path also flagged as security-relevant bypass (Low — overlaps Blocking #5)
