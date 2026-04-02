# Context — TASK_2026_279

## User Intent
Rename all unprefixed nitro-fueled directories and files in .claude/ to use the nitro-* prefix. Part 1 of 2 — structural renames only, no reference updates.

## Strategy
REFACTORING → Direct implementation (task.md fully prescriptive) → Completion Phase

## Renames Required
### .claude/skills/
- orchestration/ → nitro-orchestration/
- auto-pilot/ → nitro-auto-pilot/
- technical-content-writer/ → nitro-technical-content-writer/
- ui-ux-designer/ → nitro-ui-ux-designer/

### .claude/
- review-lessons/ → nitro-review-lessons/
- anti-patterns.md → nitro-anti-patterns.md
- anti-patterns-master.md → nitro-anti-patterns-master.md

### apps/cli/scaffold/.claude/ (mirror)
- Same 7 renames mirrored in scaffold

## Note
Reference updates (agents, commands, skill files, CLI source) are handled in Part 2 (TASK_2026_280). Only physical file/directory renames here.
