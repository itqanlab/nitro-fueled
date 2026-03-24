# Implementation Plan - TASK_2026_006

## Codebase Investigation Summary

### Libraries Discovered

- **Agent Definitions** (`.claude/agents/`): 16 agent markdown files with YAML frontmatter, each following a strict section skeleton
  - Key patterns: `backend-developer.md` (612 lines), `frontend-developer.md` (528 lines), `systems-developer.md` (386 lines)
  - All developer agents share: YAML frontmatter, Core Principles, Initialization Protocol, Escalation Protocol, No Git Operations, Pattern Catalog, Quality Standards, Universal Critical Rules, Anti-Patterns, Pro Tips, Return Format, Core Intelligence Principle
- **Command Files** (`.claude/commands/`): 10 command files, thin wrappers around skills/agents
  - Pattern: Usage section, Execution Steps, Important Rules, References
  - Evidence: `create-task.md` (110 lines), `plan.md` (80 lines), `orchestrate.md` (36 lines)
- **Skill Files** (`.claude/skills/`): 4 skill directories, each with SKILL.md
  - Pattern: YAML frontmatter (`name`, `description`), trigger conditions, workflow steps
- **Reference Files** (`.claude/skills/orchestration/references/`): 7 reference files
  - `agent-catalog.md` (865 lines) -- comprehensive agent registry with capability matrix, selection matrix, per-agent entries, category summary
  - `systems-developer-patterns.md` (82 lines) -- structural requirements for each file type

### Patterns Identified

#### Pattern 1: Developer Agent Structure (CRITICAL)

All three developer agents (`backend-developer.md`, `frontend-developer.md`, `systems-developer.md`) share this exact section skeleton:

1. YAML frontmatter (`name`, `description`)
2. Agent title line: `# {Title} Agent - Intelligence-Driven Edition`
3. `## **IMPORTANT**: Always use complete absolute paths...`
4. `## CORE PRINCIPLES FOUNDATION` -- with SOLID (backend/frontend) or Single Source of Truth (systems), DRY, YAGNI, KISS
5. `## MANDATORY INITIALIZATION PROTOCOL` -- Steps 1-6 with batch support
6. `## MANDATORY ESCALATION PROTOCOL` -- trigger conditions, documentation template, forbidden actions
7. `### STEP 6: Execute Your Assignment` / `## CRITICAL: NO GIT OPERATIONS` with responsibility matrix table
8. `## PATTERN AWARENESS CATALOG` (backend/frontend) or `## DOMAIN EXPERTISE` (systems) -- domain-specific patterns
9. `## CODE QUALITY STANDARDS` -- domain-specific quality rules
10. `## UNIVERSAL CRITICAL RULES` -- TOP PRIORITY RULES list + Anti-Backward Compatibility Mandate
11. `## ANTI-PATTERNS TO AVOID` -- domain-specific anti-patterns
12. `## PRO TIPS` -- numbered list of domain-specific tips (backend: 10, frontend: 9)
13. `## RETURN FORMAT` -- completion report template with agent-specific header
14. `## CORE INTELLIGENCE PRINCIPLE` -- summary paragraph

**Evidence**: `backend-developer.md:1-612`, `frontend-developer.md:1-528`, `systems-developer.md:1-386`

#### Pattern 2: Command File Structure

Commands follow a consistent thin-wrapper pattern:

```markdown
# Command Title

Brief description.

## Usage
(invocation syntax with examples)

## Execution Steps
(numbered steps with pre-flight checks)

## Important Rules
(numbered list of constraints)

## References
(bullet list of related files)
```

**Evidence**: `create-task.md:1-110`, `plan.md:1-80`, `orchestrate.md:1-36`

#### Pattern 3: Agent Catalog Entry Structure

Each agent in the catalog follows this exact format:

```markdown
### {agent-name}

**Role**: {one-line description}

**Triggers**:
- {bullet list of trigger conditions}

**Inputs**:
- {bullet list of input files}

**Outputs**:
- {bullet list of output files}

**Dependencies**: {agent dependencies}

**Parallel With**: {agents that can run in parallel}

**Invocation Example**:
(Task() code block)
```

**Evidence**: `agent-catalog.md:241-332` (backend-developer and frontend-developer entries)

#### Pattern 4: Skill SKILL.md Structure

Skills use YAML frontmatter with `name`, `description`, and a `Use when` or trigger section.

**Evidence**: `ui-ux-designer/SKILL.md:1-30`

### Integration Points

