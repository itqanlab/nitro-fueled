# Task: Launcher Interface Definition

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | RESEARCH    |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | skip        |
| Worker Mode           | single      |

## Description

Define the abstract TypeScript interface for launcher adapters. A launcher is any AI tool that can execute work (Claude Code, Codex, Cursor, Windsurf, Aider, etc.). The interface defines the contract all adapters must implement.

**Interfaces to define:**

1. `LauncherAdapter` — main interface:
   - `spawn(config: WorkerSpawnConfig): Promise<WorkerHandle>` — start a worker process
   - `getHealth(handle: WorkerHandle): Promise<WorkerHealthStatus>` — check worker health
   - `kill(handle: WorkerHandle): Promise<void>` — terminate a worker
   - `getOutput(handle: WorkerHandle): Promise<WorkerOutput>` — collect worker results

2. `WorkerSpawnConfig` — what the supervisor sends to spawn a worker:
   - prompt, model, timeout, environment, working directory, allowed tools

3. `WorkerHealthStatus` — normalized health states:
   - healthy, starting, warning, stuck, finished, failed
   - Plus raw launcher-specific data for debugging

4. `WorkerHandle` — opaque reference to a running worker:
   - pid/process ID, launcher type, spawn time

5. `WorkerOutput` — structured result from a completed worker:
   - exit code, files changed, stdout summary, duration, cost estimate

**Deliverable:** TypeScript interface file(s) in `packages/mcp-cortex/src/launchers/` or a new shared package. No runtime implementation — just types and interfaces.

## Dependencies

- None

## Acceptance Criteria

- [ ] LauncherAdapter interface defined with spawn, getHealth, kill, getOutput methods
- [ ] All supporting types defined (WorkerSpawnConfig, WorkerHealthStatus, WorkerHandle, WorkerOutput)
- [ ] Health states are launcher-agnostic (normalized from launcher-specific signals)
- [ ] Interface is documented with JSDoc comments explaining each method's contract

## References

- Current worker spawning logic: `.claude/skills/auto-pilot/SKILL.md`
- Current health states: `packages/mcp-cortex/src/constants.ts`

## File Scope

- `packages/mcp-cortex/src/launchers/types.ts` (new)

## Parallelism

Can run in parallel — no file scope conflicts with existing CREATED tasks.
