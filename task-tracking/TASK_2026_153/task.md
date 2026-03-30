# Task: Enforce Minimal Supervisor Output — Log to File, Not Conversation

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

The supervisor prints verbose output to the conversation at every phase — wave tables, queue summaries, provider notes, explanations — consuming context that belongs to workers, not the supervisor. The supervisor's job is to call MCP tools and write structured data to `state.md` and `log.md`. Nothing else should appear in the conversation except minimal one-line events.

Observed violations (SESSION_2026-03-30_03-40-31 / wave launch):
- Printed a full "WAVE 1 — ACTIVE" formatted table with worker rows to the conversation
- Printed a "Queue (waiting for slots)" table to the conversation
- Printed a multi-paragraph "Note on diversification" explanation to the conversation
- Printed a "Monitoring will check for…" explanation paragraph to the conversation

None of this needed to appear in the conversation. All of it should have been written to `log.md` and `state.md`.

Fix: Add a HARD RULE and a per-phase output budget to SKILL.md that draws a hard line between conversation output (one-liners only) and file output (tables, structured data, analysis, notes).

**Per-phase output budget (conversation only):**
- **Spawn**: One line per worker — `SPAWNED worker=<id> task=<task_id> provider=<provider/model>`
- **Heartbeat**: One line — `[HH:MM] monitoring — <N> active, <N> complete, <N> failed`
- **Completion**: One line — `COMPLETE task=<task_id> → IMPLEMENTED` (or FAILED/BLOCKED)
- **All structured data**: Tables, queues, state snapshots, notes, analysis → `log.md` and `state.md` only. Never printed to conversation.
- **No explanatory text**: Sentences explaining what the supervisor is about to do, what it decided, or how monitoring works are banned from conversation output. Decisions go to `log.md`.

## Dependencies

- None

## Acceptance Criteria

- [ ] SKILL.md HARD RULES gains a new rule: "NEVER print tables, queue summaries, wave headers, notes, or explanatory paragraphs to the conversation. All structured output goes to log.md and state.md. Conversation output is ONE LINE per event maximum."
- [ ] SKILL.md gains a "Per-Phase Output Budget" section defining the exact one-line format for each event type (SPAWNED, HEARTBEAT, COMPLETE, FAILED, BLOCKED) — no other conversation output is permitted.
- [ ] `parallel-mode.md` Step 5 (Spawn Workers) updated: after calling `spawn_worker`, output is `SPAWNED worker=X task=Y provider=Z` only. No wave table, no queue table, no notes printed.
- [ ] `parallel-mode.md` Step 6 (Monitor) updated: heartbeat is one line. Any analysis of worker health goes to log.md, not the conversation.
- [ ] `parallel-mode.md` Step 8 (Stop/Loop) updated: completion summary is written to log.md; conversation output is one line: `SESSION COMPLETE — N complete, N failed, N blocked`.

## References

- `.claude/skills/auto-pilot/SKILL.md` — HARD RULES section, Core Loop overview
- `.claude/skills/auto-pilot/references/parallel-mode.md` — Steps 5, 6, 8
- `task-tracking/sessions/SESSION_2026-03-30_03-40-31/log.md` — example of over-verbose spawn output

## File Scope

- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/auto-pilot/references/parallel-mode.md`

## Parallelism

⚠️ Do NOT run in parallel with TASK_2026_152 — both tasks modify the same two files (SKILL.md and parallel-mode.md). Run after TASK_2026_152 completes.

Suggested execution wave: Wave 2, after TASK_2026_152 completes.
