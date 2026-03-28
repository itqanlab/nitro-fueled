# Task: Remove OpenAI/OpenCode Provider Support (Temporary)

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Medium      |
| Model      | default     |
| Testing    | skip        |

## Description

Temporarily remove all OpenAI/OpenCode provider support from the codebase. The system will operate with **two providers only: Claude and GLM**. OpenAI support will be re-added in a future task.

### What to Remove

1. **Auto-pilot SKILL.md** — Remove `opencode` from the provider routing table. Remove OpenAI model references (`openai/gpt-4.1-mini`). Update all routing rules to use only `claude` and `glm`.
2. **CLI config command** (`apps/cli/src/commands/config.ts`) — Remove OpenCode provider configuration options.
3. **Session orchestrator** (`apps/session-orchestrator/src/tools/spawn-worker.ts`, `src/index.ts`) — Remove OpenCode provider handling from worker spawn logic.
4. **Worker-core** (`libs/worker-core/src/index.ts`) — Remove OpenCode provider references.
5. **Dashboard mock data** (`apps/dashboard/src/app/services/mock-data.constants.ts`) — Remove OpenAI provider entries from mock data. Keep only Claude and GLM.
6. **Review lessons** — Leave as-is (historical context, not active code).
7. **Completed task artifacts** (reviews, completion reports) — Leave as-is (historical records).

### What NOT to Remove

- Historical task artifacts (reviews, reports) — these are records, not active code
- Review lessons — these are learned patterns, provider-agnostic
- Git history — no rewriting

### Provider Routing After This Change

| Condition | Provider | Model |
|-----------|----------|-------|
| Review Worker + logic | claude | claude-opus-4-6 |
| Review Worker + style | glm | glm-4.7 |
| Review Worker + simple | glm | glm-4.7 |
| Build Worker + Complex | claude | claude-opus-4-6 |
| Build Worker + Medium | glm | glm-5 |
| Build Worker + Simple | glm | glm-4.7 |
| Build Worker + DOCUMENTATION/RESEARCH | glm | glm-4.7 |

## Dependencies

- None

## Acceptance Criteria

- [ ] Auto-pilot SKILL.md provider routing table has no OpenAI/OpenCode references
- [ ] CLI config command does not offer OpenCode provider options
- [ ] Session orchestrator spawn logic handles only claude and glm
- [ ] Worker-core has no OpenCode references
- [ ] Dashboard mock data shows only Claude and GLM providers
- [ ] System runs correctly with two providers only
- [ ] No broken references or dead code paths from removal

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- CLI config: `apps/cli/src/commands/config.ts`
- Session orchestrator: `apps/session-orchestrator/src/`
- Worker-core: `libs/worker-core/src/`
- Dashboard mock data: `apps/dashboard/src/app/services/mock-data.constants.ts`

## File Scope

- .claude/skills/auto-pilot/SKILL.md
- apps/cli/src/commands/config.ts
- apps/session-orchestrator/src/tools/spawn-worker.ts
- apps/session-orchestrator/src/index.ts
- libs/worker-core/src/index.ts
- apps/dashboard/src/app/services/mock-data.constants.ts

## Parallelism

- 🚫 Do NOT run in parallel with TASK_2026_099, TASK_2026_100 — overlapping auto-pilot SKILL.md
- Suggested execution wave: Wave 1
