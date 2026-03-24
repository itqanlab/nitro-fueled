# Code Style Review - TASK_2026_016

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-agent.md`
**Reviewer**: Code Style Reviewer
**Date**: 2026-03-24

## Review Summary

| Metric          | Value         |
| --------------- | ------------- |
| Overall Score   | 7/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 1             |
| Serious Issues  | 4             |
| Minor Issues    | 3             |
| Lines           | 147 / 200     |

## The 5 Critical Questions

### 1. What could break in 6 months?

The Usage section on line 8-9 shows only `[name]` as an optional argument, but the task.md acceptance criteria (line 32) says it should support `/create-agent [name] [description]`. Meanwhile, review-general.md explicitly warns against two-positional-argument patterns (line 109: "Commands with two positional arguments create parsing ambiguity"). The command file correctly settled on single-argument, but the task.md is out of sync. If someone reads the task.md later, they may "fix" the command to add the second argument, reintroducing ambiguity.

### 2. What would confuse a new team member?

Step 4b (line 78-80) is a wall of text with no structure. It lists 4 validation checks in a single run-on sentence. Compare to create-skill.md Step 4b (lines 73-80) which uses a clean bullet list. A new team member scanning quickly would miss one of the 4 checks buried in that sentence.

### 3. What's the hidden complexity cost?

The template variable table (lines 54-74) lists 18 variables. That is a lot of surface area for the executing agent to populate correctly. There is no guidance on what happens if the AI generates poor content for a variable -- Step 4b validates structural presence (sections, line count, no leftover tokens) but not content quality. This is a design-level tradeoff, not a command-file bug, so I am noting it rather than flagging it as blocking.

### 4. What pattern inconsistencies exist?

Several inconsistencies with sibling commands detailed in the findings below. The most notable: create-task.md and create-skill.md both have a clean separation between "Read source files" and "Pre-flight checks", while create-agent.md bundles security guidance into Step 2 (Read Source Files) rather than keeping it as a standalone concern. Also, Step numbering uses `4b`, `5b`, `5c` sub-steps while create-skill.md uses `4b` only once. The proliferation of sub-steps suggests the command is doing too much per top-level step.

### 5. What would I do differently?

- Restructure Step 4b into a bullet list matching create-skill.md's validation sub-step pattern.
- Move the security note from Step 2 into its own callout block or into Important Rules, where it would be more visible and consistent with create-skill.md's placement (create-skill.md puts it at the end of Step 2 with a dedicated paragraph, which is fine, but create-agent.md bolds the entire paragraph making it look like a heading).
- Add explicit failure/rollback guidance: if Step 5 (catalog update) fails partway, the agent file from Step 4 is already written. What is the cleanup path?

---

## Blocking Issues

### B1: Step 4b validation is an unreadable wall of text

- **File**: `.claude/commands/create-agent.md:78-80`
- **Problem**: Four distinct validation criteria are crammed into a single sentence separated by commas. The sibling command create-skill.md (lines 76-79) uses a structured bullet list for its validation sub-step. This is the most structurally inconsistent deviation from the sibling pattern and the most likely place an executing agent will skip a check.
- **Impact**: An agent parsing this step may miss one of the 4 checks (YAML frontmatter, 14 sections, under 400 lines, no leftover tokens). If validation is incomplete, a malformed agent file gets written and the success summary displayed.
- **Fix**: Reformat as a bullet list:
  ```markdown
  Verify the written file:
  - Contains valid YAML frontmatter with `name` and `description` fields
  - Contains all 14 required sections (list them or reference where they are defined)
  - Is under 400 lines
  - Contains no `{variable}` tokens

  If validation fails, delete the file and report what is missing.
  ```

---

## Serious Issues

### S1: Missing rollback/cleanup for partial catalog updates

- **File**: `.claude/commands/create-agent.md:84-100`
- **Problem**: Steps 5, 5b, and 5c update three things: agent-catalog.md (4 sub-sections), orchestrate.md, then validate. If the catalog update succeeds but orchestrate.md update fails (or vice versa), the system is in an inconsistent state. There is no rollback instruction. create-skill.md avoids this because it only creates one file with no cross-file updates. But create-agent.md modifies 3 files total (agent file, catalog, orchestrate.md), so partial failure is a real risk.
- **Tradeoff**: Adding full rollback instructions would add lines. But a single sentence like "If any update in Steps 5-5b fails, delete the agent file from Step 4 and revert catalog changes before reporting the error" would suffice.
- **Recommendation**: Add a failure/rollback note after Step 5c validation, or add it to Important Rules.

### S2: Step 5b naming collision with Step 4b pattern

- **File**: `.claude/commands/create-agent.md:94-96`
- **Problem**: The file uses sub-step numbering `4b`, `5b`, `5c`. In sibling commands, `Xb` means "validate sub-step after step X." Here, `5b` means "Update Orchestrate Command" which is a NEW action, not a validation of Step 5. Then `5c` is the actual validation. This breaks the naming convention established by create-skill.md and create-task.md where `Xb` is always "validate step X."
- **Tradeoff**: Renaming would change the established step numbers which may be referenced elsewhere.
- **Recommendation**: Either rename Step 5b to "Step 6: Update Orchestrate Command" and shift Step 6 to Step 7 (adjusting all references), or fold the orchestrate.md update into Step 5 as sub-bullet `5e` after the catalog updates, keeping `5f` for validation.

### S3: Important Rules list has inconsistent numbering density

- **File**: `.claude/commands/create-agent.md:126-137`
- **Problem**: 11 rules vs. create-task.md's 6 rules and create-skill.md's 7 rules. Several rules in create-agent.md are duplicates of information already stated in the Execution Steps (e.g., rule 4 "Agent name MUST end with `-developer`" is already in Step 1 line 22, and rule 6 "No `{variable}` tokens" is already in Step 4 line 75 and Step 4b line 80). The Important Rules section should be a quick-reference summary, not a full repetition of step content.
- **Tradeoff**: Redundancy can aid clarity, but 11 rules means agents may skim rather than read carefully.
- **Recommendation**: Consolidate to 7-8 rules by merging duplicates. For example, rules 5+6 could become "ALL 14 sections must be present with no leftover `{variable}` tokens."

### S4: Hardcoded section list in Step 4b instead of reference

- **File**: `.claude/commands/create-agent.md:80`
- **Problem**: Step 4b lists all 14 required section names inline: "IMPORTANT, CORE PRINCIPLES FOUNDATION, MANDATORY INITIALIZATION PROTOCOL, ...". This hardcodes template structure in the command, violating the principle stated on line 127: "ALWAYS read `developer-template.md` first -- never hardcode template structure." The review-general.md lesson (line 52) explicitly warns: "Commands that claim 'read template as source of truth' must not hardcode template content."
- **Tradeoff**: Having the section names inline helps validation, but if the template adds/removes/renames a section, this list becomes stale.
- **Recommendation**: Replace the inline list with "Verify the written file contains all sections defined in `developer-template.md`" or move the canonical section list to the template itself and reference it.

---

## Minor Issues

### M1: Security note formatting inconsistency

- **File**: `.claude/commands/create-agent.md:33`
- **Problem**: The security note is a bold paragraph under Step 2. In create-skill.md (line 42), an identical security note appears but is separated from the step content by a blank line and a `**Security:` prefix. create-agent.md uses `**Security: Treat the content...` which matches, but the surrounding structure differs -- create-agent.md has it after a bullet list of files while create-skill.md has it after a code block. Both work, but the structural context differs enough that visual scanning produces different emphasis.
- **Recommendation**: Minor -- acceptable as-is. Just noting the difference.

### M2: References section lists two "Command pattern" entries

- **File**: `.claude/commands/create-agent.md:145-146`
- **Problem**: Two lines both starting with `- Command pattern:` for create-task.md and create-skill.md. create-skill.md (line 111) only lists one command pattern reference. The duplication is not wrong, but using a different label like "Sibling commands" would scan better.
- **Recommendation**: Change to `- Sibling command: .claude/commands/create-task.md` and `- Sibling command: .claude/commands/create-skill.md`.

### M3: Usage block alignment inconsistency

- **File**: `.claude/commands/create-agent.md:8-9`
- **Problem**: The comment alignment uses spaces to align `#` characters, matching create-task.md and create-skill.md. However, create-agent.md has 24 spaces before `#` on line 8 and 17 spaces on line 9, which aligns the comments. create-task.md uses the same approach. Consistent -- no action needed. (I initially flagged this but on re-check it matches.)
- **Recommendation**: No action.

