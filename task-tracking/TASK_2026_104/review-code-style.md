# Code Style Review — TASK_2026_104

## Review Summary

| Metric          | Value                                              |
| --------------- | -------------------------------------------------- |
| Overall Score   | 6/10                                               |
| Assessment      | NEEDS_FIXES                                        |
| Blocking Issues | 1                                                  |
| Serious Issues  | 4                                                  |
| Minor Issues    | 5                                                  |
| Files Reviewed  | 4                                                  |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`strategies.md` lines 186–198 and 204–222 contain two flow diagrams for RESEARCH sub-flows. Both diagrams label the clarification step "SCOPE CLARIFICATION (sub-flow selection — required)", which reads like implementation-era language still in place. A future contributor editing the file may interpret "sub-flow selection" as an alternative purpose for the existing Checkpoint 0 defined in `checkpoints.md`, or may add a new mechanism without knowing one already exists. The parenthetical is redundant with the sub-flow selection table that immediately follows, creating a two-source-of-truth risk for what Scope Clarification is supposed to achieve in RESEARCH.

### 2. What would confuse a new team member?

The `agent-catalog.md` Agent Selection Matrix (lines 42–43) now has two RESEARCH rows — "Research X" (old row) and "Market Research" / "Tech Eval" (new rows). The old "Research X" row still lists `nitro-researcher-expert -> architect` as its path and uses the trigger text "Technical questions", which describes the OLD minimal RESEARCH flow that no longer exists as a standalone sub-flow. A new team member reading the matrix would see three conflicting paths for research-type requests without a clear rule for when to use which.

### 3. What's the hidden complexity cost?

The Sub-Flow Table in `strategies.md` (lines 173–179) groups "Market Research" and "Competitive Analysis" as identical pipelines, and "Technology Evaluation" and "Feasibility Study" as identical pipelines. This is reasonable. However, the RESEARCH Keyword Triggers section (lines 225–236) and the Sub-Flow Selection table (lines 239–247) are partial duplicates of the Sub-Flow Table: all three enumerate the same keyword-to-sub-flow mappings. Any future keyword addition must be made in three places, and they can already be observed drifting: the Sub-Flow Table lists `"compare competitors"` while the Sub-Flow Selection table uses `"compare X vs Y"` for the same sub-flow.

### 4. What pattern inconsistencies exist?

- The Strategy Overview table (strategies.md line 15) shows `RESEARCH | Variable | PM, Researcher, [Architect]`, which is correct for the new design. However, SKILL.md line 32 shows `RESEARCH | PM -> Researcher -> [Architect] -> [conditional FEATURE]`. The SKILL.md representation omits the closing PM synthesis step (`PM (close)`) that was explicitly added in this task. The flow column in SKILL.md is inconsistent with strategies.md after this change.

- The `checkpoints.md` Checkpoint Applicability table (line 34) marks RESEARCH as `Requirements: No`. However, the new RESEARCH flow explicitly invokes `nitro-project-manager` in Phase 1 to produce `task-description.md`. This is Requirements work regardless of whether Checkpoint 1 is presented to the user — the table column header is "Requirements Validation" (the checkpoint), not "PM involvement". The distinction should be made explicit; as written it can be read as "PM is not used in RESEARCH", which is wrong after this change.

### 5. What would I do differently?

- Consolidate the three keyword-to-sub-flow mapping locations (Sub-Flow Table, Keyword Triggers section, Sub-Flow Selection table) into one canonical table. The other two sections should reference it by name rather than re-enumerating.
- Remove the "Research X" row from the agent-catalog.md Agent Selection Matrix or update it to forward-reference the new sub-flow rows rather than presenting a third, conflicting path.
- Update SKILL.md Strategy Quick Reference to include `PM (close)` in the RESEARCH flow entry, matching the sub-flow diagrams in strategies.md.

---

## Blocking Issues

### Issue 1: SKILL.md RESEARCH flow entry omits PM synthesis step

