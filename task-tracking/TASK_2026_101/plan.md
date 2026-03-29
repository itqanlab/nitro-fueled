# Implementation Plan — TASK_2026_101

## Objective
Add CONTENT task type to the orchestration system, enabling blog articles, email campaigns, newsletters, and ad copy to flow through a dedicated pipeline.

## Files to Modify

1. `.claude/skills/orchestration/references/strategies.md`
   - Add CONTENT strategy section with workflow diagram
   - Add to Strategy Overview table
   - Add to Strategy Selection Summary decision tree

2. `.claude/skills/orchestration/SKILL.md`
   - Add CONTENT to Workflow Selection Matrix table (Quick Start section)
   - Add keyword detection in Task Type Detection table
   - Add CONTENT row to Adaptive Strategy Selection

3. `.claude/skills/orchestration/references/agent-catalog.md`
   - Add CONTENT to Agent Selection Matrix (Request Type -> Agent Path)
   - Update nitro-technical-content-writer and nitro-project-manager entries to include CONTENT flow

4. `.claude/skills/orchestration/references/checkpoints.md`
   - Add CONTENT row to Checkpoint Applicability by Strategy table

5. `task-tracking/task-template.md`
   - Add CONTENT to the Type enum in the Metadata table and the comment block

## Batch Plan

### Batch 1 (nitro-systems-developer)
All 5 files — this is a pure specification/orchestration task with no code. All changes are additive and self-consistent, so one batch is appropriate.

## Key Decisions
- CONTENT pipeline: PM → [Researcher optional] → Content Writer → Style Reviewer
- Keyword triggers: "blog post", "article", "email campaign", "newsletter", "ad copy", "marketing email", "content piece", "copywriting"
- Checkpoints: Scope (Yes), Requirements (Yes), Tech Clarify (No), Architecture (No), QA Choice (Yes — style review), Blocker (Yes), Completion (Yes), Scope Change (Yes)
- CONTENT is distinct from CREATIVE — CREATIVE is design-first (UI/landing pages); CONTENT is text-first (blogs, emails)
