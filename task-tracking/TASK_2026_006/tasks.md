# Development Tasks - TASK_2026_006

**Total Tasks**: 5 | **Batches**: 3 | **Status**: 0/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- Section skeleton of developer agents (14 sections): Verified against `backend-developer.md`
- Agent catalog entry format: Verified against `agent-catalog.md:241-332`
- Command file thin-wrapper pattern: Verified against `create-task.md`
- SKILL.md structure with YAML frontmatter: Verified against `ui-ux-designer/SKILL.md`
- Target files do not exist yet: Verified (all 4 are CREATE)
- `orchestrate.md` Quick Reference lists 13 agents (line 29): Verified

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| developer-template.md must fit 14 sections in 300 lines (source agent is 612 lines) | MED | Shared sections use condensed literal text; variable sections use placeholders. Developer must track line count carefully. |
| task-description.md mentions stack-variable-sets.md but architect's plan omits it | LOW | Architect intentionally folded variable population into AI-assisted flow in /create-agent. No separate file needed. |

---

## Batch 1: Stack Detection Registry IN PROGRESS

**Developer**: systems-developer
**Tasks**: 1 | **Dependencies**: None

### Task 1.1: Create stack-detection-registry.md IN PROGRESS

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/stack-detection-registry.md`
**Spec Reference**: implementation-plan.md: Component 1 (lines 131-184)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/systems-developer-patterns.md` (reference file structure with tables and sections)

**Quality Requirements**:
- Max 300 lines
- Cover all 10 ecosystems: Node.js/TypeScript, Python, Java/Kotlin, Swift/iOS, Dart/Flutter, Go, Rust, Ruby, C#/.NET, PHP
- Every detection rule must have a confidence level (high/medium/low)
- Content patterns must distinguish frameworks (e.g., "react" vs "angular" in package.json)
- No duplicate detection rules
- Include monorepo indicators (Nx, Yarn workspaces, pnpm, Lerna, Turborepo, Bazel)
- Include infrastructure and database detection rules
- Include Stack-to-Agent Mapping table

**Validation Notes**:
- This file is consumed by `/create-agent` command and future CLI init flow
- Structure must follow the outline in implementation-plan.md Component 1

**Implementation Details**:
- Sections: How to Use, Language Detection Rules, Framework Detection Rules (per language), Infrastructure Detection Rules, Database Detection Rules, Monorepo Indicators, Stack-to-Agent Mapping
- Use markdown tables for all detection rules
- Each table row: file pattern, stack ID, category, confidence, content patterns
- Framework detection tables are per-language (Node.js frameworks, Python frameworks, etc.)

---

**Batch 1 Verification**:
- File exists at path
- Under 300 lines
- All 10 ecosystems covered with detection rules
- code-logic-reviewer approved

---

## Batch 2: Developer Agent Template PENDING

**Developer**: systems-developer
**Tasks**: 1 | **Dependencies**: Batch 1 (understanding of stack detection patterns for agent mapping)

