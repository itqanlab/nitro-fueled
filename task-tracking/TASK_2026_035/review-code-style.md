# Code Style Review - TASK_2026_035

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 6/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 2                                    |
| Serious Issues  | 5                                    |
| Minor Issues    | 6                                    |
| Files Reviewed  | 3 (+ 2 SKILL.md sections)           |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The mixed placeholder convention between `[ID]` (used in review-lead.md) and `{TASK_YYYY_NNN}` (the project-standard from auto-pilot SKILL.md) is the highest-risk inconsistency. When a future developer extends the Review Lead prompts, they will model new placeholders on what they see in review-lead.md and write `[ID]` — but the Supervisor prompt engine substitutes `{TASK_YYYY_NNN}`. The result is a spawned sub-worker whose prompt contains the literal string `[ID]` rather than the actual task ID. This is a silent runtime failure: the sub-worker receives a structurally valid prompt that references non-existent file paths.

Specific locations:
- `.claude/agents/review-lead.md` — every occurrence of `[ID]` and `[project_root]` (lines 26, 30, 31, 32, 33, 35, 67, 73, 74, 75, 79-106, 119-122, 129, 139-152, 163-176, 184-199)

### 2. What would confuse a new team member?

The Phase 5: Completion section in review-lead.md says "Execute the Completion Phase as defined in `.claude/skills/orchestration/SKILL.md`" (line 262), then provides its own steps that are a partial reproduction of that phase. The two sources of truth are not identical: the Completion Phase in SKILL.md requires three separate commits (implementation, QA fixes, bookkeeping), but review-lead.md's Phase 5 Steps omit the requirement that these must be distinct commits and do not mention the "QA fixes" commit at all.

A new developer reading review-lead.md alone would not know the three-commit rule, and would combine the fix commit (Phase 4, step 6) and the bookkeeping commit (Phase 5, step 4) or skip one.

Location: `.claude/agents/review-lead.md` lines 262-279 vs orchestration SKILL.md lines 325-330.

### 3. What's the hidden complexity cost?

The sub-worker prompt templates in review-lead.md omit the `[project_root]` substitution instruction. The templates use `[project_root]` as a placeholder (e.g., `Working directory: [project_root]`), and the introductory note at line 129 says "Replace `[ID]` and `[project_root]` with the actual values before passing to `spawn_worker`". However, there is no step in Phase 2 that actually performs this substitution. Phase 2 Steps 1-3 instruct the Review Lead to call `spawn_worker` with `prompt: [Style Reviewer Prompt — see Sub-Worker Prompt Templates below]` as a reference, but the mechanism for performing the substitution is implied rather than stated.

This hidden manual step will be executed inconsistently across Review Lead sessions, especially under continuation/retry conditions where the Review Lead is a fresh session with no working memory of what the "actual values" were.

### 4. What pattern inconsistencies exist?

**Placeholder style**: The project standard, as codified in auto-pilot SKILL.md and the implementation plan (line 640), uses `{TASK_YYYY_NNN}` and `{project_root}` with curly braces. review-lead.md uses `[ID]` and `[project_root]` with square brackets throughout. This creates two different placeholder conventions in the same codebase.

**Section heading style**: code-style-reviewer.md and code-logic-reviewer.md use `## CRITICAL OPERATING PHILOSOPHY` and `## REQUIRED REVIEW PROCESS` as top-level H2 sections. code-security-reviewer.md uses `## CRITICAL OPERATING RULES` (same level), which matches. However, the heading "Required Review Process" appears as `## Required Review Process` in code-security-reviewer.md (Title Case, no ALL-CAPS) while the parallel concept in the other agents uses `## REQUIRED REVIEW PROCESS` (ALL-CAPS). The inconsistency is minor but breaks the visual pattern that readers use to scan agent files quickly.

Location: code-security-reviewer.md line 51 vs code-style-reviewer.md line 265 / code-logic-reviewer.md line 231.