- **File**: `.claude/skills/orchestration/SKILL.md`, line 32
- **Problem**: The Strategy Quick Reference table shows `PM -> Researcher -> [Architect] -> [conditional FEATURE]` for RESEARCH. The PM synthesis / close step that was the explicit goal of this task is missing. The deliverable of this task — adding PM-driven synthesis at the end — is not reflected in the primary strategy routing table.
- **Impact**: Any orchestrator reading SKILL.md as the authoritative routing table (which is the intended use) will not invoke PM synthesis at the end of RESEARCH workflows. The change in strategies.md becomes a dead letter because SKILL.md is read first and does not match.
- **Fix**: Update SKILL.md line 32 to: `PM -> Researcher -> [Architect] -> PM (close) -> [conditional FEATURE]` to match the sub-flow diagrams in strategies.md.

---

## Serious Issues

### Issue 1: "Research X" row in agent-catalog.md conflicts with new sub-flow rows

- **File**: `.claude/skills/orchestration/references/agent-catalog.md`, line 42
- **Problem**: The old "Research X" row remains in the Agent Selection Matrix alongside the new "Market Research" and "Tech Eval" rows. The old row points to `nitro-researcher-expert -> architect` with trigger "Technical questions", which is the pre-task minimal flow. The new rows point to PM-first flows. A reader sees three RESEARCH paths with no disambiguation rule.
- **Tradeoff**: Removing the old row is low risk because the new rows cover all cases. Leaving it creates ambiguity every time someone reads the matrix.
- **Recommendation**: Either remove the "Research X" row entirely, or update its path to read "see Market Research / Tech Eval rows above" and change its trigger to "Generic research" so it is clearly a fallback, not a first-class path.

### Issue 2: Keyword list is duplicated three times across strategies.md

- **File**: `.claude/skills/orchestration/references/strategies.md`, lines 173–179, 225–236, 239–247
- **Problem**: Sub-Flow Table (keywords column), RESEARCH Keyword Triggers section, and Sub-Flow Selection table all enumerate keyword-to-sub-flow mappings. They already have minor divergences (`"compare competitors"` vs `"compare X vs Y"`).
- **Tradeoff**: Duplication here is the second addition of the pattern to this file. One more addition and there will be four independent copies, all expected to stay in sync manually.
- **Recommendation**: Keep the Sub-Flow Table as the authoritative mapping. Convert the Keyword Triggers section to a flat prose note saying "See Sub-Flow Table above for full keyword list." Convert the Sub-Flow Selection table to use identical phrases to the Sub-Flow Table, or collapse it into the Sub-Flow Table with an extra column.

### Issue 3: Scope Clarification purpose description in flow diagrams is ambiguous

- **File**: `.claude/skills/orchestration/references/strategies.md`, lines 187, 205
- **Problem**: Both RESEARCH flow diagrams label Phase 0 as "SCOPE CLARIFICATION (sub-flow selection — required)". The parenthetical "(sub-flow selection — required)" assigns a specific new purpose to Checkpoint 0 that does not appear in `checkpoints.md`'s Checkpoint 0 definition. This implies sub-flow selection is a separate mechanism, but no separate mechanism is defined. It also contradicts the general Checkpoint 0 description ("clarify ambiguous requests") by making it mandatory regardless of ambiguity.
- **Tradeoff**: Minor wording issue, but checkpoints.md is the canonical source for checkpoint behavior. Divergence between strategy diagrams and the canonical definition creates contradictory instructions for orchestrators.
- **Recommendation**: Remove the parenthetical or align it with checkpoints.md's language: "SCOPE CLARIFICATION — confirm sub-flow (market, competitive, tech eval, or feasibility)".

### Issue 4: checkpoints.md RESEARCH row can be misread as "PM not used"

