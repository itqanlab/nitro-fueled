# Task: nitro-cortex — Skill Integration (Part 3 of 3)

## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING                                                                   |
| Priority              | P0-Critical                                                                   |
| Complexity            | Complex                                                                       |
| Model                 | claude-opus-4-6                                                               |
| Testing               | skip                                                                          |
| Poll Interval         | default                                                                       |
| Health Check Interval | default                                                                       |
| Max Retries           | 2                                                                             |

## Description

Part 3 of 3 — original request: nitro-cortex MCP server, the shared intelligence layer that gives agents queryable tools for task state, session coordination, and worker management instead of reading markdown files.

Migrate auto-pilot and orchestration skills to use `nitro-cortex` tools instead of reading and writing markdown files. This is the payoff phase — agents stop loading large files into context and query exactly what they need.

**Auto-pilot SKILL.md changes:**
- Step 2 (Read Registry): replace reading `registry.md` + all `status` files → single `get_tasks()` call
- Step 3 (Dependency graph): replace manual parsing → `get_tasks(unblocked=true)` returns pre-resolved list
- Step 3d (Cross-session exclusion): remove entirely — `claim_task()` is atomic, polling not needed
- Step 4 (Order queue): replace queue-building logic → `get_next_wave(session_id, slots)` returns sorted ready tasks
- Step 5 (Spawn): add `claim_task()` before `spawn_worker()` — skip if already claimed
- Step 6 (Monitor): replace reading `state.md` → `get_session()` + `list_workers()`
- Step 7 (Completion): replace writing status files → `update_task()` + `release_task()`
- State persistence: replace writing `state.md` → `update_session()` — survives compaction via DB

**Orchestration SKILL.md changes:**
- Workers write IN_PROGRESS via `update_task(task_id, {status: "IN_PROGRESS"})` instead of writing status file
- Workers write IMPLEMENTED via `update_task()` instead of file write + git commit for status
- Session log writes supplemented by `update_session()` for structured state

**CLI init update:**
- `packages/cli/src/commands/init.ts` — add nitro-cortex to MCP servers block in the settings template
- `packages/cli/scaffold/.claude/settings.json` — add nitro-cortex server config so every new project gets it

## Dependencies

- TASK_2026_121
- TASK_2026_107
- TASK_2026_112

## Acceptance Criteria

- [ ] Auto-pilot core loop makes zero direct `registry.md` or `status` file reads for task state
- [ ] `get_next_wave()` replaces Steps 2–4 of the supervisor loop
- [ ] Step 3d removed from SKILL.md — cross-session safety handled by `claim_task()` atomicity
- [ ] Supervisor state survives compaction via `get_session()` — no `state.md` read needed
- [ ] Build Workers write status transitions via `update_task()` not file writes
- [ ] CLI `init` configures nitro-cortex in the generated `.claude/settings.json`
- [ ] End-to-end auto-pilot session runs cleanly using nitro-cortex tools

## References

- TASK_2026_120, TASK_2026_121 — nitro-cortex tools
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`
- `packages/cli/src/commands/init.ts`

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`
- `packages/cli/src/commands/init.ts`
- `packages/cli/scaffold/.claude/settings.json`

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_120, TASK_2026_121 — depends on both.
🚫 Do NOT run in parallel with TASK_2026_107, TASK_2026_112 — all touch the same skill files.
Wave 3: after TASK_2026_121 AND TASK_2026_107 AND TASK_2026_112 all complete.
