# Code Style Review - TASK_2026_004

## Review Summary

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 7/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 1              |
| Serious Issues  | 5              |
| Minor Issues    | 4              |
| Files Reviewed  | 3              |

## The 5 Critical Questions

### 1. What could break in 6 months?

The cross-reference mismatch between `plan.md` (command) and `planner.md` (agent) section numbers is the most dangerous issue. If someone edits the agent and renumbers sections, the command will reference wrong protocols. More broadly, the command references protocol numbers by index ("Planner protocol 5b") rather than by name ("Planner Status Mode protocol"). Index-based references are fragile and will silently become wrong when the agent is reorganized. See `plan.md:44-54`.

### 2. What would confuse a new team member?

The planner agent file is 350 lines -- well-organized, but dense. A new team member encountering the Planner for the first time would need to understand: (a) the distinction between Planner and project-manager, (b) the distinction between Planner and Supervisor, (c) the plan.md format specification embedded inline, and (d) the consultation protocol. The inline plan.md format spec (lines 196-240) is particularly confusing because it looks like a real file but is actually a template specification. Consider whether this should be a separate reference doc or at minimum have a clearer callout that this is a format spec, not an actual file.

### 3. What's the hidden complexity cost?

The staleness detection rule (Section 5d, line 190-192) says "On every invocation, compare plan.md task statuses against registry.md. If discrepancies are found, refresh plan.md silently." This is a potentially expensive operation that scales linearly with the number of tasks. With 50 tasks across multiple phases, this means every `/plan` invocation reads both files, diffs all task statuses, and rewrites plan.md. For the current scale this is fine, but the "silently" part is concerning -- the user gets no indication that plan.md was modified, making debugging harder when plan.md content changes unexpectedly.

### 4. What pattern inconsistencies exist?

**Agent file pattern deviation**: The `project-manager.md` agent uses "CRITICAL OPERATING PRINCIPLES" and "CORE INTELLIGENCE PRINCIPLES" as top-level sections, while `planner.md` uses numbered sections (1-11). The `software-architect.md` uses "CORE INTELLIGENCE PRINCIPLE" and "UNIVERSAL CRITICAL RULES". There is no consistent agent section naming convention across agents. The planner's numbered approach is arguably clearer, but it diverges from the established (if inconsistent) pattern.

**Command file pattern deviation**: The `create-task.md` command uses `### Step N: Title` format with full sentences. The `auto-pilot.md` command uses the same pattern but adds a Parameters table after Usage. The `plan.md` command follows `create-task.md` style (no Parameters table) but uses sub-numbering within steps (3a, 3b, 3c) which neither `create-task.md` nor `auto-pilot.md` do -- they use bold prefixes instead (e.g., `**3a.**`). See `plan.md:32-39` vs `auto-pilot.md:48-60`.

### 5. What would I do differently?

1. Reference protocols by **name** instead of number in the command file: "Planner Status Mode" instead of "Planner protocol 5b".
2. Extract the plan.md format specification into a separate reference file (like `task-tracking/plan-template.md` or `.claude/skills/orchestration/references/plan-format.md`) rather than embedding it in the agent definition. This follows the same single-source-of-truth principle used for task-template.md.
3. Add an explicit "CRITICAL OPERATING PRINCIPLES" section to the planner agent (matching PM pattern) to contain the most important rules upfront, rather than burying them across sections 4-6.

---

## Blocking Issues

### Issue 1: Cross-Reference Mismatch -- Command References Wrong Protocol Numbers

- **File**: `.claude/commands/plan.md:44-54`
- **Problem**: The command references "Planner protocol 5b" for status mode, "Planner protocol 5c" for reprioritize, "Planner protocol 5a" for new planning, and "Planner protocol 5d" for onboarding. In the actual agent file (`planner.md`), these protocols are numbered **3a** through **3d** (under "## 3. Interaction Protocols"), NOT 5a-5d. The numbering appears to have been carried over from the implementation plan's section numbering, which used a different structure than what was actually implemented.
- **Impact**: An agent executing `/plan status` would look for "protocol 5b" in the planner agent. Section 5b in the actual agent is "Ownership" under "Plan Management Rules" -- completely wrong. This would cause the agent to follow the wrong instructions or fail to find the referenced section.
- **Fix**: Change all protocol references to match the actual agent numbering:
  - `Planner protocol 5b` -> `Planner protocol 3b` (Status Mode)
  - `Planner protocol 5c` -> `Planner protocol 3c` (Reprioritize Mode)
  - `Planner protocol 5a` -> `Planner protocol 3a` (Product Owner Mode)
  - `Planner protocol 5d` -> `Planner protocol 3d` (Onboarding Mode)

  Better yet, reference by name: "Planner Status Mode (Section 3b)" to be resilient against future renumbering.

