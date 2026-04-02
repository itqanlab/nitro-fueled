# Task: Add Worker Mode field and PREPPED/IMPLEMENTING statuses to template and docs

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | DOCUMENTATION  |
| Priority              | P1-High        |
| Complexity            | Simple         |
| Preferred Tier        | light          |
| Model                 | default        |
| Testing               | skip           |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |
| Worker Mode           | single         |

## Description

Update the task template and orchestration phase detection docs to support the Prep+Implement worker split architecture.

**task-template.md changes:**
- Add `Worker Mode` field to Metadata table with values `[single | split]`
- Add guidance comment explaining: `single` = current behavior (one Build Worker), `split` = Prep Worker + Implement Worker (default for Medium/Complex)

**task-tracking.md changes:**
- Add PREPPED row to phase detection table: "prep-handoff.md present, no tasks.md IN_PROGRESS | Prep complete | Spawn Implement Worker"
- Add IMPLEMENTING row: "tasks.md has IN_PROGRESS batches, prep-handoff.md present | Dev in progress (split mode) | Implement Worker running"
- Update status transition diagram: CREATED -> IN_PROGRESS -> PREPPED -> IMPLEMENTING -> IMPLEMENTED -> IN_REVIEW -> COMPLETE

## Dependencies

- None

## Acceptance Criteria

- [ ] task-template.md has Worker Mode field with single|split values and guidance comment
- [ ] Phase detection table includes PREPPED and IMPLEMENTING rows
- [ ] Status transition diagram updated with new statuses

## References

- Design discussion in this conversation
- `.claude/skills/orchestration/references/task-tracking.md`
- `task-tracking/task-template.md`

## File Scope

- `task-tracking/task-template.md`
- `.claude/skills/orchestration/references/task-tracking.md`

## Parallelism

✅ Can run in parallel with TASK_2026_207 — no file overlap
