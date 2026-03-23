# Code Style Review - TASK_001

## Review Summary

| Metric          | Value          |
| --------------- | -------------- |
| Overall Score   | 7/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 2              |
| Serious Issues  | 4              |
| Minor Issues    | 5              |
| Files Reviewed  | 4              |

## The 5 Critical Questions

### 1. What could break in 6 months?

The status enum mismatch between the `/create-task` command and the `task-tracking.md` reference will cause real confusion. The command uses `CREATED` as the initial status (create-task.md:58, task-template-guide.md:94), but the canonical `task-tracking.md` reference defines only four statuses: `IN_PROGRESS`, `COMPLETE`, `BLOCKED`, `CANCELLED` (task-tracking.md:219-226). There is no `CREATED` status in the canonical reference. The design doc's lifecycle table (design doc:65-68) implies `CREATED` from folder state (only `task.md` present), but this is a phase inference, not a registry status value. When the auto-pilot or orchestrator reads the registry, it will encounter a status it was never told to expect. This is a ticking bomb.

Additionally, the registry format produced by `/create-task` (5-column: Task ID | Status | Type | Description | Created) does not match the current live `registry.md` which uses 4 columns (ID | Task | Status | Tracking). The implementation plan acknowledged this discrepancy (implementation-plan.md:17-20) but never resolved it. The first time someone runs `/create-task` against the existing registry, the table formatting will break.

### 2. What would confuse a new team member?

The separator character for enum values is inconsistent across files. The task template (`task-template.md:9`) uses `/` as the separator (`FEATURE / BUGFIX / ...`), while the implementation plan (implementation-plan.md:71) uses `|`, and the SKILL.md context.md template (task-tracking.md:116) also uses `|`. A new developer will not know which is "correct" and may wonder if these are different systems.

The relationship between the design doc's task.md template (design doc:72-86), which has no Metadata section, and the actual `task-template.md`, which adds a Metadata table, is never explicitly explained. Someone reading the design doc first will think the template is wrong.

### 3. What's the hidden complexity cost?

The `/create-task` command says "ALWAYS read task-template.md first -- never hardcode template structure" (create-task.md:78), but the command itself hardcodes all the valid enum values in Step 3 (create-task.md:32-34) and in the Important Rules section (create-task.md:81-83). If someone updates the template to add a new task type (e.g., `TESTING`), they would also need to update create-task.md in three separate places. The "single source of truth" claim is aspirational, not actual.

### 4. What pattern inconsistencies exist?

**Command structure inconsistency**: The existing `orchestrate.md` is a skill-invoking command (short, loads SKILL.md, 36 lines). The `project-status.md` is a self-contained command (long, phased execution, 131 lines). The new `create-task.md` follows the self-contained pattern, which is the right choice per the implementation plan. However, its heading structure uses "Step 1, Step 2..." while `project-status.md` uses "Phase 1, Phase 2...". This is a minor inconsistency but worth noting -- commands should use consistent terminology for their execution stages.

**Registry update status inconsistency**: The task-tracking.md reference says "Set status to IN_PROGRESS" after creating a new task (task-tracking.md:96). The `/create-task` command sets status to `CREATED` (create-task.md:58). The SKILL.md NEW_TASK initialization flow also doesn't mention a `CREATED` status. These three documents disagree on what happens when a task is born.

### 5. What would I do differently?

1. I would resolve the `CREATED` vs `IN_PROGRESS` status question definitively by updating `task-tracking.md` to include `CREATED` as a valid registry status, or changing the command to use `IN_PROGRESS`. You cannot leave three documents disagreeing.
2. I would remove the hardcoded enum values from `create-task.md` Steps 3 and Important Rules, and instead say "present valid values as listed in the template." This makes the single-source-of-truth claim real instead of aspirational.
3. I would add a "Metadata" section to the design doc's task.md template sketch, or add a note in the template guide acknowledging the extension. Right now the lineage is unclear.
4. I would standardize on `|` as the separator for enum values in the template, matching SKILL.md and task-tracking.md conventions.

---

## Blocking Issues

