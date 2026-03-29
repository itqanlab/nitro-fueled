# Task: Event-driven supervisor loop — cache registry and plan, refresh on events only

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

The supervisor's core loop currently re-reads registry.md, plan.md, and all status files on every 5-10 minute monitoring cycle — even when nothing has changed. This wastes ~108KB/hour of input tokens on duplicate reads.

Refactor the supervisor loop to be event-driven:

**Startup (one-time reads):**
- Read registry.md -> cache task metadata (IDs, type, priority, dependencies)
- Read plan.md "Current Focus" section -> cache guidance
- Read all status files -> cache current states
- Build dependency graph from cached data

**On subscribe_worker event (worker completes/fails):**
- Re-read ONLY the changed task's status file (1 word, ~10 bytes)
- Update the single node in the cached dependency graph
- Decide next action (spawn next worker, retry, etc.)
- Do NOT re-read registry.md or plan.md

**On timer (every 5 min — health checks only):**
- Call get_worker_activity for each active worker
- Check health (stuck detection, compaction warning)
- Do NOT re-read registry, plan, or status files

**Plan.md refresh — only on explicit signal:**
- Only re-read plan.md if the Planner writes a REPRIORITIZE action
- Or on explicit `/auto-pilot --reprioritize` command

**Registry refresh — only on new task creation:**
- Only re-read registry.md if a new task folder appears (detected via file watch or manual trigger)

## Dependencies

- TASK_2026_134 — SKILL.md must be split into references first so this change goes into the right reference file (parallel-mode.md)

## Acceptance Criteria

- [ ] Registry.md read once at startup, cached in-memory (state.md)
- [ ] Plan.md "Current Focus" read once at startup, cached
- [ ] Status files read once at startup, cached; individual files re-read only on subscribe_worker events
- [ ] Dependency graph updated incrementally (single node) on completion events, not rebuilt from scratch
- [ ] Timer-based monitoring cycle does NOT re-read registry, plan, or status files
- [ ] Plan.md only re-read on REPRIORITIZE signal or --reprioritize flag
- [ ] All cached state survives compaction via state.md persistence
- [ ] No behavioral changes — same spawn decisions, same health checks, same retry logic

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- MCP subscribe_worker: `docs/mcp-session-orchestrator-design.md`
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (or `references/parallel-mode.md` after 134)

## Parallelism

- Do NOT run in parallel with TASK_2026_134 (same file scope: auto-pilot skill files)
- Do NOT run in parallel with TASK_2026_133 (same file scope)
- Can run in parallel with all other CREATED tasks
