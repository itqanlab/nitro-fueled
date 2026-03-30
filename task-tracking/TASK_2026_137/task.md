# Task: Build Worker handoff artifact — structured Build-to-Review communication

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

Part 1 of 4 — Supervisor-Worker Communication Overhaul.

When a Build Worker finishes, the Review Worker currently re-discovers everything by reading code, running git diff, and exploring file changes (~50-100KB of context burn). The Build Worker already knows exactly what it did — it just doesn't write it down in a structured way.

Add a `handoff.md` artifact that the Build Worker writes as its last step before marking IMPLEMENTED. The Review Worker reads this one file (~1KB) instead of re-discovering.

**handoff.md format:**
```markdown
# Handoff — TASK_YYYY_NNN

## Files Changed
- path/to/file.ts (new, 142 lines)
- path/to/other.ts (modified, +38 -12)

## Commits
- abc123: feat(scope): description

## Decisions
- Key architectural decision and why

## Known Risks
- Areas with weak coverage or edge cases
```

**Changes needed:**
- Orchestration SKILL.md: Add handoff.md write step after dev phase completes (before IMPLEMENTED status write)
- Orchestration SKILL.md: Review Worker reads handoff.md as first step instead of running git diff exploration
- Remove `review-context.md` generation by Review Lead — handoff.md replaces it
- Update phase detection table to recognize handoff.md

**Token savings:** ~50-100KB per task (Review Worker no longer re-discovers what Build Worker did).

## Dependencies

- None (file-based, no DB dependency)

## Acceptance Criteria

- [ ] Build Worker writes `handoff.md` to task folder after dev phase, before IMPLEMENTED status
- [ ] handoff.md includes: files changed (with line counts), commit hashes, key decisions, known risks
- [ ] Review Worker reads handoff.md as first action — uses it to scope review instead of re-discovering
- [ ] review-context.md generation removed (handoff.md replaces it)
- [ ] Phase detection table updated to recognize handoff.md
- [ ] Single orchestration mode (`/orchestrate`) also writes handoff.md (same flow)

## References

- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
- Token burn analysis from conversation on 2026-03-29

## File Scope

- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/orchestration/references/task-tracking.md`
- `.claude/skills/orchestration/references/strategies.md`

## Parallelism

- Can run in parallel with TASK_2026_134-136 (different files — auto-pilot vs orchestration)
- Do NOT run in parallel with tasks touching orchestration SKILL.md
