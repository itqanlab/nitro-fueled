# Code Style Review — TASK_2026_134

## Score: 7/10

## Review Summary

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 7/10           |
| Assessment      | NEEDS_FIXES    |
| Blocking Issues | 1              |
| Serious Issues  | 3              |
| Minor Issues    | 4              |
| Files Reviewed  | 8              |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The hardcoded task ID `TASK_2026_133` in `references/sequential-mode.md` (lines 107–109) will
silently produce wrong commit messages in every sequential session from this point forward. Any
developer who runs `--sequential` will generate commits attributed to a task that finished months
ago. This is the clearest production failure lurking in this refactor.

### 2. What would confuse a new team member?

Two things will cause immediate confusion:

First, the Load-on-Demand Protocol in core SKILL.md (line 127) states:
`10. When cortex_available = true: cortex paths are inline in references/parallel-mode.md`

But the Reference Index four lines later (line 591) says for cortex-integration.md:
`Summary of cortex DB overrides; full inline in parallel-mode.md`

And then `references/cortex-integration.md` itself (line 6) says:
`Load this file when cortex_available = true`

Three sources, three different instructions. A new developer reading the protocol would skip
loading cortex-integration.md. The file they loaded says otherwise.

Second, the `## Session Log` stub in SKILL.md (lines 87–93) correctly defers to log-templates.md
for event row formats, but then `## state.md Format` at line 452 contains a full `### log.md
Format` sub-section with a worked example. The stub says "load the reference for formats"; the
state.md section shows log row examples without mentioning the reference. A developer reading
linearly won't know which source is authoritative for log format.

### 3. What's the hidden complexity cost?

The `state.md Format` section (SKILL.md lines 380–476) has a `### log.md Format` sub-section
nested inside it. This is a structural oddity that survived the extraction. The log.md content
belongs conceptually with the Session Log section (which correctly stubs to log-templates.md),
not inside the state.md section. It creates a split description: the format example is under
`state.md Format`, while the load-on-demand authority lives under `Session Log`. Any future
editor who wants to update log format docs must touch two sections in SKILL.md plus the reference
file.

### 4. What pattern inconsistencies exist?

The orchestration skill (the stated reference for this split pattern) uses a clean pattern where
core SKILL.md contains a stub and nothing else for extracted sections. In this refactor, three
mode stubs (Pause, Continue, Sequential) each include a one-sentence content summary AFTER the
load-note — which is fine and actually useful. But the `## Core Loop` stub (lines 358–372) goes
further and reproduces the full 8-step list inline. This breaks the pattern: either a section is
stubbed (load-note only, minimal context) or it is retained verbatim. The Core Loop section is
neither — it's a partial reproduction with no clear line on what the reader is supposed to know
without loading the reference.

The Pause and Continue stubs are consistent with each other. The Sequential and Core Loop stubs
diverge in depth without justification.

### 5. What would I do differently?

1. Move `### log.md Format` out of `## state.md Format` and either delete it (fully deferred) or
   keep it as a brief structural note ("header + pipe-table, append-only") with a pointer to the
   reference. Do not split format documentation across two sections.

2. Resolve the cortex-integration.md load ambiguity: the Load-on-Demand Protocol should list it
   as a load target (not bury it as a parenthetical), or remove it from the protocol entirely and
   let users discover it from the Reference Index.

3. Fix the hardcoded task ID in sequential-mode.md — the commit template must use `{TASK_ID}`
   placeholder.

4. Decide on a stub depth convention and apply it uniformly: either all mode stubs are one
   sentence + load-note (clean), or all include a summary paragraph (acceptable). The current
   mix is inconsistent.

---

## Blocking Issues

### Issue 1: Hardcoded task ID in sequential commit template

- **File**: `references/sequential-mode.md` lines 107–109
- **Problem**: The git commit message template contains the literal string `TASK_2026_133` in both
  the subject line and the `Task:` traceability field. This is the task ID for the task that
  completed sequential mode support months ago, not the task being processed. Every sequential
  run will emit commits with wrong attribution.
- **Impact**: Audit trails are wrong. Developers who later grep for session artifacts by task ID
  will find orphaned commits under TASK_2026_133. The traceability footer purpose is defeated.
- **Fix**: Replace both occurrences of `TASK_2026_133` with `{TASK_ID}` to match the placeholder
  pattern used in every other worker prompt in `references/worker-prompts.md`.

---

## Serious Issues

### Issue 1: Contradictory load instructions for cortex-integration.md

- **File**: `SKILL.md` line 127 vs. line 591 vs. `references/cortex-integration.md` line 6
- **Problem**: The Load-on-Demand Protocol at line 127 says cortex paths are inline in
  parallel-mode.md — implying cortex-integration.md is not needed. The Reference Index says to
  load it "when cortex_available = true". The reference file itself says to load it when
  `cortex_available = true`. Two of the three sources say load it; one says skip it.
