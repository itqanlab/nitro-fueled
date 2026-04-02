# Task: Supervisor Task Prioritization — Build CREATED Before Review IMPLEMENTED

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

The supervisor picks IMPLEMENTED tasks (for review) before CREATED tasks (for build), filling concurrency slots with review work instead of new builds. With `--limit 6 --concurrency 3`, 3 of 6 slots went to review-fixing old tasks, leaving only 3 for new work.

The supervisor should prioritize based on a configurable strategy:
1. **Default**: Build-first — fill slots with CREATED tasks, then use remaining slots for IMPLEMENTED review
2. **`--review-first`**: Review-first — prioritize IMPLEMENTED tasks to clear the review backlog
3. **Balanced**: Alternate — reserve at least 1 slot for builds, 1 for reviews

Currently the supervisor fetches IMPLEMENTED tasks first and claims them before looking at CREATED tasks. Reverse the priority order or make it configurable.

## Dependencies

- None

## Acceptance Criteria

- [x] Default behavior prioritizes CREATED (build) tasks over IMPLEMENTED (review) tasks
- [x] At least one concurrency slot is used for builds when CREATED tasks exist
- [x] Configurable via flag or session config
- [x] Documented in auto-pilot help

## Parallelism

✅ Can run in parallel — supervisor task selection logic only.

## References

- Auto-pilot trace showing 3/3 slots filled with review workers before any build
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`

## File Scope

- .claude/skills/auto-pilot/SKILL.md (task selection priority)
- .claude/skills/auto-pilot/references/parallel-mode.md (slot allocation logic)
- .claude/commands/nitro-auto-pilot.md (flag documentation)
