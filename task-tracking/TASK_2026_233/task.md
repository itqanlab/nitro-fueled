# Task: Codex Launcher Adapter

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Build the second launcher adapter for OpenAI Codex. This proves the launcher abstraction works with a non-Claude tool. Codex can run parallel tasks, has skill-like capabilities, and returns structured output — making it a good second adapter.

**Adapter implementation:**

1. `spawn()` — invoke Codex CLI or API to start a task execution. Map WorkerSpawnConfig fields to Codex-specific parameters (model, prompt, working directory, allowed tools).

2. `getHealth()` — check Codex task status. Map to normalized health states:
   - running -> healthy
   - queued -> starting
   - completed -> finished
   - failed -> failed
   - timeout -> stuck

3. `kill()` — cancel a running Codex task.

4. `getOutput()` — collect Codex task results: files changed, output text, exit status.

**Research required:** Investigate Codex CLI/API interface before implementation. The adapter design depends on how Codex exposes its task execution interface (CLI commands, REST API, SDK).

## Dependencies

- TASK_2026_220 — Launcher Interface Definition
- TASK_2026_221 — Claude Code Adapter (reference implementation)

## Acceptance Criteria

- [ ] CodexAdapter class implements LauncherAdapter interface
- [ ] Can spawn a Codex worker with a prompt and config
- [ ] Health monitoring maps Codex states to normalized states
- [ ] Output collection returns structured WorkerOutput
- [ ] At least one real task completed end-to-end via Codex adapter

## References

- Launcher interface: TASK_2026_220
- Claude adapter (reference): TASK_2026_221
- Codex documentation: research during implementation

## File Scope

- `packages/mcp-cortex/src/launchers/codex.adapter.ts` (new)
- `packages/mcp-cortex/src/launchers/index.ts` (modified — register adapter)

## Parallelism

Can run in parallel — new file, no conflicts. Depends on TASK_2026_220.
