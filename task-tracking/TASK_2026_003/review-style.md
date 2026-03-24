# Code Style Review - TASK_2026_003

## Review Summary

| Metric          | Value          |
| --------------- | -------------- |
| Overall Score   | 7/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 1              |
| Serious Issues  | 4              |
| Minor Issues    | 5              |
| Files Reviewed  | 4              |

## The 5 Critical Questions

### 1. What could break in 6 months?

The inconsistent terminology for referring to autonomous/Supervisor mode across the orchestration SKILL.md will confuse agents parsing these instructions. Three different phrasings exist within the same file: "autonomous mode" (line 123), "autonomous (Supervisor) mode" (lines 255, 309), and in task-tracking.md "Supervisor mode" (line 181). An agent reading these could interpret them as three different modes rather than one concept. When someone adds a fourth variant later, the divergence compounds.

### 2. What would confuse a new team member?

The dash convention is split: auto-pilot SKILL.md uses double-hyphens (`--`) for prose separators (lines 33, 44-49, 62, etc.) and em-dashes (`---`) for log format strings (lines 76-101, 356-358). The orchestration SKILL.md uses em-dashes (`---`) for prose (lines 253, 260, 307) and double-hyphens for one line (line 363). The command file uses only double-hyphens. A new contributor cannot determine which is "correct" because the files within this same task use both styles inconsistently. This is a readability papercut that accumulates.

### 3. What's the hidden complexity cost?

The auto-pilot SKILL.md at 763 lines is substantial. While this is a documentation/specification file (not code), the sheer length means that after compaction, an agent loading this skill will consume significant context. The worker prompt templates alone span lines 393-582 (~190 lines of template text that gets copied into prompts). If these templates drift from the orchestration SKILL.md's Exit Gate definitions, the worker will follow the template (which it receives as its prompt) rather than the SKILL.md it loads via `/orchestrate`. The templates duplicate Exit Gate checks inline rather than referencing the canonical Exit Gate section in orchestration SKILL.md -- this is a maintenance time bomb.

### 4. What pattern inconsistencies exist?

See Blocking Issue 1 and Serious Issues 1-3 below. The main inconsistencies are:
- Terminology for the autonomous mode concept (3 variants across 2 files)
- Dash style (em-dash vs double-hyphen, mixed within and across files)
- The auto-pilot SKILL.md worker prompt Exit Gate checks (lines 423-428, 473-478, 522-528, 573-578) are simplified versions of the canonical Exit Gate in orchestration SKILL.md (lines 332-364). The prompt versions omit the `exit-gate-failure.md` fallback behavior that the orchestration SKILL.md defines.

### 5. What would I do differently?

1. Standardize on one term for the mode: "Supervisor mode" everywhere (short, clear, matches the role name). Drop "autonomous" as a qualifier -- it adds no information since Supervisor mode IS autonomous by definition.
2. Pick one dash style and use it everywhere. Em-dashes for prose, double-hyphens only in code/log format strings where Unicode might cause parsing issues.
3. The worker prompt Exit Gate checks should say "Run the Exit Gate from orchestration SKILL.md" rather than duplicating a simplified checklist. This prevents drift.

## Blocking Issues

### Issue 1: Terminology inconsistency for Supervisor/autonomous mode across files

- **File**: `.claude/skills/orchestration/SKILL.md:123`, `.claude/skills/orchestration/SKILL.md:255`, `.claude/skills/orchestration/SKILL.md:309`, `.claude/skills/orchestration/references/task-tracking.md:181`
- **Problem**: Three different terms are used for the same concept:
  - Line 123: `"In autonomous mode, Build Workers use phases up through..."`
  - Line 255: `"In autonomous (Supervisor) mode, this phase runs in the..."`
  - Line 309: `"In autonomous (Supervisor) mode, the Review Worker sets..."`
  - task-tracking.md line 181: `"In Supervisor mode, the Build Worker handles phases from..."`
