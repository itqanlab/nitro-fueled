# Task: /nitro-burn Command — Token and Cost Analytics

## Metadata

| Field      | Value     |
|------------|-----------|
| Type       | FEATURE   |
| Priority   | P2-Medium |
| Complexity | Medium    |
| Model      | default   |
| Testing    | skip      |

## Description

Create a `/nitro-burn` command that reads session logs and orchestration analytics files to show token and cost burn — per task, per session, and as project totals. Gives the user a fast at-a-glance view of spend without navigating log files manually.

The command should:
1. Locate session analytics files (check `.nitro/sessions/` and `task-tracking/` for analytics artifacts)
2. Aggregate token input/output and cost per task and per session
3. Display a compact summary table: session, task, model, tokens in, tokens out, cost
4. Show project totals at the bottom

If no analytics data exists yet, display a helpful message explaining where data appears after running auto-pilot.

## Dependencies

- TASK_2026_116 — commands must be renamed to nitro-* first

## Acceptance Criteria

- [ ] `/nitro-burn` command file created in `.claude/commands/nitro-burn.md`
- [ ] Command locates and reads session analytics files
- [ ] Output shows per-task and per-session token/cost breakdown
- [ ] Output shows project totals
- [ ] Graceful empty state when no analytics data exists
- [ ] Command also synced to `apps/cli/scaffold/.claude/commands/nitro-burn.md`

## References

- `.nitro/sessions/` — session analytics location (verify actual path)
- `.claude/skills/auto-pilot/SKILL.md` — where analytics are written during orchestration
- `.claude/skills/orchestration/SKILL.md` — cost tracking references

## File Scope

- `.claude/commands/nitro-burn.md` (new file)
- `apps/cli/scaffold/.claude/commands/nitro-burn.md` (new file)

## Parallelism

✅ Can run in parallel with TASK_2026_118 — no file scope overlap.

🚫 Do NOT run in parallel with TASK_2026_116 or TASK_2026_117.

Suggested wave: Wave 3, after TASK_2026_116 and TASK_2026_117.