**Model routing table**: The Phase 2 table in review-lead.md (line 71) adds a "Label" column not present in the implementation plan's equivalent table. This is an improvement, but the label format `TASK_[ID]-REVIEW-STYLE` uses `[ID]` placeholders again, while the auto-pilot SKILL.md uses `TASK_YYYY_NNN-TYPE-REVIEW` format (note different suffix/prefix ordering). The two label formats diverge.

### 5. What would I do differently?

1. Standardize all placeholders in review-lead.md to `{TASK_YYYY_NNN}` and `{project_root}` — matching the project convention — and add an explicit substitution step to Phase 2 before the spawn calls.
2. In Phase 5, replace the partial reproduction of the Completion Phase steps with a single authoritative cross-reference to orchestration SKILL.md, or at minimum add the three-commit rule requirement explicitly.
3. Normalize the `## Required Review Process` heading in code-security-reviewer.md to `## REQUIRED REVIEW PROCESS` to match the other agent files.
4. Align the Phase 2 table label format with the auto-pilot SKILL.md label convention.

---

## Blocking Issues

### Issue 1: Mixed Placeholder Convention Creates Silent Runtime Failure

- **File**: `.claude/agents/review-lead.md` — lines 26, 30-35, 67, 73-75, 82-106, 119-123, 129, 139-201
- **Problem**: review-lead.md uses `[ID]` and `[project_root]` (square-bracket style) throughout, including inside the sub-worker prompt templates that the Review Lead passes verbatim to `spawn_worker`. The project-standard placeholder format (as specified in the implementation plan at line 640 and used throughout auto-pilot SKILL.md) is `{TASK_YYYY_NNN}` and `{project_root}` with curly braces. Only the substitution style is consistent; the actual placeholder tokens differ.
- **Impact**: When the Review Lead constructs a sub-worker prompt, it must replace `[ID]` with the actual task ID. But there is no substitution step defined in Phase 2, and the placeholder style differs from every other prompt template in the codebase. A Review Lead following its own Phase 2 steps could pass a prompt containing literal `[ID]` strings to `spawn_worker`, causing all three sub-workers to receive invalid file paths (`task-tracking/TASK_[ID]/review-context.md`) and fail to find any files. The failure is silent — the spawn call succeeds, the sub-worker starts, reads a path that doesn't exist, and exits.
- **Fix**: Replace all `[ID]` occurrences with `{TASK_YYYY_NNN}` and all `[project_root]` occurrences with `{project_root}` throughout review-lead.md. Add an explicit "Substitution Step" before the spawn calls in Phase 2: "Before calling `spawn_worker`, replace `{TASK_YYYY_NNN}` with the actual task ID and `{project_root}` with the actual project root path in each prompt template."

### Issue 2: Phase 5 Partially Reproduces Completion Phase Without the Three-Commit Constraint

- **File**: `.claude/agents/review-lead.md` lines 262-279 vs `.claude/skills/orchestration/SKILL.md` lines 311-384
- **Problem**: review-lead.md's Phase 5 says "Execute the Completion Phase as defined in `.claude/skills/orchestration/SKILL.md`" and then provides 4 numbered steps. However, those steps omit the most operationally critical constraint from the canonical Completion Phase: the requirement for three distinct commits (implementation, QA fixes, bookkeeping) that "MUST NOT be combined." The fix commit is in Phase 4 step 6, and the bookkeeping commit is in Phase 5 step 4 — but nothing prevents the Review Lead from combining them if it interprets the phase boundary loosely. The canonical SKILL.md says "All three commits are REQUIRED. Do not combine them" (lines 329-330).
- **Impact**: Review Lead sessions will produce two-commit histories (fix + bookkeeping combined) or single-commit histories. Supervisors or auditors checking git log will not be able to distinguish the fix pass from the completion bookkeeping, breaking the commit-as-state-machine pattern the rest of the codebase depends on.
- **Fix**: Add an explicit note in Phase 5 (before step 1): "This phase produces one commit only: the bookkeeping commit. The fix commit (`fix(TASK_{TASK_YYYY_NNN}): address review findings`) was already made in Phase 4. Do NOT combine Phase 4 and Phase 5 commits." Or remove the partial step reproduction and point exclusively at SKILL.md.

