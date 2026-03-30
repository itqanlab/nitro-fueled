# Test Report - TASK_2026_163

## Summary

| Item | Value |
| --- | --- |
| Task | TASK_2026_163 |
| Scope | `packages/mcp-cortex/src/tools/task-creation.ts`, `packages/mcp-cortex/src/index.ts` |
| Status | FAIL |

## Commands Run

| Command | Result |
| --- | --- |
| `npm test` | PASS |
| `npm run build` | PASS |
| Targeted Node validation against built `dist/tools/task-creation.js` in a temporary git repo | FAIL |

## Test Cases

| Test Case | Result | Notes |
| --- | --- | --- |
| Existing `vitest` suite for `packages/mcp-cortex` | PASS | 5 files, 66 tests passed. |
| TypeScript build for `packages/mcp-cortex` | PASS | `tsc` completed without errors. |
| `handleGetNextTaskId` returns next sequential ID from disk scan | PASS | Returned `TASK_2026_003` after seeding `TASK_2026_001` and `TASK_2026_002`. |
| `handleValidateTaskSizing` rejects a Complex multi-layer task | FAIL | Returned `{ "valid": true, "violations": [] }` even though `task-tracking/sizing-rules.md` declares `Complex + multiple architectural layers` as split-required. |
| `handleCreateTask` writes `task.md` from the canonical template | FAIL | Generated markdown came from a bespoke inline template, not `task-tracking/task-template.md`. |
| `handleCreateTask` persists a DB row for a valid `FEATURE` task | PASS | Row existed in SQLite after creation. |
| `handleBulkCreateTasks` auto-wires sequential dependency when omitted | PASS | Second generated task included the first task ID in its dependencies section. |
| `handleCreateTask` supports canonical `OPS` task type end-to-end | FAIL | Tool reported success and created files, but the DB row was absent because the underlying upsert failed silently. |

## Findings

1. `validate_task_sizing` does not enforce all rules from `task-tracking/sizing-rules.md`; the Complex multi-layer rule is missing.
2. `create_task` does not use `task-tracking/task-template.md` as the source of truth for generated `task.md`.
3. `create_task` can report success after a failed DB upsert, demonstrated with canonical task type `OPS`.

## Evidence

Targeted validation output summary:

```json
[
  {
    "name": "get_next_task_id increments from disk",
    "pass": true
  },
  {
    "name": "validate_task_sizing flags complex multi-layer task",
    "pass": false,
    "actual": {
      "valid": true,
      "violations": []
    }
  },
  {
    "name": "create_task writes task from canonical template",
    "pass": false
  },
  {
    "name": "create_task inserts database row",
    "pass": true
  },
  {
    "name": "bulk_create_tasks auto-wires sequential dependency",
    "pass": true
  },
  {
    "name": "create_task supports canonical OPS task type",
    "pass": false,
    "actual": {
      "taskId": "TASK_2026_006",
      "folder": "task-tracking/TASK_2026_006",
      "status": "CREATED"
    }
  }
]
```