---

## Serious Issues

### Issue 1: Sub-step Numbering Style Inconsistent with Established Command Pattern

- **File**: `.claude/commands/plan.md:32-39`
- **Problem**: Pre-flight checks use bare `3a.`, `3b.`, `3c.` numbering. The established pattern in `auto-pilot.md:48-60` uses bold-prefixed numbering: `**3a.**`, `**3b.**`, `**3c.**`. The `create-task.md` command does not use sub-steps at all, preferring numbered lists within steps. The plan command mixes both styles.
- **Tradeoff**: Inconsistent sub-step formatting across commands makes the codebase feel ad-hoc and harder to maintain. Agents parsing commands may handle formatting inconsistently.
- **Recommendation**: Adopt the `auto-pilot.md` bold-prefix pattern (`**3a.**`) for consistency, since auto-pilot is the closest structural analogue to the plan command.

### Issue 2: Agent File Missing "CRITICAL OPERATING PRINCIPLES" Section

- **File**: `.claude/agents/planner.md` (entire file)
- **Problem**: The `project-manager.md` agent has a prominent "CRITICAL OPERATING PRINCIPLES" section near the top (lines 12-50) containing the most important behavioral constraints. The `software-architect.md` has "UNIVERSAL CRITICAL RULES" in the same position. The planner agent has no equivalent -- its most critical constraints ("What You Never Do") are buried at section 10 (line 327), 300+ lines into the file. In a long context window, rules at the top carry more weight than rules at the bottom.
- **Tradeoff**: Agents that read the planner definition may give less weight to the "never create tasks without PO approval" rule because it appears so late in the file. This is a real concern for LLM-based agents where instruction position affects compliance.
- **Recommendation**: Add a "CRITICAL OPERATING PRINCIPLES" section after the IMPORTANT absolute paths reminder (after line 17), containing the 3-4 most important constraints: (1) never create tasks without PO approval, (2) always read task-template.md, (3) never access worker/session/MCP internals, (4) only the Planner writes to plan.md.

### Issue 3: Terminology Inconsistency -- "Product Owner" vs "PO" Usage Not Standardized

- **File**: `.claude/agents/planner.md` (throughout)
- **Problem**: The agent uses both "Product Owner" (full form) and "PO" (abbreviation) throughout the file. First use of "PO" appears at line 89 without explicit definition. While the abbreviation is clear in context, the `project-manager.md` agent never uses "PO" -- it always says "user". The `auto-pilot.md` SKILL.md also never uses "PO". This introduces a new term that is not established elsewhere in the codebase.
- **Tradeoff**: An agent might not equate "PO" with "user" or "Product Owner" if encountered in isolation. The review-lessons file (`review-general.md:54`) explicitly warns: "Named concepts must use one term everywhere."
- **Recommendation**: Define "Product Owner (PO)" explicitly on first use (line 12 already says "Product Owner"). Then either consistently use the full form, or add an explicit parenthetical definition: "Product Owner (hereafter PO)". But check whether "Product Owner" or "user" should be the canonical term across all agents.

### Issue 4: SKILL.md Session Log Events Inconsistency in "Plan not found" Wording