### Issue 1: CREATED status does not exist in canonical reference

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md:58`
- **Also**: `/Volumes/SanDiskSSD/mine/nitro-fueled/docs/task-template-guide.md:94`
- **Problem**: The `/create-task` command sets registry status to `CREATED`. The task-template-guide says auto-pilot looks for `CREATED` status. But the canonical `task-tracking.md` reference (lines 219-226) defines only: `IN_PROGRESS`, `COMPLETE`, `BLOCKED`, `CANCELLED`. The status `CREATED` is never defined as a valid registry status value anywhere in the canonical reference.
- **Impact**: The auto-pilot loop, orchestrator, and any future tooling that reads registry.md will encounter an undocumented status value. The `project-status.md` command also does not account for `CREATED` status in its report categories. This is a cross-system inconsistency that will cause bugs in the auto-pilot implementation (the next task on the roadmap).
- **Fix**: Either (a) add `CREATED` to the Registry Status table in `task-tracking.md` with a clear definition like "Task defined but orchestration not yet started", OR (b) change `/create-task` to use an existing status. Option (a) is better because the design doc lifecycle table (design doc:65-68) implies this state exists. But the canonical reference MUST be updated to match.

### Issue 2: Registry format mismatch with live registry

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md:57-61`
- **Problem**: The command produces rows in format `Task ID | Status | Type | Description | Created` (5 columns). The live `registry.md` uses `ID | Task | Status | Tracking` (4 columns, different column names). Appending a 5-column row to a 4-column table will produce broken markdown.
- **Impact**: The very first use of `/create-task` will corrupt the registry table formatting.
- **Fix**: Either migrate the live registry to the canonical format before this ships, or add a Step 0 to the command that detects the registry format and migrates it if needed. The implementation plan acknowledged this (line 17) but punted it. It should not be punted -- it is a prerequisite for the command to work.

---

## Serious Issues

### Issue 3: Enum separator inconsistency between template and references

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md:9-11`
- **Problem**: The template uses `/` as separator (`FEATURE / BUGFIX / ...`), while the SKILL.md context.md template at `task-tracking.md:116` uses `|` (`FEATURE | BUGFIX | ...`), and the implementation plan spec (line 71) also uses `|`. The create-task command (line 32) uses `/`.
- **Tradeoff**: This is cosmetic but violates the non-functional requirement in task-description.md:84 that says "The template MUST use the exact same field names and values referenced throughout the orchestration skill." If the separators differ, copy-paste between files introduces inconsistency.
- **Recommendation**: Standardize on `|` to match SKILL.md and task-tracking.md, since those are the upstream consumers.

### Issue 4: Single-source-of-truth claim is not actually implemented

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md:32-34,81-83`
- **Problem**: The command says "never hardcode template structure" (line 78) but then hardcodes all enum values in Step 3 (lines 32-34) and again in Important Rules (lines 81-83). This means changes to valid values require updating 3 locations: the template, Step 3, and Important Rules.
- **Tradeoff**: The duplication exists for the agent's benefit (so it doesn't have to parse the template to know valid values). But this directly contradicts the stated principle and the non-functional requirement at task-description.md:89.
- **Recommendation**: In Step 3, change to "Present valid values from the template for each field." In Important Rules, change to "Valid values MUST match those defined in task-template.md" without listing them. The agent reading the template in Step 1 will already have the values.

