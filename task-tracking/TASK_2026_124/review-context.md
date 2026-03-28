# Review Context — TASK_2026_124

## Task Scope
- Task ID: 2026_124
- Task type: FEATURE
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - `.claude/skills/auto-pilot/SKILL.md` (modified — added Evaluation Mode section, Evaluation Build Worker Prompt Template, Evaluate entry in Modes table)
  - `.claude/commands/nitro-auto-pilot.md` (modified — added --evaluate flag, parameter, parsing, evaluation mode handler, Quick Reference update)
  - `evaluations/` (new directory, created at runtime by the evaluation flow)

## Git Diff Summary

Implementation commit: `132b077 feat(TASK_2026_124): add --evaluate flag for single-model evaluation mode`

### .claude/commands/nitro-auto-pilot.md

- Added `--evaluate claude-opus-4-6` example to the usage block
- Added `--evaluate` row to the Parameters table (model-id string)
- Added parsing block: `--evaluate <model-id>` → evaluation mode (skips Steps 3 and 4)
- Added Step 6 handler: `IF --evaluate <model-id>` block that describes entering Evaluation Mode from SKILL.md
- Updated Quick Reference Modes line: added `evaluate` to the list
- Added `Benchmark suite: benchmark-suite/config.md` reference link

### .claude/skills/auto-pilot/SKILL.md

- Added `| **Evaluate** | ... |` row to the Modes table
- Updated prose below Modes table: "Single-task, dry-run, and evaluation modes are handled by the command..."
- Added full `## Evaluation Mode` section (~200 lines) covering:
  - Steps E1–E7: parse model ID, load benchmark tasks, create eval session directory, create isolated worktree, spawn evaluation build workers, monitor workers, finalize evaluation
  - Worktree isolation contract
  - Sequential spawning (one worker at a time)
  - Per-task result file format
  - Retry logic (1 retry per task)
  - Cleanup of worktree after all tasks complete
- Added `### Evaluation Build Worker Prompt` template at the end of Worker Prompt Templates section

## Project Conventions

From CLAUDE.md:
- Git: conventional commits with scopes
- Agent naming: all agents use the `nitro-` prefix
- `.claude/` directory is the scaffold — changes here sync to what `init` installs in target projects
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED
- Skill files use markdown format with clear section headings
- Command files use markdown format with Parameters table and Execution Steps

## Style Decisions from Review Lessons

Relevant rules from `.claude/review-lessons/review-general.md`:

**Documentation & Template Consistency**
- Named concepts must use one term everywhere — if a mode has a name ("Evaluate"), every file must use that exact phrase.
- Prompt templates must reference canonical definitions, not duplicate them.
- "Create using the template below" must be followed by an actual template.
- Each distinct set of valid enum values must have its own documented subsection.
- Summary sections must be updated when the steps they describe change.
- Implementation-era language must be removed before merge — phrases like "new columns added in this task" must be rewritten to describe steady-state behavior.
- Multi-sentinel columns must document the sentinel contract inline.
- All table rows must have the same number of cells.
- Metadata fields and prose instructions must be consistent within the same file.
- Scoring guides that cite absolute counts must derive those counts inline or by cross-reference.

**Cross-File References**
- Cross-file section references must use names, not numbers.
- Step logic that reads external artifacts must handle malformed input.
- Session log aggregate events must also persist the diagnostic detail, not just the count.

**Error Handling**
- Never swallow errors — at minimum, log them.

**File Size Limits**
- Skill files/command files are large reference docs — no hard line limits apply here (limits are for TypeScript components and services).

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/commands/nitro-auto-pilot.md`

Issues found outside this scope: document only, do NOT fix.
The `evaluations/` directory is created at runtime — no static file to review.
