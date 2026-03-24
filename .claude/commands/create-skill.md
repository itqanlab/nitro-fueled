# Create Skill

Scaffold a new skill directory with a pre-filled `SKILL.md` from the standard pattern.

## Usage

```
/create-skill                        # Interactive — prompts for all fields
/create-skill [name] [description]   # Pre-fills name and description
```

## Execution Steps

### Step 1: Pre-Flight Checks

1. Verify `.claude/skills/` directory exists. If missing, tell the user to run `/initialize-workspace` first.
2. If a `name` argument was provided, normalize it to kebab-case (lowercase, hyphens for spaces/underscores).
3. Check that `.claude/skills/{name}/` does NOT already exist. If it does, abort with:
   ```
   Skill "{name}" already exists at .claude/skills/{name}/
   ```

### Step 2: Read Existing SKILL.md for Pattern Reference

Read ONE existing SKILL.md to confirm the current structural pattern:

```
Read(.claude/skills/auto-pilot/SKILL.md)
```

Extract these structural elements:
- YAML frontmatter fields (`name`, `description`)
- Section headings pattern (title, trigger conditions, workflow)

**Never hardcode the full template — always verify against a real SKILL.md.**

### Step 3: Gather Skill Information

**If name and description were provided as arguments:**
- Pre-fill `name` and `description` fields
- Prompt the user for:
  - **Trigger conditions**: When should this skill activate? (list of conditions)
  - **Core workflow steps**: High-level phases of the skill (optional — can be filled later)

**If no arguments provided:**
- Prompt for ALL fields:
  - **Name**: kebab-case identifier (e.g., `data-pipeline`, `code-generator`)
  - **Description**: One-line description for the YAML frontmatter. Must include "Use when" trigger phrase.
  - **Trigger conditions**: When should this skill activate? (list of conditions)
  - **Core workflow steps**: High-level phases (optional)

**Validation rules:**
- Name must be kebab-case (lowercase letters, numbers, hyphens only)
- Description must be non-empty and under 300 characters
- At least 1 trigger condition is required

### Step 4: Create Skill Directory and SKILL.md

1. Create directory: `.claude/skills/{name}/`
2. Generate `SKILL.md` with this structure:

```markdown
---
name: {name}
description: {description}
---

# {Title Case Name} Skill

Brief summary of what this skill does.

## When This Skill Activates

Use this skill when:

- {trigger condition 1}
- {trigger condition 2}
- ...

## Core Workflow

{workflow steps if provided, otherwise a placeholder:}

### Phase 1: [First Phase]

[Describe the first phase of the skill workflow]

### Phase 2: [Next Phase]

[Describe the next phase]

## Output Format

[Describe what the skill produces when complete]
```

3. Write to: `.claude/skills/{name}/SKILL.md`

### Step 5: Display Summary

```
Skill created successfully.

  Name:      {name}
  Directory: .claude/skills/{name}/
  File:      .claude/skills/{name}/SKILL.md

  Next steps:
  - Edit .claude/skills/{name}/SKILL.md to flesh out the workflow
  - Add supporting files to the skill directory as needed
  - Register the skill in settings.json or CLAUDE.md if it needs a slash command trigger
  - Reference from an agent definition if agents should invoke this skill
```

## Important Rules

1. **ALWAYS read an existing SKILL.md first** — verify the structural pattern before generating
2. **ALWAYS check the skill directory doesn't already exist** — never overwrite
3. **Name must be kebab-case** — reject names with uppercase, spaces, or special characters
4. **YAML frontmatter is mandatory** — `name` and `description` are required fields
5. **Description must include trigger context** — the `description` field is used by Claude to decide when to invoke the skill, so it must contain actionable trigger phrases (e.g., "Use when...")
6. **Do NOT generate implementation content** — the SKILL.md is a scaffold; the user fills in domain-specific workflow details
7. **Do NOT modify any other files** — this command only creates the skill directory and SKILL.md

## References

- Skill pattern: `.claude/skills/ui-ux-designer/SKILL.md`
- Skill pattern: `.claude/skills/technical-content-writer/SKILL.md`
- Command pattern: `.claude/commands/create-task.md`