- **Agent Catalog** (`.claude/skills/orchestration/references/agent-catalog.md`): Must be updated when new agents are generated -- add entries to Agent Capability Matrix, Agent Selection Matrix, Development Agents section, and Agent Category Summary
- **Team-Leader Modes** (`.claude/skills/orchestration/references/team-leader-modes.md`): Team-leader assigns batches to developer agents by name -- generated agents must use the same batch assignment pattern
- **Orchestrate Command** (`.claude/commands/orchestrate.md:29`): Lists agents in Quick Reference -- needs updating when agents are added

### File Size Constraints (from review-general.md and systems-developer.md)

| File Type | Max Lines |
|-----------|-----------|
| Agent definition (.md) | 400 |
| Command file (.md) | 200 |
| Reference file (.md) | 300 |
| Skill file (.md) | 300 |

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Template-based generation with AI-assisted variable population, all within markdown command/reference architecture.

**Rationale**: The entire nitro-fueled system operates as markdown files interpreted by Claude Code. There is no TypeScript runtime. The "stack detection engine" is a reference file (lookup table) that Claude reads when executing `/create-agent`. The "template system" is a markdown template with clearly marked variables that Claude populates using its knowledge of each tech stack. This matches the existing command pattern (thin wrapper -> read reference -> execute) and requires zero runtime code.

**Evidence**: All existing commands (`create-task.md`, `plan.md`, `orchestrate.md`) follow the "read source of truth file, then execute" pattern. The template approach mirrors how `create-task.md` reads `task-template.md` as its source of truth.

---

### Component Specifications

#### Component 1: Stack Detection Registry

**Purpose**: Structured reference file mapping manifest files/patterns to tech stack identifiers. Used by the `/create-agent` command (and future CLI init) to detect what's in a project.

**Pattern**: Reference file (like `agent-catalog.md` or `systems-developer-patterns.md`)
**Evidence**: `systems-developer-patterns.md` -- structured reference with tables and sections; `agent-catalog.md` -- matrix tables for capability lookup

**File**: `.claude/skills/orchestration/references/stack-detection-registry.md`
**Max Lines**: 300

