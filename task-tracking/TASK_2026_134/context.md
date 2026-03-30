# Context — TASK_2026_134

## User Intent

Slim down the auto-pilot SKILL.md from 192KB (~3558 lines) to ~15KB by extracting mode-specific
logic into separate reference files. Only the active mode's reference gets loaded on demand.

## Current State

- `.claude/skills/auto-pilot/SKILL.md` is 192KB, 3558 lines, 48K tokens
- This consumes ~55% of Sonnet's 200K context before any work begins
- Orchestration skill uses the same pattern: 36KB core + `references/` directory
- TASK_2026_133 (Sequential Mode) is COMPLETE — sequential mode content is ready to extract

## Strategy

REFACTORING — Architect -> Team-Leader -> Developer

## Task Folder

/Volumes/SanDiskSSD/mine/nitro-fueled/task-tracking/TASK_2026_134/
