# Code Style Review — TASK_2026_027

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 5/10                                 |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3                                    |
| Serious Issues  | 2                                    |
| Minor Issues    | 3                                    |
| Files Reviewed  | 2                                    |

## The 5 Critical Questions

### 1. What could break in 6 months?

**Orphaned instruction in auto-pilot/SKILL.md**: Line 265 contains `Step 3b: File Scope Overlap Detection` but line 263 already has `Step 3b: Check Strategic Plan`. This is a duplicate section header that will confuse any agent trying to parse the file sequentially. An agent following "Step 3b" will see two definitions and may apply the wrong one.

**Missing Shared Review Context file creation instruction**: The task context.md specifies that `review-context.md` should be generated before spawning review workers (Part A of the solution), but I found no instruction in auto-pilot/SKILL.md that actually creates this file. The Review Worker prompt tells workers to read it, but no one writes it. This creates a runtime failure when the file doesn't exist.

### 2. What would confuse a new team member?

**Inconsistent step numbering in auto-pilot/SKILL.md**: Between lines 263-305, there are multiple issues:
- Line 263: "Step 3b: Check Strategic Plan"
- Line 265: "Step 3b: File Scope Overlap Detection" (duplicate 3b)
- Line 307: Step continues with file scope content that's labeled as 3b but comes after step 3b
- Line 280: Contains "IF task-tracking/plan.md exists:" which appears to belong to the earlier Check Strategic Plan section

This structural confusion makes it impossible to follow the documented sequence.

**Template markdown inconsistency**: task-template.md uses HTML-style comments (`<!-- -->`) while auto-pilot/SKILL.md uses markdown headers for documentation. While not functionally wrong, it creates inconsistent documentation style across the codebase.

### 3. What's the hidden complexity cost?

**Escaped apostrophe on line 269**: `each task'\''s File Scope` uses a shell-escaped apostrophe (`'\''`). This is clearly copy-paste trauma from a shell command and will render incorrectly in markdown. Readers will see a literal backslash-backslash-quote sequence instead of a proper apostrophe.

**Hardcoded escape character without explanation**: The escape pattern `'\''` appears on lines 269, 271, 277, and 689. These are artifacts from shell string quoting that leaked into the markdown. Each occurrence requires manual cleanup and future editors will repeat the mistake if they don't recognize the pattern.

### 4. What pattern inconsistencies exist?

**Review context instruction location**: The Review Worker prompt (lines 682-691) instructs workers to read `review-context.md`, but this instruction is not paired with a corresponding Supervisor step that creates the file. This breaks the "specification then implementation" pattern where every worker input has a defined source.

**File scope section without reference**: task-template.md adds a "File Scope" section but no documentation in auto-pilot/SKILL.md explicitly references this section name or explains its purpose to workers. Workers are told to read it but not why it matters.

### 5. What would I do differently?

**Split the changes**: The task modifies two files for distinct purposes (Supervisor logic vs. task template). These should have been separate tasks or at minimum, clearly separated phases in the implementation plan.

**Add integration test step**: The task should include a verification step that runs `/auto-pilot --dry-run` to confirm the overlap detection logic doesn't break the existing flow.

**Reference the solution section in context.md**: Lines 26-38 of context.md clearly define Part A and Part B of the solution, but the implementation doesn't explicitly map which lines implement each part. This makes it impossible to verify that the full solution was delivered.

## Blocking Issues

### Issue 1: Duplicate Step 3b Section Header

- **File**: `.claude/skills/auto-pilot/SKILL.md:265`
- **Problem**: Line 265 contains "### Step 3b: File Scope Overlap Detection" but line 263 already defines "### Step 3b: Check Strategic Plan". This creates two Step 3b sections.
- **Impact**: Any agent or human reading sequentially will encounter conflicting section definitions. The "Check Strategic Plan" content (lines 281-304) appears orphaned after the File Scope section, making the document structure ambiguous.
- **Fix**: Renumber sections to maintain sequential ordering. Either merge both into Step 3b with subsections, or renumber to 3b and 3c.

### Issue 2: Shell Escape Artifacts in Markdown

- **File**: `.claude/skills/auto-pilot/SKILL.md:269, 271, 277`
- **Problem**: Contains shell-escaped apostrophes (`'\''`) that render as literal backslash-backslash-quote sequences in markdown. Example: "each task'\''s File Scope" should be "each task's File Scope".
- **Impact**: Text renders incorrectly and creates maintenance burden. Future editors will see the escape pattern and may repeat it.
- **Fix**: Replace all occurrences of `'\''` with `'` (apostrophe).

### Issue 3: Missing Shared Review Context File Creation

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Problem**: context.md Part A specifies generating `review-context.md` before spawning review workers. Review Worker prompt (line 683) tells workers to read this file. However, there is no Supervisor step that creates `review-context.md`.
- **Impact**: Review Workers will fail to find the file they're instructed to read. The feature is half-implemented—consumption instruction exists without production instruction.
- **Fix**: Add a new step (e.g., "Step X: Generate Shared Review Context") that creates `task-tracking/review-context.md` before spawning Review Workers, OR document that the file is optional and workers should proceed without it.

## Serious Issues

### Issue 1: Step 3b Section Structure Broken

