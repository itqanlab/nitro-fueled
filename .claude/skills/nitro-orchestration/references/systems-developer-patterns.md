# Systems Developer Domain Expertise

Reference for the systems-developer agent covering structure requirements and key patterns for each file type in the orchestration system.

---

## Agent Definitions (.claude/agents/*.md)

**Structure Requirements:**

- YAML frontmatter: `name`, `description` fields
- Title with agent role
- Core principles section
- Mandatory initialization protocol
- Escalation protocol
- Step-by-step execution workflow
- Return format specification
- Quality standards
- Anti-patterns section

**Key Patterns:**

- Agents are executors, not decision-makers
- Team-leader assigns work via tasks.md batches
- Agents read review-lessons before coding
- Agents verify imports/patterns before implementing
- Agents report back to team-leader, never directly commit

---

## Skill Files (.claude/skills/**/SKILL.md)

**Structure Requirements:**

- Clear trigger conditions
- Configuration/parameter tables
- Step-by-step workflow
- Integration with other agents/skills
- Output specifications

**Key Patterns:**

- Skills define behavioral specifications
- Commands handle argument parsing and pre-flight
- Parameters must be synchronized between skill and command
- Enum values must match canonical sources exactly

---

## Command Files (.claude/commands/*.md)

**Structure Requirements:**

- Clear invocation syntax
- Parameter definitions
- Pre-flight checks
- Delegation to appropriate skill/agent
- Output format

**Key Patterns:**

- Commands are thin wrappers around skills
- Never duplicate skill logic in commands
- Mode keywords must use exact-match parsing

---

## Reference Files (.claude/skills/nitro-orchestration/references/*.md)

**Structure Requirements:**

- Comprehensive coverage of the reference topic
- Cross-references to related files
- Examples and templates
- Decision matrices for agent selection

**Key Patterns:**

- References are read by orchestration skill, not by developers directly
- Must stay synchronized with agent definitions
- New agents/capabilities must be reflected in all reference files
