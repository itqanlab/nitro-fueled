# Task: Claude Code Launcher Adapter

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Extract the current hardcoded Claude Code worker spawning logic from the auto-pilot skill into the first launcher adapter implementation. This is a refactor — no behavior change. Everything should work exactly as it does today, but through the LauncherAdapter interface.

**What to extract:**
- Worker process spawning (`claude` CLI invocation with flags)
- Health signal detection (high_context, compacting, context_overflow, stuck)
- Worker kill logic
- Output collection (reading worker results)

**Map current health signals to the normalized interface:**
- `healthy` -> `healthy`
- `starting` -> `starting`
- `high_context` -> `warning`
- `context_overflow` -> `warning`
- `compacting` -> `warning`
- `stuck` -> `stuck`

The adapter should encapsulate all Claude Code CLI-specific knowledge (flags, output format, signal patterns) so the supervisor only interacts through the generic interface.

## Dependencies

- TASK_2026_220 — Launcher Interface Definition

## Acceptance Criteria

- [ ] ClaudeCodeAdapter class implements LauncherAdapter interface
- [ ] All current worker spawning logic moved into the adapter
- [ ] Health signal mapping from Claude-specific to normalized states
- [ ] Existing auto-pilot behavior unchanged (refactor only)

## References

- Launcher interface: TASK_2026_220
- Current spawning logic: `.claude/skills/auto-pilot/SKILL.md`
- Health constants: `packages/mcp-cortex/src/constants.ts`

## File Scope

- `packages/mcp-cortex/src/launchers/claude-code.adapter.ts` (new)
- `packages/mcp-cortex/src/launchers/index.ts` (new)

## Parallelism

Can run in parallel — no file scope conflicts. Depends on TASK_2026_220 completing first.