- **File**: `.claude/skills/auto-pilot/SKILL.md:263-304`
- **Problem**: The "Step 3b: Check Strategic Plan" section header at line 263 is followed by content starting at line 280 that begins "IF task-tracking/plan.md exists:". However, lines 265-279 contain File Scope Overlap Detection content. The plan.md check content appears to belong to the earlier Step 3b but is displaced.
- **Tradeoff**: This makes the document unparseable for agents that rely on section boundaries. Content under a section header should immediately follow that header.
- **Recommendation**: Restructure to clear separation:
  ```markdown
  ### Step 3b: Check Strategic Plan
  [plan.md content here]

  ### Step 3c: File Scope Overlap Detection
  [file scope content here]
  ```

### Issue 2: No Verification of File Scope Content Format

- **File**: `.claude/skills/auto-pilot/SKILL.md:267-272`
- **Problem**: The overlap detection instruction (lines 267-272) says "Extract File Scope from each task's File Scope section" but doesn't specify the expected format (bulleted list? comma-separated? paths only?). task-template.md shows a bulleted list format but the SKILL.md doesn't reference or validate this.
- **Tradeoff**: Workers implementing this step may parse File Scope inconsistently, leading to false negatives (overlaps missed) or false positives (non-overlaps flagged).
- **Recommendation**: Either add a format specification in SKILL.md that matches task-template.md's format, OR add a validation step that checks File Scope format before attempting overlap detection.

## Minor Issues

1. **task-template.md:59** - Line 59 uses `- [None]` as a placeholder. For consistency with other sections that use empty lines or explicit "None", consider using `None` without brackets or keeping it as-is but documenting the convention.

2. **auto-pilot/SKILL.md:689** - Line 689 has the same shell escape artifact (`'\''`) in Review Worker prompt: `Review and fix ONLY issues within your task'\''s file scope`.

3. **task-template.md:57-63** - The File Scope section comment describes the purpose but doesn't specify that values should be file paths with absolute or relative format. Adding this detail would reduce ambiguity.

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 4/10
**Issues Found**: 3 blocking, 2 serious, 2 minor

**Analysis**:
This file implements the Supervisor's file scope overlap detection and review context instructions. The implementation is functionally incomplete and has structural issues.

**Specific Concerns**:

1. **Line 263-265**: Duplicate "Step 3b" headers create structural ambiguity. "Check Strategic Plan" and "File Scope Overlap Detection" both claim step 3b.

2. **Lines 269, 271, 277, 689**: Shell escape sequences `'\''` render incorrectly in markdown. These are copy-paste artifacts from shell commands.

3. **Lines 267-272**: File scope overlap detection logic exists but doesn't specify expected format. The instruction to "Extract File Scope" is vague.

4. **Line 280**: "IF task-tracking/plan.md exists:" appears to belong to the Check Strategic Plan section but is displaced after File Scope content.

5. **Lines 682-691**: Review Worker prompt instructs reading `review-context.md` but no Supervisor step creates this file. Half-implemented feature.

6. **Missing instruction**: context.md Part A (lines 25-30) requires generating `review-context.md` with project conventions, style decisions, and tech stack constraints. None of this is implemented in SKILL.md.

**What would break**: A Review Worker spawned with line 683 instruction to read `review-context.md` will fail to find it. The overlap detection logic may work (bulleted list parsing is common) but isn't guaranteed.

### `task-tracking/task-template.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**:
This file adds the File Scope section to the task template as specified in context.md Part B.

**Specific Concerns**:

1. **Line 59**: Uses `- [None]` as placeholder. Consistent with checkbox syntax elsewhere in the file, but the convention for "no values" isn't documented.

2. **Lines 60-62**: Comment clearly explains File Scope's purpose (used by supervisor to detect overlaps, prevent cross-task interference). This is good documentation.

**What works well**: The section placement (after References, before document end) is logical. The comment format matches existing sections. The use of bulleted list format is parseable.

**What's missing**: No specification of whether file paths should be absolute or relative. This is fine for now (supervisor can handle either) but should be documented for consistency.

## Pattern Compliance

| Pattern            | Status    | Concern        |
| ------------------ | --------- | -------------- |
| Markdown syntax    | PASS/FAIL | Shell escape artifacts (`'\''`) render incorrectly |
| Section structure  | FAIL       | Duplicate Step 3b headers break sequential flow |
| Specification completeness | PASS/FAIL | Review context file consumption exists without production |
| Template consistency | PASS       | File Scope section matches existing template style |

## Technical Debt Assessment

**Introduced**: Orphaned File Scope content (lines 265-279) that isn't clearly integrated into the step sequence. Half-implemented review context feature (consumption instruction without production step).

**Mitigated**: None identified.

**Net Impact**: Negative. The codebase is more confusing with duplicate section headers and shell escape artifacts than before. The partial review context implementation creates a trap where workers are instructed to read a file that no step creates.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: Missing review-context.md file creation step—Review Workers will fail to find the file they're instructed to read.

## What Excellence Would Look Like

A 10/10 implementation would include:

1. Clear step numbering without duplicates—Step 3b and 3c properly separated.

2. A new step (e.g., Step X: Generate Shared Review Context) that creates `task-tracking/review-context.md` with:
   - Project conventions from plan.md decisions log
   - Style decisions from completed reviews in `.claude/review-lessons/`
   - Tech stack constraints
   - Clear instruction on what to include when review-context.md doesn't exist

3. Explicit File Scope format specification matching task-template.md:
   ```
   Extract File Scope as a bulleted list of file paths:
   - path/to/file1
   - path/to/file2
   ```

4. No shell escape artifacts—all apostrophes rendered correctly.

5. The context.md solution parts (Part A and Part B) explicitly mapped to implementation sections with line references.

6. A dry-run verification step that confirms the new logic doesn't break existing workflows.
