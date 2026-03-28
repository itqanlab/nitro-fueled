# Implementation Plan - TASK_2026_100

## Nitro Commit Traceability Standard

**Type**: REFACTORING
**Priority**: P1-High
**Complexity**: Medium
**Model**: default

---

## Codebase Investigation Summary

### Libraries Discovered

- **git-standards.md** (`.claude/skills/orchestration/references/`)
  - Purpose: Git conventions for orchestrated task execution
  - Key exports: Commit message format, type/scope rules, commit rules, branch naming
  - Current state: Has optional footer, no structured traceability fields

- **Orchestration SKILL.md** (`.claude/skills/orchestration/`)
  - Purpose: Multi-phase development workflow orchestration
  - Key exports: Agent invocation pattern, commit patterns in Completion Phase, worker context passing
  - Current state: Commits lack structured traceability footer

- **Auto-pilot SKILL.md** (`.claude/skills/auto-pilot/`)
  - Purpose: Supervisor loop for spawning/monitoring workers
  - Key exports: Worker Prompt Templates (Build, Review, fix, completion), metadata passing to workers
  - Current state: Worker prompts lack traceability footer instructions

- **Agent definitions** (`.claude/agents/nitro-*.md`)
  - Purpose: Individual agent instructions
  - Current state: Agents do not reference commit traceability requirements

### Patterns Identified

- **Commit Pattern**: Current format uses `type(scope): description` with optional `Co-Authored-By` line
  - Evidence: `.claude/skills/orchestration/references/git-standards.md:10-30`
  - Components: Type, Scope, Subject, Body, Footer

- **Worker Prompt Pattern**: Supervisor passes metadata (TASK_ID, project_root, worker_id) to workers
  - Evidence: `.claude/skills/auto-pilot/SKILL.md:1280-1700`
  - Available metadata: Task ID, Session ID, Provider, Model, Retry count (from state.md), Complexity, Priority

- **Completion Phase Pattern**: Three-commit sequence (implementation, QA fixes, bookkeeping)
  - Evidence: `.claude/skills/orchestration/SKILL.md:453-565`

### Integration Points

- **Worker Metadata Flow**: Supervisor (auto-pilot) -> Worker prompt -> Agent execution -> Git commit
- **Version Source**: Read from `package.json` at `.claude/skills/orchestration/references/git-standards.md` mentions manifest.json or package.json

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Structured footer injection at all commit points
**Rationale**: Traceability requires capturing context at the point of commit. All commits from orchestrated work must include full metadata for git log queries.
**Evidence**: Current footer is optional and unstructured (git-standards.md:26-28)

### Component Specifications

#### Component 1: git-standards.md Update

**Purpose**: Define the new structured traceability footer format and update all examples
**Pattern**: Reference documentation pattern (git-standards.md is a reference file)
**Evidence**: Existing format rules in git-standards.md:16-29

**Responsibilities**:
- Define new footer format with 11 required fields
- Add footer field reference table with values/purposes
- Update all commit examples to include traceability footer
- Add traceability queries section for git log reference

**Implementation Pattern**:
```markdown
## Commit Message Format

<type>(<scope>): <short description>

[optional body]

Task: TASK_YYYY_NNN
Agent: nitro-<agent-name>
Phase: <phase>
Worker: <worker-type>
Session: SESSION_YYYY-MM-DD_HH-MM-SS
Provider: <provider>
Model: <model>
Retry: <attempt>/<max>
Complexity: <complexity>
Priority: <priority>
Generated-By: nitro-fueled v<version> (https://github.com/itqanlab/nitro-fueled)
```

**Quality Requirements**:
- All 11 footer fields documented with allowed values
- Rules section updated for when footer is required vs optional
- Example commits updated for all strategies (FEATURE, BUGFIX, REFACTORING, DEVOPS, DOCUMENTATION)
- Traceability queries section added with practical examples

**Files Affected**:
- `.claude/skills/orchestration/references/git-standards.md` (MODIFY)

---

#### Component 2: Orchestration SKILL.md Update

**Purpose**: Pass task metadata to agents for footer inclusion in commits
**Pattern**: Context passing pattern (metadata injection into agent prompts)
**Evidence**: Agent Invocation Pattern at orchestration/SKILL.md:195-207

**Responsibilities**:
- Define metadata block format for agent context
- Update Completion Phase commit instructions to include full footer
- Update checkpoint commit instructions to include footer

**Implementation Pattern**:
```markdown
## Commit Metadata Block

When spawning agents that will create commits, pass this metadata block:

**Commit Metadata**:
- Task: TASK_YYYY_NNN
- Session: SESSION_YYYY-MM-DD_HH-MM-SS | manual
- Provider: claude | glm | opencode
- Model: <resolved-model>
- Retry: <attempt>/<max>
- Complexity: <from-task.md>
- Priority: <from-task.md>
```