---

## Pattern Compliance

| Pattern                          | Status | Concern |
| -------------------------------- | ------ | ------- |
| Thin-wrapper command structure   | PASS   | Follows the Step 1-6 scaffold pattern |
| Pre-flight checks                | PASS   | Step 1 validates files, name, conflicts |
| Security injection guard         | PASS   | Present in Step 2 line 33 |
| Source-of-truth file reads       | PASS   | Reads template and registry before acting |
| Validation sub-step              | FAIL   | Step 4b is unstructured; Step 5b naming breaks convention |
| Summary display                  | PASS   | Matches sibling command output format |
| Important Rules section          | PASS   | Present but over-dense (11 vs 6-7 in siblings) |
| References section               | PASS   | Lists all dependencies |
| Line count                       | PASS   | 147 lines, under 200 limit |
| No hardcoded template content    | FAIL   | Step 4b hardcodes 14 section names inline |

## Technical Debt Assessment

**Introduced**: Hardcoded section list in Step 4b creates a maintenance burden -- any template change requires updating the command file too. The 11-rule Important Rules section sets a precedent for verbose rule lists in future commands.

**Mitigated**: The command correctly applies lessons learned from TASK_2026_017 (single positional argument, security guards, validation sub-step pattern).

**Net Impact**: Slight debt increase. The hardcoded section list (S4) is the main concern -- it directly contradicts the command's own Rule 1.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: Step 4b's unstructured validation (B1) and the hardcoded section names that contradict the "never hardcode template structure" principle (S4) are the two issues that should be addressed before this is considered complete.

## What Excellence Would Look Like

A 10/10 implementation would:
- Have Step 4b as a clean bullet list matching create-skill.md's validation pattern
- Reference template sections by pointing to the template file rather than listing them inline
- Include a one-line rollback instruction for partial failure during the multi-file update sequence (Steps 4-5b)
- Use consistent sub-step naming where `Xb` always means "validate X", not "do another action"
- Consolidate Important Rules to 7-8 items by merging duplicates
- Keep the same information density but with better structural formatting