- **File**: `.claude/skills/auto-pilot/SKILL.md:117`
- **Problem**: The session log event for plan-not-found says `"PLAN -- no plan.md found, using default ordering"`. However, Step 3b (line 262-263) says `"Continue to Step 4 with default ordering (Priority then Task ID). No consultation needed."` -- it does NOT instruct the Supervisor to log anything when plan.md is absent. There is no log instruction in the Step 3b "does NOT exist" branch. The session log table defines the event format, but the step logic never triggers it.
- **Tradeoff**: Dead log event definitions are confusing -- someone reading the session log table expects to see this event, but the Supervisor logic never produces it.
- **Recommendation**: Add an explicit log instruction to the "does NOT exist" branch of Step 3b: `Log: "PLAN -- no plan.md found, using default ordering"`. This aligns the session log table with actual behavior.

### Issue 5: No plan.md Validation of "Current Focus" Section Integrity in SKILL.md

- **File**: `.claude/skills/auto-pilot/SKILL.md:241-263`
- **Problem**: Step 3b instructs the Supervisor to read the "Current Focus" section and extract Active Phase, Next Priorities, and Supervisor Guidance. But there is no error handling for malformed plan.md. What if "Current Focus" section is missing? What if "Supervisor Guidance" contains an unexpected value? The step assumes plan.md is always well-formed.
- **Tradeoff**: If the Planner crashes mid-update and leaves plan.md in a partial state, the Supervisor would attempt to parse garbage data. This is a reliability gap.
- **Recommendation**: Add a fallback clause: "If the Current Focus section is missing or Supervisor Guidance is not one of the four expected values, treat as PROCEED and log a warning."

---

## Minor Issues

1. **`.claude/agents/planner.md:295-300`** -- The example investigation flow uses a non-standard code block (no language tag). Other agents like `project-manager.md` and `software-architect.md` use `bash` language tags for tool invocation examples. Minor formatting inconsistency.

2. **`.claude/agents/planner.md:12`** -- The identity paragraph uses em-dashes (`--`) inconsistently with the rest of the project. Some files use `--` (two hyphens), which is fine, but the YAML description block (line 3-7) also uses colons for list separation while the identity paragraph uses `--`. This is a minor readability preference, not a functional issue.

3. **`.claude/commands/plan.md:65`** -- Rule 1 says "ALWAYS read `planner.md` first" using a bare filename. Other rules in the same section use full relative paths (e.g., `task-template.md`, `registry.md`). For consistency, this should say `.claude/agents/planner.md` or at minimum `planner.md agent definition`. The bare `planner.md` could theoretically be confused with `plan.md`.

4. **`.claude/agents/planner.md:349-350`** -- Total line count is 350, which has no defined limit in the project conventions for agent files. The project conventions define limits for Components (150), Services (200), Stores (150), etc., but agent markdown files have no limit. This is not a violation, but the file is dense and could benefit from extraction of the plan.md format spec (lines 196-240) into a separate reference document.

---

## File-by-File Analysis

### `.claude/agents/planner.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 3 serious, 3 minor

**Analysis**:
The planner agent definition is well-structured, comprehensive, and clearly distinguishes itself from both the project-manager and Supervisor roles. The numbered section approach (1-11) provides clear navigation. Knowledge boundaries (Section 2) are precisely defined. Task creation rules (Section 4) correctly replicate the `/create-task` logic. The Supervisor consultation protocol (Section 6) correctly describes an artifact-based communication pattern that avoids cross-session coupling.

**Specific Concerns**:
1. Missing "CRITICAL OPERATING PRINCIPLES" section that other agents have prominently positioned (Serious Issue 2)
2. Inconsistent "PO" vs "Product Owner" vs "user" terminology (Serious Issue 3)
3. Code block example at line 295 missing language tag (Minor)
4. The plan.md format spec embedded inline (lines 196-240) creates a maintenance burden -- if the format needs to change, you must edit the agent file rather than a dedicated template

**What works well**:
- Clean separation of interaction protocols (3a-3d) with explicit triggers
- Task sizing enforcement heuristics (Section 4c) are concrete and actionable
- Orphan task detection (Section 8) and interrupted session recovery (Section 9) show good reliability thinking
- Pro Tips section (Section 11) provides genuinely useful tactical advice

### `.claude/commands/plan.md`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Analysis**:
The command structure follows the established pattern (Usage, Execution Steps, Important Rules, References) and handles all four modes. However, the blocking cross-reference error (protocol 5a-5d instead of 3a-3d) would cause incorrect behavior. The pre-flight checks correctly mirror the `/create-task` pattern.