**Quality Requirements**:
- Metadata must be extractable from task context
- Session ID available from orchestration session
- Provider/Model available from current execution context
- Complexity/Priority available from task.md

**Files Affected**:
- `.claude/skills/orchestration/SKILL.md` (MODIFY)

---

#### Component 3: Auto-pilot SKILL.md Update

**Purpose**: Include full footer instructions in worker prompt templates; Supervisor passes all metadata fields
**Pattern**: Worker prompt template pattern
**Evidence**: Worker Prompt Templates at auto-pilot/SKILL.md:1277-1700

**Responsibilities**:
- Add Commit Metadata section to all worker prompts (Build, Review, Test, Fix, Completion)
- Define Agent identity mapping (worker type -> Agent footer value)
- Update state.md tracking to include fields needed for footer
- Pass Provider, Model, Retry, Complexity, Priority in worker prompts

**Implementation Pattern** (for each worker prompt):
```markdown
## Commit Metadata (REQUIRED for all commits)

All commits you create MUST include this footer:

Task: {TASK_ID}
Agent: nitro-backend-developer  # <-- Your agent identity
Phase: implementation | review-fix | test-fix | review | test | completion
Worker: build-worker | fix-worker | review-worker | test-worker | completion-worker
Session: {SESSION_ID}
Provider: {provider}
Model: {model}
Retry: {retry_count}/{max_retries}
Complexity: {complexity}
Priority: {priority}
Generated-By: nitro-fueled v{version} (https://github.com/itqanlab/nitro-fueled)
```

**Worker-to-Agent Mapping**:
| Worker Type | Agent Value |
|-------------|-------------|
| Build Worker (backend code) | nitro-backend-developer |
| Build Worker (frontend code) | nitro-frontend-developer |
| Build Worker (infra code) | nitro-devops-engineer |
| Build Worker (orchestration/skills) | nitro-systems-developer |
| Review Lead | nitro-review-lead |
| Test Lead | nitro-test-lead |
| Fix Worker | nitro-fix-worker |
| Completion Worker | nitro-completion-worker |
| Team-Leader | nitro-team-leader |
| Supervisor (auto-pilot) | auto-pilot |

**Quality Requirements**:
- All 8 worker prompt templates updated (First-Run Build, Retry Build, First-Run Review, Retry Review, First-Run Test, Retry Test, First-Run Fix, Retry Fix, Completion)
- Metadata placeholders must be populated by Supervisor before spawn
- Clear guidance on which Agent value to use

**Files Affected**:
- `.claude/skills/auto-pilot/SKILL.md` (MODIFY)

---

#### Component 4: Agent Definition Updates

**Purpose**: Each agent that commits must reference footer requirement and know its Agent identity
**Pattern**: Agent definition pattern (YAML frontmatter + markdown body)
**Evidence**: Agent files at `.claude/agents/nitro-*.md`

**Affected Agents** (those that commit):
- `nitro-team-leader.md` - Creates commits in MODE 2
- `nitro-backend-developer.md` - Does NOT commit (team-leader commits for them)
- `nitro-frontend-developer.md` - Does NOT commit (team-leader commits for them)
- `nitro-devops-engineer.md` - May commit directly for DEVOPS tasks
- `nitro-systems-developer.md` - May commit for orchestration work
- `nitro-review-lead.md` - Creates fix commits and completion commits
- `nitro-unit-tester.md` - Creates test commits
- `nitro-integration-tester.md` - Creates test commits
- `nitro-e2e-tester.md` - Creates test commits
- `nitro-test-lead.md` - May create test commits

**Implementation Pattern** (add to each committing agent):
```markdown
## Commit Traceability (REQUIRED)

When you create git commits, include this footer:

Task: TASK_YYYY_NNN
Agent: nitro-<your-agent-name>
Phase: <current-phase>
Worker: <worker-type-from-prompt>
Session: <from-prompt>
Provider: <from-prompt>
Model: <from-prompt>
Retry: <from-prompt>
Complexity: <from-prompt>
Priority: <from-prompt>
Generated-By: nitro-fueled v<version> (https://github.com/itqanlab/nitro-fueled)

Read version from package.json at project root.
```

**Quality Requirements**:
- Each agent knows its own Agent identity value
- Each agent references the footer requirement
- Clear instruction on how to populate each field

**Files Affected**:
- `.claude/agents/nitro-team-leader.md` (MODIFY)
- `.claude/agents/nitro-devops-engineer.md` (MODIFY)
- `.claude/agents/nitro-systems-developer.md` (MODIFY)
- `.claude/agents/nitro-review-lead.md` (MODIFY)
- `.claude/agents/nitro-unit-tester.md` (MODIFY)
- `.claude/agents/nitro-integration-tester.md` (MODIFY)
- `.claude/agents/nitro-e2e-tester.md` (MODIFY)
- `.claude/agents/nitro-test-lead.md` (MODIFY)

---

## Integration Architecture

