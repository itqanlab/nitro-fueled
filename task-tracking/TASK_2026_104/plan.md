# Implementation Plan — TASK_2026_104

## Approach

Pure documentation task — update 4 markdown files in the orchestration skill references. No application code changes needed.

## Batch Structure

### Batch 1: strategies.md (RESEARCH section expansion)
- Replace minimal RESEARCH section with full expanded section
- Add sub-flow table and diagrams
- Add new keywords
- Update Strategy Overview table

### Batch 2: SKILL.md + agent-catalog.md + checkpoints.md (cross-file updates)
- Update SKILL.md RESEARCH routing (keywords + strategy reference table)
- Update agent-catalog.md (researcher, PM, architect triggers + selection matrix)
- Update checkpoints.md RESEARCH row

## File Scope

- `.claude/skills/orchestration/references/strategies.md`
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/orchestration/references/agent-catalog.md`
- `.claude/skills/orchestration/references/checkpoints.md`

## Key Decisions

- All 4 sub-flows share the same PM-bookend structure (PM opens, PM closes)
- Architect is only added for tech eval and feasibility (not market/competitive research)
- Review criteria kept at the end of the RESEARCH section in strategies.md
- checkpoints.md Scope column set to Yes (sub-flow selection requires scoping)