**Specific Concerns**:
1. **Line 44-54**: All four protocol references use wrong section numbers (Blocking Issue 1)
2. **Line 32-39**: Sub-step numbering format inconsistent with auto-pilot.md pattern (Serious Issue 1)
3. **Line 65**: Bare `planner.md` filename without path context (Minor)

**What works well**:
- Usage block clearly shows all four invocation patterns
- Pre-flight checks (Step 3) are thorough and match create-task pattern
- Mode detection logic (Step 4) handles edge cases (empty args with/without plan.md)
- Important Rules section is concise and covers the key constraints

### `.claude/skills/auto-pilot/SKILL.md` (Step 3b + Session Log additions)

**Score**: 7/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

**Analysis**:
Step 3b is well-positioned (between dependency graph and task ordering), correctly optional, and gracefully degrades when plan.md is absent. The four guidance actions are clearly mapped to Supervisor behavior. The session log events are properly formatted and consistent with the existing log event patterns.

**Specific Concerns**:
1. **Line 262-263**: The "does NOT exist" branch has no log instruction, but the session log table (line 117) defines a "Plan not found" event format. The step and the table are out of sync. (Serious Issue 4)
2. **Lines 241-263**: No error handling for malformed plan.md (Serious Issue 5)

**What works well**:
- Clean separation: Supervisor reads plan.md but never writes to it
- ESCALATE does not halt the loop -- correct behavior for autonomy
- Plan-aware tie-breaking (line 260) is additive, not disruptive to existing ordering logic
- Three new session log events follow the established format pattern exactly

---

## Pattern Compliance

| Pattern                     | Status | Concern                                                                 |
|-----------------------------|--------|-------------------------------------------------------------------------|
| YAML frontmatter            | PASS   | Correct `name` and `description` fields                                |
| Agent identity paragraph    | PASS   | Clear first-person identity with role distinction                      |
| Absolute paths reminder     | PASS   | Present in correct position                                            |
| Command structure           | PASS   | Usage, Execution Steps, Important Rules, References all present        |
| Cross-file references       | FAIL   | Command references wrong protocol numbers (5a-5d vs 3a-3d)            |
| Terminology consistency     | WARN   | "PO" introduced as new abbreviation not used elsewhere                 |
| Section naming convention   | WARN   | Numbered sections diverge from PM/Architect pattern (but arguably better) |
| Session log format          | PASS   | Three new events match established format                              |
| Consultation integration    | PASS   | Step 3b is correctly positioned and optional                           |

---

## Technical Debt Assessment

**Introduced**:
- plan.md format specification embedded in agent file creates dual-maintenance if format changes
- New terminology ("PO") without codebase-wide standardization
- Protocol references by index number rather than by name (fragile)

**Mitigated**:
- Planner fills a real gap in the orchestration pipeline (previously no planning layer)
- Artifact-based consultation (plan.md) avoids complex cross-session coupling
- Task sizing enforcement addresses the context-overflow problem from large tasks

**Net Impact**: Positive. The debt introduced is manageable, and the architectural contribution (planning layer, consultation protocol) is sound.

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The command file references wrong protocol section numbers (5a-5d instead of 3a-3d), which would cause an agent to follow incorrect instructions. This is a blocking error that must be fixed.

## What Excellence Would Look Like

A 10/10 implementation would include:

1. **Protocol references by name, not number** -- "Planner Status Mode" instead of "Planner protocol 3b". This is resilient against renumbering.
2. **Plan format specification extracted** into a separate reference file (like `task-template.md`), with the agent instructed to "read the plan format spec before creating plan.md". Single source of truth.
3. **Critical operating principles section** at the top of the agent, matching the PM and Architect pattern, containing the 3-4 non-negotiable rules.
4. **Consistent terminology** -- either "Product Owner" everywhere or a defined abbreviation policy.
5. **Error handling in Step 3b** for malformed plan.md (missing sections, unexpected guidance values).
6. **Log instruction** in the Step 3b "no plan.md" branch to match the session log table.
7. **Sub-step formatting** matching the `auto-pilot.md` bold-prefix pattern for consistency.