---

## Serious Issues

### Issue 1: Sub-Worker Prompt Substitution Mechanism Undefined

- **File**: `.claude/agents/review-lead.md` lines 127-201
- **Problem**: The introductory note at line 129 says "Replace `[ID]` and `[project_root]` with the actual values before passing to `spawn_worker`", but this instruction exists only in a prose note, not as a numbered step. Phase 2 Steps 1-3 reference `prompt: [Style Reviewer Prompt — see Sub-Worker Prompt Templates below]` as if the template will be used as-is. There is no explicit "read the template, substitute values, then call spawn_worker" step.
- **Tradeoff**: Prose notes are easier to skim over than numbered steps, particularly in autonomous mode where the Review Lead follows structured procedures. The substitution note will be missed by models that execute Phase 2 sequentially without re-reading the header note.
- **Recommendation**: Promote the substitution rule from a prose note to a numbered step: "Step 0: Substitute values — replace all `{TASK_YYYY_NNN}` occurrences with the actual task ID and `{project_root}` with the absolute project root path before constructing any prompt string."

### Issue 2: "Required Review Process" Heading Case Inconsistency in code-security-reviewer.md

- **File**: `.claude/agents/code-security-reviewer.md` line 51
- **Problem**: The section heading reads `## Required Review Process` (Title Case). The equivalent section in code-style-reviewer.md is `## REQUIRED REVIEW PROCESS` (line 265) and in code-logic-reviewer.md is `## REQUIRED REVIEW PROCESS` (line 231). ALL-CAPS section headers are the established pattern for procedural sections in this codebase's agent files.
- **Tradeoff**: Readers who scan headings to navigate the agent files will miss this section on quick visual scan because it does not match the capitalization pattern of its siblings.
- **Recommendation**: Change to `## REQUIRED REVIEW PROCESS` to match the other agent files.

### Issue 3: Phase 2 Label Format Diverges from Auto-Pilot SKILL.md Convention

- **File**: `.claude/agents/review-lead.md` lines 72-75 and spawn code blocks lines 81, 91, 101
- **Problem**: review-lead.md defines sub-worker labels as `TASK_[ID]-REVIEW-STYLE`, `TASK_[ID]-REVIEW-LOGIC`, `TASK_[ID]-REVIEW-SECURITY`. Auto-pilot SKILL.md uses the pattern `TASK_YYYY_NNN-TYPE-REVIEW` (with `-REVIEW` as the suffix, not the infix). The ordering of `REVIEW` and the type differs between the two conventions: `[ID]-REVIEW-STYLE` vs the implied `TASK_YYYY_NNN-FEATURETYPE-REVIEW`.
- **Tradeoff**: The Supervisor reads worker labels to log events and detect worker types. If the label format diverges, Supervisor label-parsing logic (if/when it exists) will fail to categorize Review Lead sub-workers correctly. It also makes the session list harder to read when mixing Review Lead sub-workers with Build Worker labels.
- **Recommendation**: Adopt a consistent label format. Given the existing convention in auto-pilot SKILL.md, either `TASK_{TASK_YYYY_NNN}-STYLE-REVIEW` or establish a new explicit sub-worker label pattern in review-lead.md and document it as distinct from the top-level worker label convention.

### Issue 4: Phase 3 "All Sub-Workers Finish" Minimum Viable Condition Contradicts Phase 2 Failure Handling

