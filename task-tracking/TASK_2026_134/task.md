# Task: Slim down auto-pilot SKILL.md — split into core + mode-specific references

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | REFACTORING          |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

The auto-pilot SKILL.md is 192KB — it loads ~48K tokens before any work begins, consuming ~55% of Sonnet's 200K context immediately. This makes sequential mode impractical on Sonnet and wastes significant context in parallel mode's supervisor session.

Split into a slim core SKILL.md (~15KB) + mode-specific reference files loaded on demand. Only the active mode's reference gets loaded.

Core SKILL.md keeps:
- Mode table and mode detection
- Core loop: pick -> spawn -> monitor -> complete -> loop
- State.md format and session directory setup
- Concurrency rules
- Configuration table
- Registry write safety
- Active sessions file format

New reference files:
- `references/parallel-mode.md` — MCP spawning, health checks, subscribe_worker, worker prompts
- `references/sequential-mode.md` — Inline orchestration loop
- `references/evaluation-mode.md` — Benchmark flow (E1-E8, A/B, role testing)
- `references/pause-continue.md` — Pause/resume logic
- `references/cortex-integration.md` — Cortex-aware overrides
- `references/log-templates.md` — All log row formats
- `references/worker-prompts.md` — Build/Review/Fix/Completion prompt templates

## Dependencies

- TASK_2026_133 — Sequential mode must exist before we split it into its own reference

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md reduced to ~15KB (core loop + mode detection only)
- [ ] Each mode's logic extracted into its own reference file under `references/`
- [ ] SKILL.md includes "Load on demand" protocol: detect mode -> read only the matching reference
- [ ] Log templates extracted to `references/log-templates.md`
- [ ] Worker prompt templates extracted to `references/worker-prompts.md`
- [ ] All existing modes still work (parallel, sequential, single-task, dry-run, pause, continue, evaluate)
- [ ] No behavioral changes — purely structural refactor

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md` (192KB — the file being refactored)
- Orchestration skill uses same pattern: `.claude/skills/orchestration/SKILL.md` (36KB core + `references/` directory)
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/auto-pilot/references/parallel-mode.md` (new)
- `.claude/skills/auto-pilot/references/sequential-mode.md` (new)
- `.claude/skills/auto-pilot/references/evaluation-mode.md` (new)
- `.claude/skills/auto-pilot/references/pause-continue.md` (new)
- `.claude/skills/auto-pilot/references/cortex-integration.md` (new)
- `.claude/skills/auto-pilot/references/log-templates.md` (new)
- `.claude/skills/auto-pilot/references/worker-prompts.md` (new)

## Parallelism

- Do NOT run in parallel with TASK_2026_133 (same file: auto-pilot SKILL.md)
- Can run in parallel with all other CREATED tasks (no file scope overlap)