- **Impact**: Agents parsing these instructions may not recognize these as referring to the same operational mode. The review-general.md lesson (line 51) explicitly states: "Enum values must match canonical source character-for-character." While this is not an enum, it is a named concept that should be consistent. This violates the project's own documented rule about terminology consistency.
- **Fix**: Pick one term and use it everywhere. Recommendation: `"In Supervisor mode"` (matches the role name, is the shortest, and is already used in task-tracking.md). Update orchestration SKILL.md lines 123, 255, 309 and verify no other files use a variant.

## Serious Issues

### Issue 1: Mixed dash style within and across files

- **File**: `.claude/skills/auto-pilot/SKILL.md` (throughout), `.claude/commands/auto-pilot.md` (throughout), `.claude/skills/orchestration/SKILL.md:363`
- **Problem**: The auto-pilot SKILL.md uses double-hyphens (`--`) for prose separators in the "What You Never Do" section (lines 44-49), the Configuration note (line 62), and many other prose locations. But it uses em-dashes (`---`) in the Session Log format strings (lines 76-101) and in Step 7d log messages (lines 356, 358). The orchestration SKILL.md uses em-dashes everywhere except line 363 which uses `--`. The command file uses only `--`.
- **Tradeoff**: This is not functionally broken, but it is a style inconsistency that signals carelessness to anyone reading the files side by side. The files were all modified in the same task, so they should follow the same convention.
- **Recommendation**: Standardize. Use em-dashes (`---`) in prose/descriptions (matching orchestration SKILL.md's dominant style). Keep double-hyphens (`--`) only inside code blocks, log format strings inside backticks, and CLI flag references (where `--` is syntactically meaningful).

### Issue 2: Worker prompt Exit Gates are simplified duplicates, missing fallback behavior

- **File**: `.claude/skills/auto-pilot/SKILL.md:423-428` (Build Worker), `.claude/skills/auto-pilot/SKILL.md:522-528` (Review Worker)
- **Problem**: The Exit Gate checks in the worker prompt templates are simplified checklists that omit the "Exit Gate Failure" fallback defined in orchestration SKILL.md lines 359-363. Specifically, the orchestration SKILL.md says: "If you cannot pass the Exit Gate: 1. Document the failure in the task folder (create `exit-gate-failure.md`) 2. Exit cleanly." But the worker prompts only say "If any check fails, fix it before exiting" (line 428) with no mention of the fallback path.
- **Tradeoff**: If a worker truly cannot pass an Exit Gate check (e.g., a build failure it cannot fix), it has no instruction to create `exit-gate-failure.md` and exit cleanly. It will loop trying to "fix it" until stuck-detected and killed. The Supervisor then has no `exit-gate-failure.md` to understand why.
- **Recommendation**: Add to each worker prompt's Exit Gate section: "If you cannot fix a failing check, create `exit-gate-failure.md` in the task folder documenting the failure, then exit cleanly."

### Issue 3: Review Worker prompt item 7 creates a state transition gap

- **File**: `.claude/skills/auto-pilot/SKILL.md:514-515`
- **Problem**: The First-Run Review Worker prompt says: "7. Update registry.md: set task status to IN_REVIEW BEFORE starting reviews (so Supervisor knows you started)." But the Supervisor's Step 5a (line 247) says task state IMPLEMENTED or IN_REVIEW spawns a Review Worker. The Supervisor's Step 7b checks if the state transitioned to the `expected_end_state` which is COMPLETE. If the Review Worker sets IN_REVIEW but then crashes before setting COMPLETE, the Supervisor sees IN_REVIEW (not the expected COMPLETE), treats it as "no transition to expected end state" (Step 7d), and increments retry count. This is correct behavior, but the Retry Review Worker prompt (line 566) says "If registry does not yet show IN_REVIEW, set it to IN_REVIEW" -- meaning on retry it may redundantly set a state that is already set. This is harmless but indicates the prompts could be clearer about idempotent state transitions.
- **Recommendation**: Add a note in the Retry Review Worker prompt: "Setting IN_REVIEW is idempotent -- if already set, this is a no-op."

### Issue 4: `interactive mode` not defined or explained in orchestration SKILL.md

- **File**: `.claude/skills/orchestration/SKILL.md:126`, `.claude/skills/orchestration/SKILL.md:258`, `.claude/skills/orchestration/SKILL.md:310`
- **Problem**: The orchestration SKILL.md references "interactive mode" as the counterpart to Supervisor mode (e.g., "In interactive mode, a single session runs the full flow" at line 126, "In interactive mode, the orchestrator sets this status" at line 310). But "interactive mode" is never formally defined anywhere in the reviewed files. A reader must infer it means "a human is running `/orchestrate` directly."
- **Tradeoff**: This is implicit knowledge that works today but will confuse new contributors or new agents encountering the term for the first time.
- **Recommendation**: Add a one-line definition, either in the Worker Scoping blockquote or in the Modes section: "Interactive mode: a human runs `/orchestrate` directly and is present for validation checkpoints."

## Minor Issues

1. **`.claude/skills/auto-pilot/SKILL.md:1`** -- Frontmatter `name: supervisor` but file path is still `auto-pilot/SKILL.md`. This is by design per the task spec (file path not renamed), but the mismatch between the frontmatter name and the directory name is worth noting for future cleanup.

2. **`.claude/skills/auto-pilot/SKILL.md:263`** -- Label format example uses uppercase `BUILD`/`REVIEW` in the label (`TASK_2026_003-FEATURE-BUILD`) but the Worker Type column in the Active Workers table (line 609) uses PascalCase `Build`/`Review`. The label is a display string so this is cosmetic, but it creates two casings for the same concept.

3. **`.claude/skills/orchestration/SKILL.md:338`** -- Build Worker Exit Gate table uses `Check git status` as the Command for two different checks (lines 339, 341). The expected values differ, but the command column is identical. A more precise command would help (e.g., `git status --porcelain` vs `git diff --cached registry.md`).

4. **`.claude/skills/orchestration/references/task-tracking.md:248`** -- The tasks.md-level status table includes `IMPLEMENTED` with meaning "Code complete, awaiting verification" while the registry-level status table (line 236) has `IMPLEMENTED` with meaning "Implementation complete, awaiting review". The meanings are similar but not identical ("awaiting verification" vs "awaiting review"). These should use the same phrasing since the status value is the same string.

5. **`.claude/commands/auto-pilot.md:1`** -- Title is `# Auto-Pilot -- Supervisor Task Processing`. The double-hyphen here acts as a separator but could be read as a CLI flag. An em-dash or a colon would be clearer: `# Auto-Pilot: Supervisor Task Processing`.

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 7/10
**Issues Found**: 0 blocking (cross-file issues counted above), 2 serious, 3 minor

**Analysis**: This is the largest file at 763 lines and serves as the complete behavioral specification for the Supervisor. The structure is well-organized with clear section headers, numbered steps, and decision tables. The new two-worker model is thoroughly specified with four prompt templates covering first-run and retry scenarios for both worker types.

**Specific Concerns**:
1. Lines 356, 358 use em-dashes in log messages but surrounding prose (lines 349-354) uses double-hyphens. Mixed within the same section.
2. Lines 393-582 (worker prompt templates) duplicate Exit Gate logic rather than referencing the canonical source in orchestration SKILL.md. This is ~190 lines of duplicated specification.
3. The `orchestrator-state.md` format example (lines 590-656) is well-structured and the example session log (lines 642-653) correctly demonstrates the new event formats.

### `.claude/skills/orchestration/SKILL.md`

**Score**: 6/10
**Issues Found**: 1 blocking (terminology), 2 serious, 1 minor

**Analysis**: The Exit Gate section (lines 326-364) is a strong addition -- it gives workers concrete, verifiable checks before exiting. The Worker Scoping blockquotes (lines 123-126, 255-258) correctly scope each phase. However, the terminology inconsistency across the three blockquote annotations is the most impactful issue in the entire review. This file is read by every worker session, so inconsistent terminology here propagates widely.

**Specific Concerns**:
1. Line 123 says "autonomous mode" but lines 255 and 309 say "autonomous (Supervisor) mode". Same file, same concept, different strings.
2. Line 363 uses `--` (double-hyphen) while the rest of the file uses em-dashes. One outlier.
3. The Exit Gate tables (lines 337-341, 349-357) use a 3-column format (Check | Command | Expected) which is clear and scannable.

### `.claude/skills/orchestration/references/task-tracking.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The state tables are well-organized. The new states (IMPLEMENTED, IN_REVIEW) are correctly added to both the Registry Status table (lines 232-240) and the Registry Format example (lines 79-85). The Document Ownership table (lines 146-158) correctly attributes `completion-report.md` to "Review Worker / Orchestrator" and adds `exit-gate-failure.md`. The Phase Detection table (lines 185-200) includes the Worker Scoping blockquote.

**Specific Concerns**:
1. Line 181 uses "Supervisor mode" while orchestration SKILL.md uses "autonomous mode" and "autonomous (Supervisor) mode". Cross-file inconsistency (counted in Blocking Issue 1).
2. Line 248 has a subtly different description for IMPLEMENTED vs line 236. Minor but worth aligning.

### `.claude/commands/auto-pilot.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: This is the cleanest file of the four. The terminology is consistent (always "Supervisor" when referring to the role, always `/auto-pilot` for the command). The parameter table (lines 19-26) is well-formatted. The state-aware display summary (lines 67-79) correctly shows all six states. The dry-run output format (lines 88-106) shows both Build and Review worker types in the execution plan.

**Specific Concerns**:
1. Title uses `--` as a separator (line 1). Cosmetic only.

## Pattern Compliance

| Pattern                          | Status | Concern                                                                                             |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Terminology consistency          | FAIL   | Three variants of "Supervisor/autonomous mode" across files                                         |
| State enum consistency           | PASS   | CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED match across all 4 files |
| Worker type naming               | PASS   | "Build Worker" and "Review Worker" consistently PascalCase two-word terms everywhere                |
| Cross-file state references      | PASS   | Registry states, task states, and transitions are consistent                                        |
| Dash style                       | FAIL   | Mixed em-dash and double-hyphen within and across files                                             |
| Table formatting                 | PASS   | All tables use consistent markdown pipe syntax with header separators                               |
| Heading hierarchy                | PASS   | H1 for title, H2 for major sections, H3 for subsections -- consistent across all files             |
| Blockquote usage                 | PASS   | Blockquotes used for callouts/notes consistently (Worker Scoping, Scope Note, etc.)                 |
| Code block language tags         | PASS   | Markdown blocks tagged appropriately (markdown, typescript, bash) or untagged for pseudo-code       |
| File path references             | PASS   | All cross-file references use relative paths from project root                                      |

## Technical Debt Assessment

**Introduced**:
- Worker prompt templates in auto-pilot SKILL.md duplicate Exit Gate checks from orchestration SKILL.md. If the canonical Exit Gate changes, four prompt templates must be manually updated. This is new duplication introduced by this task.
- "Interactive mode" is referenced but never defined, creating implicit knowledge debt.

**Mitigated**:
- The `--stuck` dead parameter from TASK_2026_002 findings has been removed.
- `completion-report.md` and `exit-gate-failure.md` are now in the task-tracking folder structure and Document Ownership table.
- State reconciliation (Step 1, sub-step 5) addresses the gap identified in TASK_2026_002 review.

**Net Impact**: Slightly positive. The new state machine and two-worker model are well-specified and the reconciliation logic is thorough. The duplication in prompt templates is a concern but manageable given the current project size.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The terminology inconsistency (Blocking Issue 1) violates the project's own documented rule about consistent naming (review-general.md line 51). This is a 3-line fix across 2 files but it matters because these instructions are parsed by agents that take terms literally.

## What Excellence Would Look Like

A 10/10 implementation would:
1. Use exactly one term for the autonomous operating mode everywhere ("Supervisor mode")
2. Use a consistent dash style across all 4 files (em-dash for prose, double-hyphen only in code/CLI contexts)
3. Have worker prompt Exit Gates reference the canonical Exit Gate rather than duplicating checks, with a single line: "Run the Exit Gate checks defined in the orchestration skill's Exit Gate section"
4. Define "interactive mode" explicitly somewhere in the orchestration SKILL.md
5. Use identical descriptions for the same status value (IMPLEMENTED) regardless of whether it appears in the registry table or the tasks.md table