- **File**: `.claude/agents/review-lead.md` lines 227-228 vs lines 112-115
- **Problem**: Phase 2's "On Spawn Failure" section says "The fix phase proceeds with reports that do exist" (line 116) — no minimum requirement stated. Phase 3's "After All Sub-Workers Finish" section says "If BOTH style and logic reports are missing, write exit-gate-failure.md and exit" (line 228). But Phase 3 also says "Do not halt if only one or two reviewers produced reports" (line 227) — which appears to allow proceeding with only the Security report. These three statements are in tension: can the Review Lead proceed if only Security exists? Line 228 says yes (only exits if BOTH style AND logic are missing). Line 227 says yes. But the Exit Gate (line 287) says "At least 2 of 3 review report files exist (style + logic minimum)" — which would fail if only Security exists.
- **Tradeoff**: A Review Lead that follows Phase 2 and Phase 3 prose might proceed through Phase 4 and 5 with only a Security report, then fail the Exit Gate at the end — having wasted all that work. The minimum viable condition should be stated once, consistently, not distributed across three different sections with slightly different logic.
- **Recommendation**: Define the minimum viable condition in a single place (Phase 3 is the natural location) and reference it from Phase 2 failure handling and the Exit Gate.

### Issue 5: code-security-reviewer.md Lesson Update Section Introduces Drift from Other Agents

- **File**: `.claude/agents/code-security-reviewer.md` lines 40-47 vs `.claude/agents/code-style-reviewer.md` lines 85-97 and `.claude/agents/code-logic-reviewer.md` lines 85-97
- **Problem**: code-style-reviewer.md and code-logic-reviewer.md both direct lesson updates to `review-general.md`, `backend.md`, `frontend.md`, or a new role-specific file. code-security-reviewer.md directs security-specific patterns to `.claude/review-lessons/security.md` (create if it does not exist). This is a new destination file that does not exist in the codebase and was not established by prior tasks. It splits security findings away from `review-general.md`, which all reviewers read at the start of each review. Any security rules written to `security.md` will NOT be read by style and logic reviewers — they only read `review-general.md`.
- **Tradeoff**: This divergence means cross-cutting security rules (e.g., "never hardcode API keys") discovered during security review will be invisible to style reviewers in future tasks. The implementation plan (line 358) describes this as "if security-specific patterns accumulate" — it is presented as an optional future expansion, but the agent file makes it the default path.
- **Recommendation**: Either align with the other agents and write all findings to `review-general.md` by default, or explicitly document that the Review Lead (and all other reviewers) must also read `security.md` at the start of each review.

---

## Minor Issues

1. **review-lead.md line 10**: The sentence "When you encounter a complex logic fix you are not confident about, document it as `unable to fix — requires manual review`" contradicts Phase 4 step 4 which writes to `out-of-scope-findings.md`. The introductory section should reference the same file to avoid ambiguity about where "unable to fix" notes land.

2. **review-lead.md line 68**: The frontmatter description and the Phase 2 table heading say "hard-coded — not overridable" in a parenthetical. The implementation plan used "hard-coded in the Review Lead, not overridable at this stage" (plan line 93). The "at this stage" qualifier was dropped in the implementation. Whether intentional or not, dropping this qualifier removes a signal to future developers that this may become overridable. If it is truly permanent, that is fine, but it should be a deliberate choice.

3. **review-lead.md lines 268-275**: The Review Scores table in Phase 5 uses `X/10` as the placeholder value inside a markdown code block. The Review Scores table in orchestration SKILL.md (lines 346-351) also uses `X/10`. Consistent. No issue here — noting for completeness.

4. **code-security-reviewer.md line 6**: Title reads "Code Security Reviewer Agent - The OWASP Pattern Matcher". code-style-reviewer.md title is "Code Style Reviewer Agent - The Skeptical Senior Engineer" and code-logic-reviewer.md is "Code Logic Reviewer Agent - The Paranoid Production Guardian". The dash separator is consistent. The subtitle "The OWASP Pattern Matcher" is functional but less vivid than the other personas. This is a style preference, not a rule violation.

5. **orchestration SKILL.md line 431**: The new "Review files exist" row reads `review-context.md + at least style + logic reviews present` in the Expected column. The "at least" qualifier and the "+" separator are inconsistent with the other Expected column entries in the same table which use declarative noun phrases. Consider "review-context.md, review-code-style.md, and review-code-logic.md present" for clarity, or match the existing table style more closely.