### Task 2.1: Create developer-template.md PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/developer-template.md`
**Spec Reference**: implementation-plan.md: Component 2 (lines 187-258)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/agents/backend-developer.md` (target output structure)

**Quality Requirements**:
- Max 300 lines (CRITICAL -- this is the hardest constraint)
- Template must produce agents with identical section ordering to `backend-developer.md`
- All 14 sections from Pattern 1 must be present in the template
- Template Variables Reference table at the top documenting all variables
- Shared sections (Initialization Protocol, Escalation Protocol, No Git Operations, Universal Critical Rules) use literal text with only `{agent_name}` / `{agent_title}` varying
- Variable sections use `{variable}` placeholders for stack-specific content
- Include instructions for the AI populating the template
- No `{variable}` tokens should remain in generated output (instructions must make this clear)

**Validation Notes**:
- RISK: 300-line limit is tight. Developer MUST read `backend-developer.md` fully to understand what can be condensed vs what must be literal.
- Shared sections across all 3 existing developer agents are nearly identical -- use that to compress.
- The template file itself has two parts: (1) Variable Reference table, (2) The actual template with placeholders.

**Implementation Details**:
- Read ALL THREE developer agents (`backend-developer.md`, `frontend-developer.md`, `systems-developer.md`) to identify shared vs variable sections
- Template variables from implementation plan: `{agent_name}`, `{agent_title}`, `{agent_description}`, `{language}`, `{framework}`, `{secondary_frameworks}`, `{testing_tools}`, `{build_tools}`, `{file_types}`, `{principles_content}`, `{patterns_content}`, `{quality_standards_content}`, `{universal_rules_content}`, `{anti_patterns_content}`, `{pro_tips_content}`, `{complexity_levels_content}`, `{review_lessons_paths}`, `{file_size_table}`
- Shared literal sections: Initialization Protocol Steps 1-3, Escalation Protocol, No Git Operations + responsibility matrix, Anti-Backward Compatibility Mandate, Core Intelligence Principle

---

**Batch 2 Verification**:
- File exists at path
- Under 300 lines
- All 14 agent sections present in template
- All template variables documented in reference table
- code-logic-reviewer approved

---

## Batch 3: Command Files PENDING

**Developer**: systems-developer
**Tasks**: 2 | **Dependencies**: Batch 1 (registry) and Batch 2 (template)

### Task 3.1: Create create-agent.md command PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-agent.md`
**Spec Reference**: implementation-plan.md: Component 3 (lines 262-319) and Component 5 (lines 380-403)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md` (command thin-wrapper pattern)

**Quality Requirements**:
- Max 200 lines
- Follows thin-wrapper command pattern from `create-task.md`
- Pre-flight checks: verify `.claude/agents/` exists, `agent-catalog.md` exists, `developer-template.md` exists, agent does not already exist
- Reads `developer-template.md` as source of truth (never hardcodes template)
- Reads `stack-detection-registry.md` for stack knowledge
- Reads an existing developer agent for pattern verification
- Supports both interactive mode (`/create-agent`) and pre-filled mode (`/create-agent [name] [description]`)
- Agent Catalog Update Protocol section with instructions for updating ALL 4 sections:
  1. Agent Capability Matrix table (add row)
  2. Development Agents section (add full entry)
  3. Agent Category Summary table (update Development row)
  4. Agent count in catalog header (increment)
- Also updates `orchestrate.md` Quick Reference agent list and count
- Validates generated agent has all 14 required sections
- Validates generated agent is under 400 lines
- Display summary with file path and usage instructions

**Validation Notes**:
- The Agent Catalog Update Protocol (Component 5) is embedded in this command, not a separate file
- Must reference exact file paths for all dependencies

**Implementation Details**:
- Steps: Pre-Flight Checks, Read Template and References, Gather Agent Information, Populate Template, Write Agent File, Update Agent Catalog, Update Orchestrate Command, Display Summary
- Imports/reads: `developer-template.md`, `stack-detection-registry.md`, `backend-developer.md` (pattern reference), `agent-catalog.md`, `orchestrate.md`
- Agent catalog entry must match format at `agent-catalog.md:241-332`

### Task 3.2: Create create-skill.md command PENDING

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-skill.md`
**Spec Reference**: implementation-plan.md: Component 4 (lines 324-376)
**Pattern to Follow**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/create-task.md` (command thin-wrapper pattern)

**Quality Requirements**:
- Max 200 lines
- Follows thin-wrapper command pattern from `create-task.md`
- Pre-flight checks: verify `.claude/skills/` exists, skill does not already exist
- Reads an existing SKILL.md for pattern reference (e.g., `ui-ux-designer/SKILL.md`)
- Supports both interactive mode (`/create-skill`) and pre-filled mode (`/create-skill [name] [description]`)
- Generated SKILL.md must have YAML frontmatter with `name` and `description`
- Generated SKILL.md must have trigger conditions section
- Generated SKILL.md must be under 300 lines
- Creates directory at `.claude/skills/{skill-name}/`
- Writes SKILL.md to `.claude/skills/{skill-name}/SKILL.md`
- Display summary with directory path and integration instructions

**Validation Notes**:
- This is the simpler of the two commands -- no catalog update needed
- Pattern reference is `ui-ux-designer/SKILL.md` (217 lines with YAML frontmatter, trigger conditions, workflow, output format, pro tips)

**Implementation Details**:
- Steps: Pre-Flight Checks, Read Existing Skill for Pattern Reference, Gather Skill Information, Generate SKILL.md, Create Directory and Write File, Display Summary
- Imports/reads: existing SKILL.md for pattern reference
- Generated SKILL.md structure: YAML frontmatter, title, description, When This Skill Activates, Workflow Steps, Quality Standards, Integration Points, Output Format

---

**Batch 3 Verification**:
- Both files exist at paths
- Both under 200 lines
- Both follow thin-wrapper command pattern
- `create-agent.md` includes complete Agent Catalog Update Protocol
- `create-skill.md` includes directory creation instructions
- All file path references point to existing files
- code-logic-reviewer approved