### Issue 5: Agent flow discrepancy between template and SKILL.md for FEATURE type

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md:14`
- **Also**: `/Volumes/SanDiskSSD/mine/nitro-fueled/docs/task-template-guide.md:79`
- **Problem**: The template's inline comment says FEATURE flow is `PM -> Architect -> Team-Leader -> Dev -> QA`. The SKILL.md (line 27) says `PM -> [Research] -> Architect -> Team-Leader -> QA`. The guide (line 79) says `PM -> [Research] -> [UI/UX] -> Architect -> Team-Leader -> QA`. Three different flows for the same type. The `[Research]` and `[UI/UX]` are optional steps shown in brackets in SKILL.md and the guide, but the template omits them entirely.
- **Tradeoff**: The template is trying to simplify, but it creates a false impression of the actual flow.
- **Recommendation**: Match SKILL.md exactly in the template comments: `PM -> [Research] -> Architect -> Team-Leader -> QA`. The guide can expand with `[UI/UX]` if that is documented elsewhere, but ideally all three should match SKILL.md as the canonical source.

### Issue 6: CREATIVE flow inconsistency

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/task-template.md:20`
- **Also**: `/Volumes/SanDiskSSD/mine/nitro-fueled/docs/task-template-guide.md:85`
- **Problem**: The template says CREATIVE flow is `ui-ux-designer -> content-writer -> frontend-developer`. SKILL.md (line 33) says `[ui-ux-designer] -> content-writer -> frontend`. The guide (line 85) says `[UI/UX Designer] -> Content Writer -> Frontend Developer`. The template uses lowercase-hyphenated agent names, the guide uses Title Case, and SKILL.md uses a mix. Agent name casing should be consistent.
- **Tradeoff**: Inconsistent casing creates ambiguity about whether these are exact agent identifiers or descriptive labels.
- **Recommendation**: Use the exact agent file names (lowercase-hyphenated) since those are the actual identifiers used in Task() invocations. Or use descriptive labels consistently, but pick one style.

---

## Minor Issues

1. **`task-template-guide.md:56`** — The lifecycle flow shows `registry.md updated to COMPLETED` but the canonical status is `COMPLETE` (task-tracking.md:224), not `COMPLETED`. Small but matters for exact string matching.

2. **`task-template-guide.md:31`** — Shows `USER VALIDATES` after PM output, which is correct per SKILL.md checkpoints. But the lifecycle flow should also mention that validation happens after Architect output (SKILL.md:156-163). It does show this on line 36 but inconsistently -- line 31 says "USER VALIDATES" on its own line while line 36 uses the same format. This is fine, but worth a consistency check.

3. **`create-task.md:50`** — "Strip HTML guidance comments from the output" is a good call, but it is not mentioned in the implementation plan's command spec. This is an implementation-time addition that was not in the requirements. Not wrong, but worth documenting why.

4. **`CLAUDE.md:34`** — The "Current State" section says ".claude/ setup genericized and project-agnostic" and the Development Priority shows items 1-2 as DONE. But the original CLAUDE.md had more bullet points under Current State that are now removed. The removal of "Need to build CLI package" and "Need to build auto-pilot skill" from Current State is fine if they are captured in Development Priority, which they are (items 3-4). No action needed, just noting the change is larger than "add one line to Key Docs."

5. **`task-template-guide.md:93`** — The guide references `TASK_*/task.md` with glob syntax, but the auto-pilot loop would actually need to read `TASK_YYYY_NNN/task.md` folders. The glob pattern is fine for documentation purposes but assumes all `TASK_*` folders have task.md files, which may not be true for tasks created by the orchestrator's NEW_TASK flow (which creates context.md, not task.md).

---

## File-by-File Analysis

### task-tracking/task-template.md

**Score**: 7/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: Clean, well-structured template. The metadata table approach is smart -- more readable than YAML frontmatter and parseable by agents. Inline HTML comments provide excellent guidance without cluttering rendered output. The template covers all required sections from the design doc draft plus the metadata fields from SKILL.md.

**Specific Concerns**:
1. Enum separator uses `/` instead of `|` (inconsistent with SKILL.md and task-tracking.md) -- lines 9-11
2. FEATURE flow description omits `[Research]` optional step -- line 14
3. CREATIVE flow uses inconsistent agent name casing vs SKILL.md -- line 20

---

### docs/task-template-guide.md

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 3 minor

**Analysis**: This is the strongest deliverable. The lifecycle flow diagram is clear and accurate. The field reference table with consumer mapping is exactly what was required. The two examples are realistic and demonstrate different task types well. The auto-pilot integration section correctly references the design doc loop steps without restating too much.

**Specific Concerns**:
1. FEATURE flow adds `[UI/UX]` optional step not present in SKILL.md -- line 79
2. Uses `COMPLETED` instead of `COMPLETE` in lifecycle flow -- line 56
3. The examples reference N.Gine-specific patterns (SQLite, IPC, Angular components) -- lines 126, 141-143. While the requirements say examples should be realistic, these are very specific to one tech stack. The template itself correctly avoids tech-stack assumptions (task-description.md:95), but the examples might mislead adopters into thinking Nitro-Fueled is Angular-specific.

