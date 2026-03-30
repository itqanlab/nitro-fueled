# Task: Fix Auto-Pilot Supervisor Pre-Flight Violations

## Metadata

| Field                 | Value                  |
|-----------------------|------------------------|
| Type                  | BUGFIX                 |
| Priority              | P1-High                |
| Complexity            | Simple                 |
| Preferred Tier        | balanced               |
| Model                 | default                |
| Testing               | skip                   |
| Poll Interval         | default                |
| Health Check Interval | default                |
| Max Retries           | default                |

## Description

The auto-pilot supervisor violates its own HARD RULES during pre-flight, causing sessions to stall in PENDING state without ever spawning workers. Root cause: the session treats pre-flight as a research/planning phase instead of a strict 3-step check.

Observed violations from SESSION_2026-03-30_03-40-31:
1. **Bash loops reading task files** — used `for task in ...; do cat task.md` repeatedly. HARD RULE #1 bans this — only the Read tool or MCP cortex tools are allowed.
2. **task.md reads during pre-flight** — pre-flight must use registry columns only; task.md is JIT at spawn time. HARD RULE #2 bans this.
3. **Tangent investigations** — supervisor checked "for newer tasks" by scanning git commits, a codebase exploration HARD RULE #7 explicitly bans.
4. **Batch reference loading** — loaded `parallel-mode.md` and `worker-prompts.md` simultaneously. The load-on-demand protocol requires exactly ONE reference per trigger event.
5. **File reads instead of MCP cortex** — never called `get_tasks()` or `sync_tasks_from_files()`; went straight to Bash + file reads for task data.
6. **Hallucinated provider labels** — routing plan used labels like "GLM/Cloudcode launcher" and "Codex" despite MCP `get_available_providers()` returning only `claude` and `glm`. HARD RULE #4 bans invented provider names.
7. **Session stalled in PENDING** — after 4m 22s of pre-flight activity, no workers were spawned. The Core Loop was never entered.

Fix: Strengthen the HARD RULES and pre-flight section in `SKILL.md` and `parallel-mode.md` to make violations harder to commit. Add an explicit pre-flight exit gate: after the 3 pre-flight steps complete, the supervisor MUST immediately call `spawn_worker` (or log that all tasks are blocked/limit reached) before performing any further reads or analysis.

## Dependencies

- None

## Acceptance Criteria

- [ ] SKILL.md HARD RULES section updated: Rule #1 includes explicit examples of banned Bash patterns (for loops, cat, head, tail on task files); Rule #2 references "pre-flight reads registry columns ONLY — no task.md reads under any circumstance"; Rule #7 adds "checking for newer tasks via git log" as a named banned tangent.
- [ ] Load-on-demand protocol in SKILL.md updated: add explicit rule "NEVER batch-load two references in one round — one trigger, one file" with the current batch-load as a named violation example.
- [ ] Pre-flight section in `parallel-mode.md` (or SKILL.md) gains an explicit exit gate: after all pre-flight checks pass, the next action MUST be either (a) call `spawn_worker`, (b) log "all tasks blocked", or (c) log "--limit reached" — no further reads or analysis are permitted before the first spawn.
- [ ] HARD RULE #4 updated: add explicit examples of banned hallucinated provider labels (Cloudcode, Codex, OpenCode, Ollama) with a clarification that routing labels in state.md MUST use provider IDs returned verbatim from `get_available_providers()`.
- [ ] Data Access Rules table in SKILL.md updated: add a row explicitly banning `npx nitro-fueled status` and Bash task file reads even during pre-flight (current table only bans them "in the loop").

## References

- `.claude/skills/auto-pilot/SKILL.md` — HARD RULES, Data Access Rules, Load-on-Demand Protocol
- `.claude/skills/auto-pilot/references/parallel-mode.md` — Core Loop Steps 1-4, pre-flight exit gate
- `task-tracking/sessions/SESSION_2026-03-30_03-40-31/log.md` — observed violation log
- `task-tracking/sessions/SESSION_2026-03-30_03-40-31/state.md` — Loop Status: PENDING, no workers spawned

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/auto-pilot/references/parallel-mode.md`

## Parallelism

✅ Can run in parallel — no CREATED task touches `.claude/skills/auto-pilot/`. Safe to run in any wave.
