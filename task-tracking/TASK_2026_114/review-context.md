# Review Context — TASK_2026_114

## Task Scope
- Task ID: 2026_114
- Task type: BUGFIX
- Files in scope: `.claude/skills/auto-pilot/SKILL.md` — these are the ONLY files reviewers may touch

## Git Diff Summary
Commit: `d6391ee` — `fix(TASK_2026_114): enforce review-lessons pre-read in Build Worker prompt`

```diff
diff --git a/.claude/skills/auto-pilot/SKILL.md b/.claude/skills/auto-pilot/SKILL.md
index c8602b5..7b56efa 100644
--- a/.claude/skills/auto-pilot/SKILL.md
+++ b/.claude/skills/auto-pilot/SKILL.md
@@ -1307,8 +1307,10 @@ through implementation. Follow these rules strictly:
    d. Commit the status file: `docs: mark TASK_YYYY_NNN IMPLEMENTED`

 5. Before developers write any code, they MUST read
-   .claude/review-lessons/ (review-general.md, backend.md,
-   frontend.md). These contain accumulated rules from past reviews.
+   ALL review-lessons files and anti-patterns:
+   - Read .claude/review-lessons/*.md (all lesson files: review-general.md, backend.md, frontend.md, security.md)
+   - Read .claude/anti-patterns.md
+   These contain accumulated rules and patterns from past reviews.

 6. EXIT GATE — Before exiting, verify:
    - [ ] All tasks in tasks.md are COMPLETE
@@ -1358,7 +1360,10 @@ AUTONOMOUS MODE — follow these rules strictly:
 4. Do NOT restart from scratch. Resume from the detected phase.

 5. Before developers write code, ensure they read
-   .claude/review-lessons/ for accumulated rules.
+   ALL review-lessons files and anti-patterns:
+   - Read .claude/review-lessons/*.md (all lesson files: review-general.md, backend.md, frontend.md, security.md)
+   - Read .claude/anti-patterns.md
+   These contain accumulated rules and patterns from past reviews.

 6. Complete ALL remaining batches. After all tasks COMPLETE in tasks.md:
    a. Create a git commit with all implementation code
```

### Files Changed
- `.claude/skills/auto-pilot/SKILL.md` — Two locations in the Build Worker prompt sections updated:
  1. **Build Worker initial prompt (Step 5, ~line 1307)**: Replaced vague `review-lessons/` directory reference with an explicit bullet list using glob notation `*.md`, and added `.claude/anti-patterns.md` to the pre-read list.
  2. **Build Worker continuation/recovery prompt (Step 5, ~line 1360)**: Same update — replaced single-line directory reference with the same explicit bullet list format.

## Project Conventions
- Skill files (`.claude/skills/`) are markdown documents with structured sections and fenced code blocks
- Build Worker prompt text should use imperative language and explicit file paths
- Glob patterns (`*.md`) are acceptable for broad file reads in worker instructions
- The `.claude/` directory is the scaffold — changes here ship as the next package version
- Git: conventional commits with scopes (e.g., `fix(TASK_2026_114): ...`)

## Style Decisions from Review Lessons
Relevant rules from `.claude/review-lessons/review-general.md`:

- **Cross-file references must use names, not numbers** — if a step references "Step 5", changes in numbering may silently break those references. Use descriptive names where possible.
- **Summary sections must be updated when the steps they describe change** — when a skill or command has a "Responsibilities" or "What You Do" summary, any rewritten step's corresponding summary bullet must be updated in the same changeset.
- **"Delegating to a single source of truth" means removing the duplicate, not adding a summary** — when a file changes from inline rules to referencing an external canonical doc, any summary list left behind becomes a second copy that will drift.
- **Prompt templates must reference canonical definitions, not duplicate them** — if a skill defines an Exit Gate checklist, worker prompt templates should reference it rather than embed a simplified copy.
- **Implementation-era language must be removed before merge** — phrases like "new files added" are useful during authoring but become confusing post-merge.

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- `.claude/skills/auto-pilot/SKILL.md`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 0
- Serious: 2
- Minor: 2