---

### .claude/commands/create-task.md

**Score**: 6/10
**Issues Found**: 2 blocking, 2 serious, 1 minor

**Analysis**: Follows the self-contained command pattern reasonably well. The step-by-step flow is logical and covers the happy path. However, it has the most issues of all deliverables. The registry format mismatch is a show-stopper. The single-source-of-truth violation undermines the core design principle. The status enum issue propagates through to the auto-pilot system.

**Specific Concerns**:
1. Registry format (5 columns) does not match live registry (4 columns) -- lines 57-61
2. Uses `CREATED` status not defined in canonical reference -- line 58
3. Hardcodes all enum values despite claiming template is source of truth -- lines 32-34, 81-83
4. Uses "Step" terminology vs "Phase" used in project-status.md -- structural inconsistency
5. No error handling for edge cases: What if registry.md does not exist? What if the task-tracking directory does not exist?

---

### CLAUDE.md (Key Docs change)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The Key Docs addition is clean and follows the existing format exactly (path, em-dash, description). The description "Task template usage and orchestration integration" is accurate and concise. The additional changes to Current State and Development Priority sections are reasonable updates reflecting task completion.

**Specific Concerns**:
1. The dash style uses ` — ` (em-dash with spaces) matching existing entries. Good. No issues with the Key Docs line itself.
2. The broader CLAUDE.md changes go beyond the "add one line to Key Docs" scope defined in the implementation plan (line 282). The Current State rewrite and Development Priority strikethroughs are sensible but were not in the plan. This is scope creep, though benign.

---

## Pattern Compliance

| Pattern                   | Status | Concern                                                                    |
| ------------------------- | ------ | -------------------------------------------------------------------------- |
| Enum value consistency    | FAIL   | Separator character differs (/ vs \|); CREATED status undefined            |
| Agent flow accuracy       | FAIL   | Template omits optional steps present in SKILL.md                          |
| Command structure         | PASS   | Follows self-contained command pattern correctly                           |
| Single source of truth    | FAIL   | Command duplicates enum values it claims to read from template             |
| Registry format           | FAIL   | Command output incompatible with live registry                             |
| Cross-referencing         | PASS   | Guide references existing docs rather than restating                       |
| Template completeness     | PASS   | All required sections present with inline guidance                         |
| Documentation examples    | PASS   | Two examples provided (FEATURE + BUGFIX) as required                       |

## Technical Debt Assessment

**Introduced**:
- Registry format divergence between canonical spec and live file is now a known-but-unresolved issue. The command targets the canonical format while the registry uses a different one. This must be resolved before the command can be used.
- The `CREATED` status is introduced without updating the canonical reference, creating a documentation debt that will compound when auto-pilot is built.

**Mitigated**:
- The template establishes a clear structure for task definitions, reducing the previous ad-hoc approach.
- The field-to-consumer mapping in the guide creates traceable documentation that will help when debugging pipeline issues.

**Net Impact**: Slight debt increase. The template and guide are net-positive, but the command has unresolved integration issues that will block actual usage.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The `/create-task` command cannot work against the current `registry.md` due to format mismatch, and introduces an undocumented status value. These must be resolved before the command is usable.

## What Excellence Would Look Like

A 10/10 implementation would include:

1. **Registry migration**: Either the command handles both formats, or the registry is migrated as part of this task. No unresolved format conflicts.
2. **Status enum alignment**: `CREATED` is added to `task-tracking.md` as a valid registry status with clear semantics, or the command uses an existing status.
3. **True single source of truth**: The command contains zero hardcoded enum values. All valid values are described as "read from template."
4. **Exact flow matching**: Every agent flow listed in the template and guide matches SKILL.md character-for-character, including optional steps in brackets.
5. **Tech-agnostic examples**: The guide examples use generic application patterns (REST API endpoint, CLI command, config file) rather than Angular/Electron-specific ones.
6. **Error handling in command**: Steps for what to do when registry.md is missing, when task-tracking/ does not exist, or when the template file cannot be found.
7. **Consistent terminology**: All files use `|` for enum separators, `COMPLETE` (not `COMPLETED`), and consistent agent name casing.