**Responsibilities**:
- Define manifest-to-stack mappings for 10+ ecosystems (Node.js/TypeScript, Python, Java/Kotlin, Swift/iOS, Dart/Flutter, Go, Rust, Ruby, C#/.NET, PHP)
- Define confidence levels (high/medium/low) per detection rule
- Define content patterns (what to look for inside manifest files to refine detection)
- Define monorepo indicators (Nx, Yarn workspaces, pnpm, Lerna, Turborepo, Bazel)
- Define infrastructure detection (Docker, CI/CD, cloud configs, databases)
- Map detected stacks to recommended agent names

**Structure**:

```markdown
# Stack Detection Registry

## How to Use This File
(Brief instructions for commands/CLI that consume this registry)

## Language Detection Rules
(Table: Manifest File | Stack ID | Category | Confidence | Content Patterns)

## Framework Detection Rules
(Table per language: Dependency/Pattern | Framework ID | Agent Suffix)

## Infrastructure Detection Rules
(Table: File Pattern | Infrastructure ID | Category)

## Database Detection Rules
(Table: Config Pattern | Database ID)

## Monorepo Indicators
(Table: File Pattern | Workspace Type | Scan Strategy)

## Stack-to-Agent Mapping
(Table: Stack ID | Recommended Agent Name | Agent Title)
```

**Quality Requirements**:
- Cover all 10 ecosystems from task-description.md Requirement 7
- Every entry must have a confidence level
- Content patterns must be specific enough to distinguish frameworks (e.g., `"react"` in package.json dependencies vs `"angular"`)
- No duplicate detection rules

**Files Affected**:
- `.claude/skills/orchestration/references/stack-detection-registry.md` (CREATE)

---

#### Component 2: Developer Agent Template

**Purpose**: Single source-of-truth template that generates any developer agent. Contains template variables (`{variable}`) that get populated with stack-specific content. The generated output must be structurally identical to `backend-developer.md` and `frontend-developer.md`.

**Pattern**: Template file (analogous to `task-tracking/task-template.md` which `create-task.md` reads)
**Evidence**: `create-task.md:16` -- "Read task-template.md as the source of truth for task structure"

**File**: `.claude/skills/orchestration/references/developer-template.md`
**Max Lines**: 300

**CRITICAL DESIGN CONSTRAINT**: The template must produce agents that pass structural validation against the section skeleton identified in Pattern 1. Every section from the existing developer agents must be present. The template must be under 300 lines while still containing the full skeleton -- this is achievable because:
- Shared sections (Initialization Protocol, Escalation Protocol, No Git Operations, Universal Critical Rules) use identical text across all agents with only the agent name varying
- Variable sections (Principles, Patterns, Quality Standards, Anti-Patterns, Pro Tips) use template variables

**Responsibilities**:
- Define the complete agent markdown skeleton with template variables
- Document all template variables with descriptions and example values
- Ensure generated agents match the section order from existing developer agents exactly

**Template Variables** (extracted from task-description.md Requirement 3, verified against actual agent structure):

| Variable | Description | Example (Java) | Used In Section |
|----------|-------------|-----------------|-----------------|
| `{agent_name}` | Kebab-case identifier | `java-developer` | YAML frontmatter, return format |
| `{agent_title}` | Display name | `Java Developer` | Title, return format header |
| `{agent_description}` | One-line role description | `Java Developer focused on Spring Boot services, JPA data access, and REST API implementation` | YAML frontmatter |
| `{language}` | Primary language | `Java` | Multiple sections |
| `{framework}` | Primary framework | `Spring Boot` | Principles, patterns |
| `{secondary_frameworks}` | Additional frameworks | `JPA/Hibernate, Flyway, Lombok` | Patterns section |
| `{testing_tools}` | Testing frameworks | `JUnit 5, Mockito, AssertJ` | Init protocol step 4.5 |
| `{build_tools}` | Build system | `Gradle` | Init protocol, pro tips |
| `{file_types}` | File extensions | `.java, .kt, .xml, .properties` | Init protocol step 5 |
| `{principles_content}` | Core principles with language-idiomatic examples | (SOLID with Java examples) | Core Principles Foundation |
| `{patterns_content}` | Domain-specific pattern catalog | (Repository, Service Layer, Controller patterns for Spring Boot) | Pattern Awareness Catalog |
| `{quality_standards_content}` | Language-specific quality rules | (No raw types, prefer Optional, use records for DTOs) | Code Quality Standards |
| `{universal_rules_content}` | Language-adapted top priority rules | (Same 7 rules, language-specific examples) | Universal Critical Rules |
| `{anti_patterns_content}` | Language-specific anti-patterns | (God classes, anemic domain model, catching Exception) | Anti-Patterns |
| `{pro_tips_content}` | Practical ecosystem tips | (Use records for DTOs, prefer constructor injection) | Pro Tips |
| `{complexity_levels_content}` | 4 levels with language-specific signals and approaches | (Level 1: Simple CRUD with Spring Data JPA...) | Init protocol step 5.5 |
| `{review_lessons_paths}` | Paths to relevant review-lessons files | `.claude/review-lessons/review-general.md` | Init protocol step 4.5 |
| `{file_size_table}` | Language-appropriate file size limits | (Component: 150, Service: 200, Test: 300) | Init protocol step 4.6 |

**Structure of the template file**:

```markdown
# Developer Agent Template

## Template Variables Reference
(Table documenting all variables with descriptions, types, examples)

## Template
---
name: {agent_name}
description: {agent_description}
---

# {agent_title} Agent - Intelligence-Driven Edition

(Full agent skeleton with {variables} in place of stack-specific content)
(Shared sections use literal text matching existing agents)
(Stack-specific sections use {variable} placeholders)
```

**Quality Requirements**:
- Generated output must have identical section ordering to `backend-developer.md`
- All 14 sections from Pattern 1 must be present in template
- No `{variable}` tokens may remain in generated output
- Template must include instructions for the AI populating it
- Template + variable reference must stay under 300 lines

**Files Affected**:
- `.claude/skills/orchestration/references/developer-template.md` (CREATE)

---

#### Component 3: `/create-agent` Command

**Purpose**: On-demand command for generating a new developer agent. Follows the thin-wrapper command pattern. Reads the developer template, gathers information (interactively or from arguments), populates variables using AI knowledge of the target stack, writes the agent file, and updates the agent catalog.

**Pattern**: Command file (thin wrapper)
**Evidence**: `create-task.md` -- same pattern: read template, gather info, generate file, update registry

**File**: `.claude/commands/create-agent.md`
**Max Lines**: 200

**Responsibilities**:
- Parse arguments (`/create-agent` interactive, `/create-agent java-developer "Spring Boot backend"` pre-filled)
- Pre-flight checks (verify `.claude/agents/` exists, verify agent-catalog.md exists, verify developer-template.md exists, verify agent does not already exist)
- Read developer-template.md as source of truth
- Read stack-detection-registry.md for stack knowledge
- Read an existing developer agent for pattern verification (e.g., `backend-developer.md`)
- Gather required information (agent name, language, framework, tools, patterns) -- interactively or AI-inferred from description
- Populate template variables with high-quality, stack-specific content
- Write agent file to `.claude/agents/{agent-name}.md`
- Update agent catalog (add entry to Development Agents section, update Capability Matrix, update Category Summary)
- Display summary with file path and usage instructions

**Structure**:

```markdown
# Create Agent

Generate a new developer agent from the canonical template.

## Usage
(/create-agent, /create-agent [name] [description])

## Execution Steps
### Step 1: Pre-Flight Checks
### Step 2: Read Template and References
### Step 3: Gather Agent Information
### Step 4: Populate Template
### Step 5: Write Agent File
### Step 6: Update Agent Catalog
### Step 7: Display Summary

## Agent Catalog Update Protocol
(Exact instructions for which sections to update and how)

## Important Rules
(Constraints and validation requirements)

## References
```

**Quality Requirements**:
- Must verify agent name does not already exist before creating
- Must read the template file, never hardcode template structure
- Must update ALL sections of agent-catalog.md (matrix, entries, summary)
- Must validate generated agent has all 14 required sections
- Generated agent must be under 400 lines

**Files Affected**:
- `.claude/commands/create-agent.md` (CREATE)

---

#### Component 4: `/create-skill` Command

**Purpose**: On-demand command for generating a new skill directory and SKILL.md file. Follows the thin-wrapper command pattern.

**Pattern**: Command file (thin wrapper)
**Evidence**: `create-task.md`, `plan.md` -- same thin-wrapper pattern

**File**: `.claude/commands/create-skill.md`
**Max Lines**: 200

**Responsibilities**:
- Parse arguments (`/create-skill` interactive, `/create-skill database-migration "Handles DB migrations"` pre-filled)
- Pre-flight checks (verify `.claude/skills/` exists, verify skill does not already exist)
- Read an existing SKILL.md for pattern reference (e.g., `ui-ux-designer/SKILL.md`)
- Gather required information (skill name, description, trigger conditions, key workflow steps)
- Generate SKILL.md with YAML frontmatter, trigger conditions, workflow steps, quality standards, integration points
- Create skill directory at `.claude/skills/{skill-name}/`
- Write SKILL.md to `.claude/skills/{skill-name}/SKILL.md`
- Display summary with directory path and integration instructions

**Structure**:

```markdown
# Create Skill

Generate a new skill directory with a properly structured SKILL.md.

## Usage
(/create-skill, /create-skill [name] [description])

## Execution Steps
### Step 1: Pre-Flight Checks
### Step 2: Read Existing Skill for Pattern Reference
### Step 3: Gather Skill Information
### Step 4: Generate SKILL.md
### Step 5: Create Directory and Write File
### Step 6: Display Summary

## Important Rules
(Constraints and validation requirements)

## References
```

**Quality Requirements**:
- Must verify skill name does not already exist before creating
- Must read an existing SKILL.md for pattern consistency
- Generated SKILL.md must have YAML frontmatter with `name` and `description`
- Generated SKILL.md must have trigger conditions section
- Must be under 300 lines

**Files Affected**:
- `.claude/commands/create-skill.md` (CREATE)

---

#### Component 5: Agent Catalog Integration Instructions

**Purpose**: Document the exact protocol for updating the agent catalog when a new agent is generated. This is embedded within the `/create-agent` command but also serves as a reference for the future CLI init flow.

**Pattern**: Inline within the `/create-agent` command (Step 6: Update Agent Catalog) with a detailed protocol
**Evidence**: `agent-catalog.md` structure -- 4 update points required: Capability Matrix table, Agent Selection Matrix (if applicable), Development Agents section (new entry), Agent Category Summary table

**Responsibilities**:
- Define exact catalog update protocol (which sections, what format, what order)
- Specify the entry template matching existing Development Agents format
- Specify Capability Matrix row format (agent name + P/S/- capability columns)
- Specify Category Summary row update (add to Development row's agent list)
- Ensure header count ("Comprehensive catalog of all N specialist agents") gets incremented

**This component is NOT a separate file** -- it is the "Agent Catalog Update Protocol" section within `/create-agent` command. Documented here for architectural clarity.

**Quality Requirements**:
- Must update ALL 4 sections of agent-catalog.md
- Must increment the agent count in the catalog header
- Must match existing entry format character-for-character
- Must update orchestrate.md Quick Reference agent list and count

**Files Affected**:
- `.claude/commands/create-agent.md` (part of Component 3)

---

## Integration Architecture

### Data Flow

```
User runs /create-agent [name] [description]
  |
  v
create-agent.md (command)
  |-- reads --> developer-template.md (template source of truth)
  |-- reads --> stack-detection-registry.md (stack knowledge reference)
  |-- reads --> backend-developer.md (pattern verification)
  |-- reads --> agent-catalog.md (for update)
  |
  v
AI populates template variables with stack-specific content
  |
  v
Writes: .claude/agents/{name}.md (new agent)
Updates: agent-catalog.md (new entry + matrix rows)
Updates: orchestrate.md (Quick Reference agent count/list)
```

```
User runs /create-skill [name] [description]
  |
  v
create-skill.md (command)
  |-- reads --> ui-ux-designer/SKILL.md (pattern reference)
  |
  v
AI generates skill content from user input
  |
  v
Creates: .claude/skills/{name}/SKILL.md (new skill)
```

```
Future: CLI init flow
  |
  v
Reads stack-detection-registry.md
Scans project files against registry rules
Presents detected stack to user
For each approved agent:
  Runs /create-agent equivalent flow
```

### Dependencies

- **External**: None (all markdown-based, no runtime dependencies)
- **Internal**:
  - `developer-template.md` depends on the section skeleton from existing developer agents
  - `create-agent.md` depends on `developer-template.md`, `stack-detection-registry.md`, and `agent-catalog.md`
  - `create-skill.md` depends on existing SKILL.md files for pattern reference

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

- **Consistency**: Generated agents MUST be structurally identical to hand-written agents (same sections, same order, same formatting)
- **Maintainability**: Single template source of truth -- adding a new ecosystem requires only adding registry entries, not template changes
- **Extensibility**: New stacks addable by extending the registry without modifying commands or template
- **File Size Compliance**: All files within limits (agents: 400, commands: 200, references: 300)
- **Cross-Reference Integrity**: Every file path referenced in commands must exist; every catalog entry must match the agent file

### Validation Checklist (for reviewers)

- [ ] Generated agent has all 14 sections from Pattern 1
- [ ] Generated agent YAML frontmatter matches format of existing agents
- [ ] Generated agent is under 400 lines
- [ ] Template file is under 300 lines
- [ ] Registry file is under 300 lines
- [ ] Command files are under 200 lines each
- [ ] Agent catalog update includes all 4 sections
- [ ] No `{variable}` tokens remain in generated output
- [ ] Stack-specific content is genuinely idiomatic (not generic filler)
- [ ] All cross-references in commands point to existing files

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: systems-developer
**Rationale**: All deliverables are markdown specification files (agent definitions, command files, reference files). This is the systems-developer's core domain as defined in `systems-developer.md:8` -- "builds and maintains AI orchestration infrastructure -- agent definitions, skill files, command files, markdown specifications." No TypeScript runtime code is involved.

### Complexity Assessment

**Complexity**: HIGH
**Estimated Effort**: 3-5 hours

Rationale: 4 new files to create, 1 file to document update protocol for. Each file requires precise pattern matching against existing conventions. The developer template is the most complex component -- it must encode the full agent skeleton while remaining under 300 lines. The stack detection registry requires comprehensive coverage of 10+ ecosystems.

### Files Affected Summary

**CREATE**:
- `.claude/skills/orchestration/references/stack-detection-registry.md` -- Stack detection reference (manifest-to-stack mappings)
- `.claude/skills/orchestration/references/developer-template.md` -- Developer agent template with variables
- `.claude/commands/create-agent.md` -- `/create-agent` command
- `.claude/commands/create-skill.md` -- `/create-skill` command

**MODIFY**: None at creation time. The `/create-agent` command defines the protocol for modifying `agent-catalog.md` and `orchestrate.md` at runtime when an agent is actually generated.

### Architecture Delivery Checklist

- [x] All components specified with evidence
- [x] All patterns verified from codebase (3 developer agents, 3 commands, agent catalog)
- [x] All cross-references verified as existing files
- [x] Quality requirements defined (file size limits, structural validation, cross-reference integrity)
- [x] Integration points documented (agent catalog, orchestrate command)
- [x] Files affected list complete (4 CREATE)
- [x] Developer type recommended (systems-developer)
- [x] Complexity assessed (HIGH, 3-5 hours)
- [x] No step-by-step implementation (that's team-leader's job)
