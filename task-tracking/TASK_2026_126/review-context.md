# Review Context — TASK_2026_126

## Task Scope
- Task ID: 2026_126
- Task type: FEATURE
- Files in scope: [these are the ONLY files reviewers may touch]
  - `.claude/skills/auto-pilot/SKILL.md` (modified — added E8/E9/E10 sections, modified E7, added Scoring Worker Prompt template)
  - `task-tracking/TASK_2026_126/context.md` (created)
  - `task-tracking/TASK_2026_126/implementation-plan.md` (created)
  - `task-tracking/TASK_2026_126/tasks.md` (created)
  - `evaluations/` (report output directory — runtime artifacts, not reviewed)

## Git Diff Summary

Implementation commit: `7f3fe88 feat(eval): add review scoring and report generation (E8-E10) for evaluation pipeline`

### `.claude/skills/auto-pilot/SKILL.md`

**Major changes** (purely markdown documentation — no TypeScript):

1. **E7 modified**: Removed `E7b: Clean Up Worktrees` subsection and replaced the final EXIT instruction with "Continue to E8". Added a note at the top of E7 explaining worktree cleanup moved to E10. Also renamed `E7c: Display Summary` → `E7b: Display Summary`.

2. **E8 added** (`#### Step E8: Review Scoring`): New section defining how the Supervisor spawns Evaluation Scoring Workers for each SUCCESS benchmark task. Contains:
   - 8.1: Filter tasks (SUCCESS vs FAILED/TIMEOUT)
   - 8.2: Reset worktree to Build Worker's commit
   - 8.3: Generate Scoring Worker prompt
   - 8.4: Spawn Scoring Worker (model: `claude-sonnet-4-6`, label: `EVAL-SCORE-{task_id}-{eval_model_id}`)
   - 8.5: Monitor with 30s poll / 300s timeout
   - 8.6: Parse review scores (4 dimensions: Correctness, Code Quality, Completeness, Error Handling)
   - 8.7: Update per-task result file
   - 8.8: Clean worktree between reviews

3. **E9 added** (`#### Step E9: Generate Evaluation Report`): Aggregates per-task results into `evaluation-report.md` including:
   - Capability matrix (per-dimension weighted averages)
   - Per-task breakdown table
   - Speed summary
   - Retry/failure analysis
   - Speed vs Quality vs Cost tradeoff table
   - Recommendation (ADOPT / DO NOT ADOPT / CONDITIONAL)

4. **E10 added** (`#### Step E10: Generate Metrics and Cleanup`): Generates `metrics.json`, performs worktree cleanup (moved from old E7b), displays final summary, and EXIT.

5. **Evaluation Scoring Worker Prompt template** added in Worker Prompt Templates section.

### `task-tracking/TASK_2026_126/context.md`, `implementation-plan.md`, `tasks.md`
Planning and context documents created during implementation. These are task-tracking artifacts.

## Project Conventions

From `CLAUDE.md`:
- Git: conventional commits with scopes
- Agent naming: all agents use the `nitro-` prefix
- Do NOT start git commit/push without explicit user instruction
- This project IS the library being tested on itself — `.claude/` directory is the scaffold

Relevant to skill files (markdown):
- Skill files use this format: agent files are markdown with YAML frontmatter
- Prompt templates must reference canonical definitions, not duplicate them
- Do NOT add features, refactor code, or make "improvements" beyond what was asked

## Style Decisions from Review Lessons

From `.claude/review-lessons/review-general.md`, rules relevant to **skill/agent markdown files**:

**Agent and Skill File Conventions**:
- **Placeholder tokens in prompt templates must use a single project-standard convention** — `{TASK_YYYY_NNN}` curly-brace style. (TASK_2026_035)
- **Prompt templates that contain placeholders must include an explicit substitution step, not just a prose note** — numbered steps, not paragraph notes. (TASK_2026_035)
- **Partial reproduction of a canonical phase must include ALL operational constraints from the original** — reproduce completely or reference exclusively. (TASK_2026_035)
- **Minimum-viable-condition checks must be defined once and cross-referenced** — not distributed across multiple phases. (TASK_2026_035)

**Documentation & Template Consistency**:
- **"Create using the template below" must be followed by an actual template** — fenced code block immediately following. (TASK_2026_061)
- **Each distinct set of valid enum values must have its own documented subsection** — document value sets per column. (TASK_2026_061)
- **Every tag in a failure taxonomy must have a reachable scoring path** — all failure tags must have explicit scoring paths. (TASK_2026_062)
- **Multi-step file updates must be atomic** — write once with all fields, not write-then-edit. (TASK_2026_062)
- **Summary sections must be updated when the steps they describe change** — stale summaries mislead readers. (TASK_2026_064)
- **Implementation-era language must be removed before merge** — no "new in this task" phrases. (TASK_2026_064)
- **Multi-sentinel columns must document the sentinel contract inline** — document when a column uses different null representations. (TASK_2026_064)
- **All table rows must have the same number of cells** — consistent pipe counts per row. (TASK_2026_064)

**Cross-File References**:
- **Step logic that reads external artifacts must handle malformed input** — include fallback for missing/malformed sections. (TASK_2026_004)

**Configuration & Parameter Consistency**:
- **Every configurable parameter must be consumed by logic** — no dead configuration. (TASK_2026_002)

**Scoring guides**:
- **Scoring guides that cite absolute counts must derive those counts inline or by cross-reference** — scoring bands must trace their N values. (TASK_2026_123)
- **Metadata fields and prose instructions must be consistent within the same file** — no contradictions between Metadata table and prose. (TASK_2026_123)

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `.claude/skills/auto-pilot/SKILL.md`
- `task-tracking/TASK_2026_126/context.md`
- `task-tracking/TASK_2026_126/implementation-plan.md`
- `task-tracking/TASK_2026_126/tasks.md`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 3
- Minor: 4