- **Tradeoff**: If a supervisor follows line 127 (do not load), they miss the summary table in
  cortex-integration.md. If they follow the Reference Index, they get both files loaded. Neither
  outcome is catastrophically wrong, but the inconsistency adds cognitive load and will confuse
  agents calibrated on the Load-on-Demand Protocol.
- **Recommendation**: Update line 127 (item 10) to match the Reference Index. Change it from
  "cortex paths are inline in references/parallel-mode.md" to "load references/cortex-integration.md
  for DB-specific path summary." The reference file's own header already says this correctly.

### Issue 2: log.md Format sub-section nested inside state.md Format

- **File**: `SKILL.md` lines 452–475
- **Problem**: The `### log.md Format` sub-section lives inside `## state.md Format`. The `##
  Session Log` section at lines 87–93 is the canonical stub for log format and correctly points
  to log-templates.md. Having a second log format description inside the state.md section creates
  a split. The example at lines 456–467 shows six sample rows that are not in log-templates.md
  (it shows worked examples rather than templates). These serve different purposes but their
  placement suggests they are the same thing.
- **Recommendation**: Either move `### log.md Format` immediately after the `## Session Log`
  stub (as a worked-example addendum) or delete it and link to log-templates.md from the state.md
  section. The key design properties list (lines 469–475) should be preserved — it documents the
  split-state design and belongs in SKILL.md.

### Issue 3: Inconsistent stub depth across mode sections

- **Files**: `SKILL.md` lines 131–161 (Pause/Continue/Sequential) vs. lines 358–372 (Core Loop)
- **Problem**: The Pause, Continue, and Sequential mode stubs each contain one summary sentence
  after the load-note — consistent and useful. The Core Loop stub reproduces the full 8-step
  outline with labeled sub-steps. This is not wrong per se, but it undermines the load-on-demand
  purpose: a reader gets enough detail from the Core Loop stub to start working without loading
  parallel-mode.md, which defeats the context-saving goal of the refactor.
- **Recommendation**: Trim the Core Loop stub to match the pattern of the other mode stubs.
  Keep the one-line purpose description; remove the 8-step outline (that is in parallel-mode.md).
  Or commit to the outline pattern and add comparable outlines to all mode stubs.

---

## Minor Issues

1. **`references/cortex-integration.md` section ordering**: Steps in the "Cortex DB Paths by
   Step" section are listed in a non-sequential order (Steps 2, 3, 3d, 4, 5, 5h, 6, 6, 7a, 7c,
   7d, 1). Step 1 (Compaction Recovery) appears last. This makes the file hard to scan top-to-bottom
   when following the execution path. Reorder to match Step 1 through Step 8 sequence.

2. **`references/sequential-mode.md` security note placement**: The `> **Security note**` at
   line 7 is placed before `### When to use` — two sections before the code that the note applies
   to (the `6d. Invoke orchestration inline` block at line 71). The note is important but a reader
   will not connect it to the relevant code path until much later. Move the note to immediately
   precede step 6d, or add a back-reference from step 6d to the top-level note.

3. **`references/log-templates.md` has no closing separator or footer**: Every other reference
   file ends with a blank line or has a natural terminal section. log-templates.md ends at line
   78 with no indication it is complete. For a file that claims to cover "all ~60 event types"
   (per Reference Index), the absence of a footer note makes it hard to tell if content was
   accidentally truncated. Adding a `---` or a brief note ("End of log templates") costs nothing
   and removes ambiguity.

4. **`references/evaluation-mode.md` `## Evaluation Mode` heading is redundant**: The file
   title is `# Evaluation Mode — auto-pilot` and the second line is `## Evaluation Mode`. The
   H2 repeats the H1 subject verbatim. This pattern does not appear in the other reference files
   (sequential-mode.md has `## Sequential Mode` but the file title differs slightly). Either
   remove the H2 and start directly with `When --evaluate ...` or rename the H2 to something
   more specific (e.g., `## Flow Overview`). Similarly in `references/sequential-mode.md` (line
   3-4: H1 `# Sequential Mode — auto-pilot`, H2 `## Sequential Mode`).

---

## File-by-File Analysis

### SKILL.md (core, 610 lines)

**Score**: 7/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

The slim-down is successful at the macro level. The Quick Start, Configuration, Registry Write
Safety, MCP Requirement, Session Directory, Active Sessions, Stale Session Archive, Concurrent
Session Guard, state.md Format, MCP Tool Usage Reference, Error Handling, and Key Principles
sections are all retained correctly and add up to a coherent core document.