- **File**: `.claude/skills/orchestration/references/checkpoints.md`, line 34
- **Problem**: The Checkpoint Applicability table marks RESEARCH as `Requirements: No`. After this task's changes, the new RESEARCH sub-flows all start with `nitro-project-manager` creating `task-description.md` in Phase 1. The column "Requirements" refers to the validation checkpoint, not PM involvement, but this distinction is not stated. A reader can reasonably conclude PM is not part of RESEARCH.
- **Tradeoff**: checkpoints.md is about checkpoints, not agent usage, so the column header is technically accurate. But the contrast with strategies.md creates confusion.
- **Recommendation**: Add a footnote below the table: "RESEARCH uses PM for scoping (Phase 1) but does not present Checkpoint 1 (Requirements Validation) to the user — PM output is consumed internally." Alternatively, add a "PM Used" column to make PM involvement visible separately from the checkpoint gate.

---

## Minor Issues

1. **strategies.md line 174 / line 245**: Sub-Flow Table uses `"compare competitors"` as a keyword; Sub-Flow Selection table uses `"compare X vs Y"` for the same sub-flow (Competitive Analysis). These should be identical for consistency across the two tables.

2. **strategies.md line 176**: Sub-Flow Table Pipeline column uses trailing space in `PM → Researcher → PM (close)  ` (trailing spaces in at least two cells). Cosmetic but inconsistent with other table rows which have no trailing spaces.

3. **strategies.md line 248**: Sub-Flow Selection table — "Ambiguous / general 'research'" row uses `Ask user to clarify` while other action cells use consistent short phrases. The value should match the style of other cells in that column.

4. **agent-catalog.md line 648**: `nitro-researcher-expert` Triggers section lists RESEARCH sub-flows with bullet labels (`Market Research:`, `Competitive Analysis:`, etc.) but the parallel `nitro-software-architect` Triggers section (lines 120–123) lists RESEARCH phases as plain bullet points without sub-flow labels. The formatting is inconsistent between the two entries that describe the same RESEARCH workflow.

5. **strategies.md line 258**: RESEARCH Review Criteria section uses `| Criterion | What to Check |` with 5 rows. This section existed before this task, but is not matched by a similar section in any other strategy. Since this task added substantial RESEARCH content, it is worth noting that the "actionable recommendations" criterion references `PM synthesis` implicitly but the criterion text says "does the report conclude with clear next steps" — which is the Researcher's output, not PM's. After this task's changes, PM synthesizes and provides the actual recommendation; the criterion should reference PM's synthesis output, not the Researcher's report.

---

## File-by-File Analysis

### strategies.md

**Score**: 6/10
**Issues Found**: 1 blocking, 3 serious, 3 minor

**Analysis**: The RESEARCH section adds substantial, well-structured content. Sub-flow diagrams are clear, the flow diagram format is consistent with other strategies, and the four-sub-flow breakdown maps correctly to the context.md design. The main problems are the three-way keyword duplication and the fact that the SKILL.md routing table was not updated to match — which means this file's changes are partially orphaned from the primary routing entry point.

**Specific Concerns**:

1. Lines 173–179, 225–236, 239–247: keyword list triplicated with diverging values (see Serious Issue 2)
2. Lines 187, 205: "(sub-flow selection — required)" parenthetical diverges from checkpoints.md (see Serious Issue 3)
3. Line 258 "Actionable recommendations" criterion describes Researcher output, not PM synthesis output

---

### SKILL.md

**Score**: 5/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

**Analysis**: The RESEARCH row in the Strategy Quick Reference table (line 32) and the expanded keyword detection row (line 110) were both updated. The keyword detection expansion is correct and complete. However the flow column for RESEARCH is missing the PM close step that is the primary deliverable of this task. This is the single most impactful location for an orchestrator to read strategy routing, and it does not reflect the new behavior.

**Specific Concerns**:

1. Line 32: RESEARCH flow missing `PM (close)` — blocking issue (see Blocking Issue 1)

---