6. **orchestration SKILL.md line 432**: The new "Security review" row's Expected column says "Present (or note if sub-worker failed)". The parenthetical introduces conditional logic into an Expected column that otherwise uses simple declarative assertions. The "or note if sub-worker failed" part is not mechanically checkable via Glob — it requires reading a file for a note. This is the same category of issue documented in review-general.md (the "Exit Gate / checklist table Expected columns must match what the Command column actually checks" rule).

---

## File-by-File Analysis

### `.claude/agents/review-lead.md`

**Score**: 5/10
**Issues Found**: 2 blocking, 3 serious, 2 minor

**Analysis**:
The file is well-structured at the macro level — five numbered phases with clear sub-sections, a model routing table, explicit continuation support, and an exit gate checklist. The phase names, the monitoring interval, and the fix volume limit are all concrete and unambiguous. However, the placeholder convention problem (blocking issue 1) and the Completion Phase partial-reproduction problem (blocking issue 2) are the dominant concerns. Both will cause runtime failures or incorrect behavior in autonomous operation.

The sub-worker prompt templates themselves (lines 131-201) are good: they are self-contained, they include explicit file paths, and they explicitly prohibit source file modification. The "Do NOT fix any issues. Do NOT modify source files. Write the report only." constraint is stated at the end of each template — this is the right place for it. The AUTONOMOUS MODE banner is present in each template.

The continuation check logic in Phase 2 (lines 118-124) is sound. The Phase 3 monitoring loop is clear. The fix priority order in Phase 4 is well-specified.

**Specific Concerns**:
1. Lines 26-201: `[ID]` and `[project_root]` placeholders throughout (blocking)
2. Lines 262-279: Phase 5 partial reproduction omits three-commit constraint (blocking)
3. Lines 127-129: Substitution mechanism is a prose note, not a step (serious)
4. Lines 72-75 and 81-106: Label format diverges from project convention (serious)
5. Lines 227-228 vs 112-115 vs 287: Three inconsistent statements of the minimum viable condition (serious)
6. Line 10: "unable to fix" destination inconsistently named vs Phase 4 step 4 (minor)

---

### `.claude/agents/code-security-reviewer.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 2 serious, 2 minor

**Analysis**:
This file is the strongest of the three deliverables. The security checklist tables (lines 84-112) are precise, actionable, and adapted to the project's actual file types (markdown agent/skill files get their own category, which is appropriate for this codebase). The output format (lines 118-174) is complete and includes all required sections. The anti-patterns section (lines 188-193) mirrors the structure of code-style-reviewer.md.

The "FINAL CHECKLIST BEFORE WRITING VERDICT" (lines 197-207) is a good addition not present in the logic reviewer. Notably, it includes the crucial check "The Verdict section is present (required for Review Lead continuation detection)" — this is operationally necessary and well-placed.

The serious issues are the heading case inconsistency (issue 2 above) and the lesson routing divergence (issue 5 above). Neither is fatal to the agent's core function, but both create maintenance hazards.

**Specific Concerns**:
1. Line 51: `## Required Review Process` should be `## REQUIRED REVIEW PROCESS` (serious)
2. Lines 40-46: `security.md` destination creates a lesson routing divergence from other agents (serious)
3. Line 6: Subtitle persona is less vivid than sibling agents (minor)
4. Line 78: Step 6 says "Append any new security patterns found to `.claude/review-lessons/review-general.md` or `.claude/review-lessons/security.md`" — the "or" is ambiguous about which file takes priority for cross-cutting findings (minor)

---

### `.claude/skills/orchestration/SKILL.md` (changed sections only)

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**:
The three changes to this file are well-targeted. The Phase Detection table addition (line 139) correctly places `review-context.md` between `tasks.md (all COMPLETE)` and `future-enhancements.md` in the checkpoint sequence. The Review Lead Note in the Completion Phase (lines 318-321) is accurate and placed immediately after the pre-existing Scope Note, which is the correct location.

