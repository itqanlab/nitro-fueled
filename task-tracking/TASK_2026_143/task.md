# Task: Agent helper MCP tools — context, lessons, commit, and progress tools

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | FEATURE              |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Part 2 of 2 — Unified Cortex MCP Server.

Add agent-facing MCP tools to nitro-cortex that reduce token burn for agents during orchestration. These tools return structured, minimal data instead of forcing agents to read entire files.

**New MCP tools:**

1. **`get_task_context(task_id)`** — Returns task metadata + plan summary + file scope in one structured response (~500 bytes vs agents reading task.md + plan.md = ~30KB)

2. **`get_review_lessons(file_types[])`** — Returns only review lessons relevant to the specified file types (e.g., ["ts", "md"]) instead of agents reading the full review-lessons files (~15KB → ~2KB filtered)

3. **`stage_and_commit(files[], message, task_id, agent, phase)`** — Stages files and commits with traceability footer auto-populated from cortex session/task data. Agents currently build the 11-field footer manually every commit.

4. **`get_recent_changes(task_id)`** — Returns files changed in commits for this task (via git log --grep). Agents currently run git log + git diff manually.

5. **`report_progress(task_id, phase, status, details?)`** — Updates task progress in DB. Supervisor gets real-time visibility without polling.

6. **`get_codebase_patterns(pattern_type, limit?)`** — Returns 2-3 example files matching a pattern (e.g., "service", "component", "repository"). Agents currently glob + read 5-10 files to find patterns.

**CLI mirrors for important tools:**
- `npx nitro-fueled status` — already exists (queries DB when available)
- `npx nitro-fueled burn` — TASK_2026_119 (token analytics)
- `npx nitro-fueled db:rebuild` — TASK_2026_141

**MCP-only tools (no CLI equivalent needed):**
- get_task_context, get_review_lessons, stage_and_commit, get_recent_changes, report_progress, get_codebase_patterns — these are agent tools, humans don't need CLI for them.

## Dependencies

- TASK_2026_142 — cortex must be the unified MCP server first

## Acceptance Criteria

- [ ] `get_task_context` returns structured task metadata + plan summary + file scope
- [ ] `get_review_lessons` filters by file type, returns only relevant lessons
- [ ] `stage_and_commit` auto-populates traceability footer from cortex data
- [ ] `get_recent_changes` returns files changed for a specific task
- [ ] `report_progress` updates task progress in DB
- [ ] `get_codebase_patterns` returns example files matching a pattern
- [ ] All tools return structured JSON (not raw text)
- [ ] All tools handle errors gracefully with structured error responses

## References

- nitro-cortex: `libs/nitro-cortex/`
- Agent definitions: `.claude/agents/` (consumers of these tools)
- Architecture doc: `docs/supervisor-worker-architecture-v2.md`

## File Scope

- `libs/nitro-cortex/src/tools/` (new tool files)
- `libs/nitro-cortex/src/index.ts` (register tools)

## Parallelism

- Do NOT run in parallel with TASK_2026_142 (same cortex files)
- Can run in parallel with skill-only tasks (134-137)