### Data Flow

```
Supervisor (auto-pilot)
  |
  +-- Reads task.md --> Extract Complexity, Priority
  +-- Reads state.md --> Extract Retry count, Session ID
  +-- Resolves Provider/Model --> Provider routing table
  |
  +-- Spawns worker with metadata block
        |
        +-- Worker reads agent definition --> Knows Agent identity
        +-- Worker creates commit --> Includes full footer
              |
              +-- Git history has traceable commits
```

### Dependencies

- **Internal**: git-standards.md defines format, skills pass metadata, agents reference format
- **External**: None (version read from package.json at runtime)

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

- **Traceability**: All commits from orchestrated work queryable by task, agent, phase, provider, model, session, retry, complexity, priority
- **Maintainability**: Single source of truth for footer format (git-standards.md)
- **Backward Compatibility**: Manual commits outside orchestration remain unchanged (footer optional)
- **Discoverability**: Traceability queries section enables self-service analysis

---

## Batch Breakdown for Team-Leader Assignment

### Batch 1: Reference Documentation (git-standards.md)
**Complexity**: Medium
**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/orchestration/references/git-standards.md`

**Tasks**:
1. Update commit format spec with new 11-field traceability footer
2. Add Footer Field Reference table with all fields, required status, allowed values, purposes
3. Update all commit examples (FEATURE, BUGFIX, REFACTORING, DEVOPS, DOCUMENTATION strategies)
4. Add Traceability Queries section with git log examples
5. Add Rules section clarifying when footer is required vs optional

### Batch 2: Orchestration Skill (metadata passing)
**Complexity**: Medium
**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/orchestration/SKILL.md`

**Tasks**:
1. Add Commit Metadata Block section defining metadata format
2. Update Completion Phase commit instructions with full footer
3. Update checkpoint commit instructions (PM, Architect approvals)
4. Add guidance on extracting metadata from task context

### Batch 3: Auto-pilot Skill (worker prompts)
**Complexity**: High
**Developer**: nitro-systems-developer
**Files**:
- `.claude/skills/auto-pilot/SKILL.md`

**Tasks**:
1. Add Commit Metadata section to First-Run Build Worker Prompt
2. Add Commit Metadata section to Retry Build Worker Prompt
3. Add Commit Metadata section to First-Run Review Lead Prompt
4. Add Commit Metadata section to Retry Review Lead Prompt
5. Add Commit Metadata section to First-Run Test Lead Prompt
6. Add Commit Metadata section to Retry Test Lead Prompt
7. Add Commit Metadata section to First-Run Fix Worker Prompt
8. Add Commit Metadata section to Retry Fix Worker Prompt
9. Add Commit Metadata section to Completion Worker Prompt
10. Add Worker-to-Agent mapping table
11. Update state.md tracking fields (if needed for footer metadata)

### Batch 4: Committing Agent Definitions
**Complexity**: Low (repetitive)
**Developer**: nitro-systems-developer
**Files**:
- `.claude/agents/nitro-team-leader.md`
- `.claude/agents/nitro-review-lead.md`
- `.claude/agents/nitro-devops-engineer.md`
- `.claude/agents/nitro-systems-developer.md`
- `.claude/agents/nitro-unit-tester.md`
- `.claude/agents/nitro-integration-tester.md`
- `.claude/agents/nitro-e2e-tester.md`
- `.claude/agents/nitro-test-lead.md`

**Tasks**:
1. Add Commit Traceability section to each agent
2. Specify Agent identity value for each
3. Add instruction to read version from package.json

---

## Risks and Mitigation Strategies

| Risk | Severity | Mitigation |
|------|----------|------------|
| Metadata not available at commit time | Medium | Define fallback values (e.g., `Session: manual` for `/orchestrate`) |
| Version reading fails | Low | Use `unknown` as fallback |
| Developer agents confused about Agent value | Medium | Clear Worker-to-Agent mapping table in auto-pilot and each agent definition |
| Footer bloats commit messages | Low | Footer is informational only; git log filtering ignores it |

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-systems-developer
**Rationale**: All affected files are orchestration system files (skills, references, agent definitions). No business logic changes.

### Complexity Assessment
**Complexity**: Medium
**Estimated Effort**: 3-4 hours

### Files Affected Summary

**MODIFY**:
- `.claude/skills/orchestration/references/git-standards.md`
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/agents/nitro-team-leader.md`
- `.claude/agents/nitro-review-lead.md`
- `.claude/agents/nitro-devops-engineer.md`
- `.claude/agents/nitro-systems-developer.md`
- `.claude/agents/nitro-unit-tester.md`
- `.claude/agents/nitro-integration-tester.md`
- `.claude/agents/nitro-e2e-tester.md`
- `.claude/agents/nitro-test-lead.md`

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All integration points documented
- [x] Quality requirements defined
- [x] Batch breakdown complete
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] Risks identified with mitigations
