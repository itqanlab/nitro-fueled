# Task: Extract inline constants from new-task.component.ts to new-task.constants.ts

## Metadata

| Field                 | Value        |
|-----------------------|--------------|
| Type                  | REFACTORING  |
| Priority              | P2-Medium    |
| Complexity            | Simple       |
| Preferred Tier        | light        |
| Model                 | default      |
| Testing               | skip         |

## Description

Part 1 of 2 — original request: Extract inline constants and interfaces to dedicated model/constants files in dashboard Angular app (TASK_2026_092 follow-on, finding C1).

`apps/dashboard/src/app/views/new-task/new-task.component.ts` is 168 lines, exceeding the 150-line component limit. The overrun is caused by 5 module-scope constants (STRATEGY_CARDS, WORKFLOW_STEPS, AGENT_ROLES, COST_RANGES, KEYWORD_STRATEGY_MAP) defined at lines 16–65 in the component file.

Move those 5 constants into `apps/dashboard/src/app/services/new-task.constants.ts` (already exists — it currently exports MOCK_PROVIDER_GROUPS). Update the import in `new-task.component.ts` to import the moved constants from that file instead.

After the move the component class should be well under 150 lines.

## Dependencies

- TASK_2026_092 — provides the component files to refactor

## Acceptance Criteria

- [ ] STRATEGY_CARDS, WORKFLOW_STEPS, AGENT_ROLES, COST_RANGES, KEYWORD_STRATEGY_MAP removed from new-task.component.ts and added to new-task.constants.ts
- [ ] new-task.component.ts imports the moved constants from new-task.constants.ts
- [ ] new-task.component.ts is under 150 lines after the move
- [ ] No behaviour change — component functionality is identical

## Parallelism

✅ Can run in parallel with TASK_2026_128 — no file scope overlap between the two split tasks.

## References

- apps/dashboard/src/app/views/new-task/new-task.component.ts
- apps/dashboard/src/app/services/new-task.constants.ts
- TASK_2026_092 review finding C1

## File Scope

- apps/dashboard/src/app/views/new-task/new-task.component.ts (MODIFIED — constants removed, imports updated)
- apps/dashboard/src/app/services/new-task.constants.ts (MODIFIED — 5 constants added)
