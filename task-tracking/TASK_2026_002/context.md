# Task Context - TASK_2026_002

## User Request

Build the auto-pilot skill/command - the core loop that reads registry + task folders, builds dependency graph, finds unblocked tasks, generates orchestration prompts, spawns workers via MCP session-orchestrator, monitors progress, and loops.

## Task Type

FEATURE

## Complexity Assessment

Medium

## Strategy Selected

FEATURE — PM -> Architect -> Team-Leader -> QA

## Conversation Summary

- This is priority item #3 on the development roadmap (CLAUDE.md)
- Items 1 (genericize .claude/) and 2 (task template system) are COMPLETE
- The auto-pilot loop is described in `docs/claude-orchestrate-package-design.md` (lines 98-113)
- The task-template-guide.md already documents the auto-pilot integration (how task.md fields feed into auto-pilot decisions)
- MCP session-orchestrator dependency lives at `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Key deliverables: auto-pilot skill (.claude/skills/auto-pilot/) and command (.claude/commands/auto-pilot.md)

## Related Tasks

- TASK_2026_001: Task template system (COMPLETE) — auto-pilot depends on task.md structure defined here

## Created

2026-03-23