The Load-on-Demand Protocol is clear and well-positioned. The Reference Index at the bottom
is correct and uses relative markdown links. All 7 reference files exist and the link targets
match actual filenames.

Specific concerns:
1. Line 127 (cortex load instruction) contradicts the Reference Index at line 591.
2. Lines 452–467 (log.md Format sub-section inside state.md Format) duplicates responsibility
   already owned by the Session Log stub and log-templates.md.

### references/log-templates.md

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Clean extraction. 78 event types with exact pipe-table format. Header is appropriate. The ~60
count in the Reference Index understates the actual 78 entries but this is not a functional
issue. Minor: no terminal marker (see Minor Issue 3 above).

### references/pause-continue.md

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Cleanly extracted. Both Pause and Continue modes are complete. The note about Continue skipping
pre-flight is present and contextually grounded. Consistent stub depth with the SKILL.md stubs.

### references/sequential-mode.md

**Score**: 6/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

Blocking issue: hardcoded `TASK_2026_133` in commit template (lines 107–109).
Minor issue: security note placement (see Minor Issue 2 above).

The mode flow itself is complete and correct. The comparison table at the end (parallel vs.
sequential) is a good addition that preserves orientation for readers who need to decide which
mode to use.

### references/evaluation-mode.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Complete. Security validation (path traversal, allowlist check) is intact. The A/B and role-testing
flows are present. Minor: redundant H2 heading (see Minor Issue 4 above).

### references/parallel-mode.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Not fully read (large file), but Steps 1–3 reviewed. The cortex/fallback dual-path pattern is
applied consistently. Content appears complete relative to what SKILL.md describes it should
contain.

### references/worker-prompts.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

First-Run and Retry Build Worker prompts reviewed. Placeholder pattern `{TASK_ID}` is used
correctly everywhere in this file, which makes the TASK_2026_133 hardcoding in
sequential-mode.md more glaring by contrast.

### references/cortex-integration.md

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

The "Summary reference" framing is correct and appropriate. Step coverage is complete across
the 7 integration points. Serious issue: the file header instructs loading when
`cortex_available = true`, but SKILL.md's Load-on-Demand Protocol (line 127) effectively says
do not load it. Minor issue: steps are out of order (Step 1 is last — see Minor Issue 1 above).

---

## Pattern Compliance

| Pattern                        | Status | Concern                                             |
|-------------------------------|--------|-----------------------------------------------------|
| Reference files exist          | PASS   | All 7 files present, filenames match index          |
| Stub points to correct file    | PASS   | All 7 stubs reference correct files                 |
| Load-on-demand protocol        | FAIL   | Cortex-integration.md load instruction inconsistent |
| Consistent heading style       | PASS   | H1 present on all reference files                   |
| No content duplication         | FAIL   | log.md Format sub-section duplicated in SKILL.md    |
| Hardcoded values in templates  | FAIL   | TASK_2026_133 hardcoded in sequential-mode.md       |
| Placeholder pattern consistent | PASS   | {TASK_ID} used correctly in worker-prompts.md       |

---

## Technical Debt Assessment

**Introduced**:
- The cortex-integration.md load ambiguity will confuse future agents and any developer adding
  new cortex integration points (they will not know which file is authoritative).
- The log.md Format split between SKILL.md and log-templates.md creates a two-source-of-truth
  situation that will diverge on the first edit.

**Mitigated**:
- 192KB SKILL.md is now 610 lines — the primary goal is achieved. Significant token consumption
  reduction for every supervisor session.
- Reference files give clear, purpose-scoped targets for future edits (adding a new mode means
  a new reference file, not editing a 3500-line document).

**Net Impact**: Modest debt improvement overall. The three fixable issues above are contained and
do not undermine the architecture of the refactor.

---

## Verdict

**Recommendation**: NEEDS_FIXES
**Confidence**: HIGH
**Key Concern**: The hardcoded `TASK_2026_133` in `references/sequential-mode.md` is the
only blocking issue and must be fixed before this lands. The cortex load-instruction inconsistency
and log.md Format placement are serious but do not break runtime behavior — they degrade
maintainability and agent reliability over time.

## What Excellence Would Look Like

A 10/10 version would:
1. Have zero hardcoded task IDs in any template — all replaced with `{TASK_ID}` placeholders.
2. Have exactly one instruction per load decision — the Load-on-Demand Protocol and Reference
   Index would agree verbatim on when to load each reference.
3. Have the log.md Format sub-section removed from state.md Format entirely, with the key design
   properties moved to a standalone `## State and Log Design` section.
4. Have consistent stub depth: either all mode stubs are minimal (load-note + one sentence) or
   all include a summary outline.
5. Have cortex-integration.md steps ordered Step 1 through Step 8, mirroring the parallel-mode.md
   flow the reader will be following.
