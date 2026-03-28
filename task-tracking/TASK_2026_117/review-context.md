# Review Context — TASK_2026_117

## Task Scope
- Task ID: 2026_117
- Task type: REFACTORING
- Files in scope: `apps/cli/scaffold/.claude/commands/*.md` (17 files renamed)

## Git Diff Summary

Implementation commit: `7f3c43a` — "refactor(scaffold): rename commands to nitro-* prefix in scaffold — TASK_2026_117"

Files changed (18 total, 167 insertions / 111 deletions):

| Old Name | New Name | Content Changed |
|---|---|---|
| `auto-pilot.md` | `nitro-auto-pilot.md` | Yes — extensive content update |
| `create-agent.md` | `nitro-create-agent.md` | Yes — minor updates |
| `create-skill.md` | `nitro-create-skill.md` | Yes — minor updates |
| `create-task.md` | `nitro-create-task.md` | Yes — substantial updates |
| `create.md` | `nitro-create.md` | Yes — minor updates |
| `evaluate-agent.md` | `nitro-evaluate-agent.md` | Yes — minor updates |
| `initialize-workspace.md` | `nitro-initialize-workspace.md` | No content change |
| `orchestrate-help.md` | `nitro-orchestrate-help.md` | Yes — minor |
| `orchestrate.md` | `nitro-orchestrate.md` | Yes — minor |
| `plan.md` | `nitro-plan.md` | Yes — content updates |
| `project-status.md` | `nitro-project-status.md` | Yes — minor |
| `retrospective.md` | `nitro-retrospective.md` | Yes — content updates |
| `review-code.md` | `nitro-review-code.md` | No content change |
| `review-logic.md` | `nitro-review-logic.md` | No content change |
| `review-security.md` | `nitro-review-security.md` | No content change |
| `run.md` | `nitro-run.md` | Yes — minor updates |
| `status.md` | `nitro-status.md` | New file (15 lines) |

All 17 files exist post-rename in `apps/cli/scaffold/.claude/commands/` with `nitro-` prefix. No old names remain.

Key changes in content-modified files:
- **nitro-auto-pilot.md**: Updated slash command references from `/auto-pilot` to `/nitro-auto-pilot`; updated parameter/quick-reference sections
- **nitro-create-task.md**: Updated command references; added parallelism section references
- **nitro-plan.md**: Updated skill references, command name in usage
- **nitro-retrospective.md**: Updated command usage line; added new sections
- **nitro-run.md**: Updated command invocation from `/run` to `/nitro-run`
- **nitro-orchestrate-help.md**: Updated help header/references

## Project Conventions

From CLAUDE.md:
- Agent naming: all agents use the `nitro-` prefix (e.g., `nitro-planner`, `nitro-software-architect`). This prefix scopes agents to the nitro-fueled namespace.
- Command files live in `.claude/commands/` and scaffold copy at `apps/cli/scaffold/.claude/commands/`
- **This project IS the library being tested on itself.** The `.claude/` directory here is the scaffold — changes here sync with what `npx @itqanlab/nitro-fueled init` copies.
- Conventional commits with scopes

## Style Decisions from Review Lessons

Relevant rules from `.claude/review-lessons/review-general.md` for markdown/documentation files:

1. **Named concepts must use one term everywhere** — slash commands in the scaffold must consistently use the `nitro-` prefix throughout content. No mixing of old names (`/plan`, `/auto-pilot`, `/run`) with new names in the same file.
2. **Enum values must match canonical source character-for-character** — status values, task types, and other enums must be consistent with SKILL.md.
3. **Cross-file section references must use names, not numbers** — if a command file references a section in SKILL.md, use the section heading name, not a step number.
4. **Prompt templates must reference canonical definitions, not duplicate them** — command files that reference skill files should do so by path, not embed simplified copies.
5. **Implementation-era language must be removed before merge** — any phrases like "new prefix" or "renamed from" should be rewritten for steady-state behavior.
6. **Summary sections must be updated when the steps they describe change** — if a command's Quick Reference or Usage section lists command names, these must all be updated to `nitro-*` form.
7. **"Create using the template below" must be followed by an actual template** — any creation instructions must include the actual template structure.
8. **Step numbering must be flat and sequential** — no mixed schemes (Step 5, 5b, 5c).

## Scope Boundary (CRITICAL)

Reviewers MUST only flag and fix issues in these files:
- `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`
- `apps/cli/scaffold/.claude/commands/nitro-create-agent.md`
- `apps/cli/scaffold/.claude/commands/nitro-create-skill.md`
- `apps/cli/scaffold/.claude/commands/nitro-create-task.md`
- `apps/cli/scaffold/.claude/commands/nitro-create.md`
- `apps/cli/scaffold/.claude/commands/nitro-evaluate-agent.md`
- `apps/cli/scaffold/.claude/commands/nitro-initialize-workspace.md`
- `apps/cli/scaffold/.claude/commands/nitro-orchestrate-help.md`
- `apps/cli/scaffold/.claude/commands/nitro-orchestrate.md`
- `apps/cli/scaffold/.claude/commands/nitro-plan.md`
- `apps/cli/scaffold/.claude/commands/nitro-project-status.md`
- `apps/cli/scaffold/.claude/commands/nitro-retrospective.md`
- `apps/cli/scaffold/.claude/commands/nitro-review-code.md`
- `apps/cli/scaffold/.claude/commands/nitro-review-logic.md`
- `apps/cli/scaffold/.claude/commands/nitro-review-security.md`
- `apps/cli/scaffold/.claude/commands/nitro-run.md`
- `apps/cli/scaffold/.claude/commands/nitro-status.md`

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 2
- Serious: 10
- Minor: 9

### Breakdown by Reviewer
| Severity | Style | Logic | Security | Total |
|----------|-------|-------|----------|-------|
| Blocking | 2 | 0 | 0 | 2 |
| Serious  | 7 | 2 | 1 (MEDIUM) | 10 |
| Minor    | 3 | 3 | 3 (LOW) | 9 |
