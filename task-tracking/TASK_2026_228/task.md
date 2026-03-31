# Task: Direct Mode — Single-Task Execution Without Supervisor

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Preserve a lightweight "direct mode" for executing a single task without running the full supervisor (either session or server). This is for quick, simple use cases where the overhead of a supervisor is unnecessary.

**How it works:**

```bash
npx @itqanlab/nitro-fueled run TASK_2026_220 --direct
```

Or from Claude session:
```
/nitro-orchestrate TASK_2026_220
```

Direct mode:
1. Reads task from DB via MCP
2. Spawns a single worker using the launcher adapter
3. Waits for completion
4. Collects output
5. Updates task state in DB
6. Done — no queue management, no health monitoring loop

**This is the current `/nitro-orchestrate` behavior** — we're just ensuring it continues to work alongside the new supervisor modes.

## Dependencies

- TASK_2026_221 — Claude Code Launcher Adapter (uses adapter for spawning)

## Acceptance Criteria

- [ ] Single-task execution works via CLI `--direct` flag
- [ ] Single-task execution works via `/nitro-orchestrate` in Claude session
- [ ] Uses launcher adapter interface (not hardcoded Claude spawning)
- [ ] Task data read from DB via MCP
- [ ] No supervisor process required

## References

- Current orchestration: `.claude/skills/orchestration/SKILL.md`
- CLI run command: `apps/cli/src/commands/run.ts`

## File Scope

- `apps/cli/src/commands/run.ts` (modified — add --direct flag)
- `.claude/skills/orchestration/SKILL.md` (minor update)

## Parallelism

Can run in parallel — minimal file scope, no overlap with other CREATED tasks.