### agent-catalog.md

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: The `nitro-researcher-expert` entry was updated with detailed sub-flow trigger bullets — this is well done and adds useful specificity. The `nitro-software-architect` entry was updated to list RESEARCH phase 3 triggers — also correct. The problem is the Agent Selection Matrix, which received new rows for the new sub-flows but left the old conflicting "Research X" row in place.

**Specific Concerns**:

1. Line 42: "Research X" row conflicts with new rows (see Serious Issue 1)
2. Line 648 vs lines 120–123: inconsistent bullet formatting for RESEARCH triggers between researcher and architect entries (see Minor Issue 4)

---

### checkpoints.md

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The change to this file was minimal — the RESEARCH row in the Checkpoint Applicability table. The RESEARCH row was already present; the task confirmed no change was needed to the checkpoint gates (RESEARCH does not get Requirements Validation). The file is otherwise untouched and well-structured. The one concern is that the table as updated can be misread to imply PM is not used in RESEARCH at all.

**Specific Concerns**:

1. Line 34: `Requirements: No` can be misread as "PM not involved" (see Serious Issue 4)

---

## Pattern Compliance

| Pattern                           | Status | Concern                                                                                |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Heading hierarchy consistent      | PASS   | All new sections use H3 under H2, consistent with file conventions                    |
| Table alignment                   | PASS   | Column separators aligned, trailing pipes present                                      |
| Code fence language tags          | PASS   | Flow diagrams use plain code fences (no language tag), consistent with existing style  |
| Agent name casing (nitro-* prefix)| PASS   | All agent references use correct nitro- prefix and kebab-case                          |
| Single source of truth            | FAIL   | Keyword-to-sub-flow mapping exists in 3 locations in strategies.md                     |
| Cross-file consistency            | FAIL   | SKILL.md flow entry for RESEARCH does not match strategies.md sub-flow diagrams        |
| Implementation-era language       | WARN   | "(sub-flow selection — required)" reads like authoring-time annotation                 |
| Named concept consistency         | PASS   | "Market Research", "Competitive Analysis", "Technology Evaluation", "Feasibility Study" used consistently across all files |

---

## Technical Debt Assessment

**Introduced**:
- Three-way keyword duplication in strategies.md creates a maintenance trap: any future keyword addition requires three edits to one file, with no mechanism to detect drift.
- The "Research X" row in agent-catalog.md is now dead weight — it describes a flow that no longer exists as a standalone path.

**Mitigated**:
- The RESEARCH section in strategies.md is now substantially more complete and actionable than the minimal pre-task version.
- Agent catalog entries for researcher and architect now explicitly describe RESEARCH sub-flow roles, reducing ambiguity about when each agent is invoked.

**Net Impact**: Slightly negative on debt. The content additions are correct and valuable, but the duplication pattern and the orphaned SKILL.md entry create two small but real maintenance burdens that will compound over time.

---

## Verdict

**Recommendation**: NEEDS_FIXES
**Severity**: MEDIUM
**Confidence**: HIGH
**Key Concern**: SKILL.md line 32 is the first-read routing table for any orchestrator. It does not reflect the PM synthesis step that is the primary deliverable of this task. An orchestrator following SKILL.md will not invoke PM (close) at the end of RESEARCH workflows. This must be fixed before the task is marked COMPLETE.

Secondary: the "Research X" row conflict in agent-catalog.md and the three-way keyword duplication in strategies.md should be resolved — they are not blocking but will confuse future contributors.

---

## What Excellence Would Look Like

A 9/10 implementation of this change would:

1. Update SKILL.md line 32 to show `PM -> Researcher -> [Architect] -> PM (close) -> [conditional FEATURE]`
2. Collapse the three keyword-to-sub-flow mapping locations in strategies.md into one canonical Sub-Flow Table, with the other two sections referencing it by name
3. Remove or forward-reference the "Research X" row in agent-catalog.md
4. Add a footnote to checkpoints.md clarifying that RESEARCH uses PM without presenting Checkpoint 1 to the user
5. Align the parenthetical in the RESEARCH flow diagrams with checkpoints.md's Checkpoint 0 language