The Review Worker Exit Gate changes (lines 429-432) expand the table correctly: adding `review-context.md` to the required artifacts and adding a separate row for the Security review. The two issues noted in Minor Issues above (items 5 and 6) relate to these rows specifically.

The blockquote format for the Review Lead Note (lines 318-321) matches the formatting of the adjacent Scope Note (lines 313-316) — consistent.

**Specific Concerns**:
1. Line 431: Expected column uses mixed separator (`+`) and qualifier (`at least`) not present in other rows (minor)
2. Line 432: Expected column includes conditional logic not checkable by the Command column (minor — same rule as review-general.md TASK_2026_028 lesson)

---

## Pattern Compliance

| Pattern                              | Status | Concern |
| ------------------------------------ | ------ | ------- |
| YAML frontmatter present             | PASS   | Both new agents have correct frontmatter |
| Placeholder convention `{X}`        | FAIL   | review-lead.md uses `[ID]` style throughout |
| Numbered steps for procedural phases | PASS   | Phase steps are numbered in review-lead.md |
| ALL-CAPS section headers in agents   | FAIL   | code-security-reviewer.md line 51 uses Title Case |
| Sub-worker prompts self-contained    | PASS   | All three prompts include working directory and task folder |
| Exit Gate checklist present          | PASS   | Both review-lead.md and code-security-reviewer.md include exit/verdict checklists |
| Lesson update section present        | PASS   | All three files include lesson update instructions |
| Label format consistency             | FAIL   | review-lead.md label format differs from auto-pilot SKILL.md convention |

---

## Technical Debt Assessment

**Introduced**:
- Two placeholder conventions now coexist (`[ID]` in review-lead.md, `{TASK_YYYY_NNN}` in auto-pilot SKILL.md). Each new file added to this system must pick a convention, and without a documented standard, both will continue to appear.
- A potential new lesson destination (`security.md`) is referenced but not created, not documented in review-general.md, and not read by any other agent in the current system.

**Mitigated**:
- The monolithic Review Worker is replaced by a parallel system with explicit continuation checkpoints. This reduces the blast radius of a single worker failure significantly.
- code-security-reviewer.md adds a structured security checklist that did not previously exist, filling a gap that was producing inconsistent security review outputs.

**Net Impact**: Slight increase in technical debt from the placeholder convention split. The security.md destination issue will compound if multiple tasks run before it is resolved, producing a growing body of security lessons invisible to non-security reviewers.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `[ID]` placeholder convention used throughout review-lead.md is inconsistent with the `{TASK_YYYY_NNN}` convention used in every other prompt template in this codebase. Combined with the absence of an explicit substitution step in Phase 2, Review Lead sessions will pass literal `[ID]` strings to sub-worker prompts, causing all three sub-workers to fail silently when they cannot find `task-tracking/TASK_[ID]/review-context.md`.

---

## What Excellence Would Look Like

A 9/10 implementation of this task would:

1. Use `{TASK_YYYY_NNN}` and `{project_root}` consistently throughout review-lead.md, with an explicit "Substitution Step" in Phase 2 before any `spawn_worker` calls.
2. In Phase 5, either point exclusively to orchestration SKILL.md for Completion Phase steps (no partial reproduction), or reproduce them completely including the three-commit constraint.
3. Resolve the minimum-viable-condition inconsistency by defining it once (e.g., "minimum: style + logic reports") and cross-referencing that single definition from Phase 2, Phase 3, and the Exit Gate.
4. Use `## REQUIRED REVIEW PROCESS` (ALL-CAPS) in code-security-reviewer.md to match the other agent files.
5. Route all new security findings to `review-general.md` by default (same as other agents), with `security.md` as a secondary destination only after that file is created and added to the "files to read at start of review" instruction.
6. Add an explicit note to Phase 2's spawn code blocks showing what a fully substituted prompt looks like — removing any ambiguity about whether the template is passed as-is or after substitution.
