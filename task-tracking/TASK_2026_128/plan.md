# Plan — TASK_2026_128

## Architecture

Keep reusable dashboard view-model shapes in `apps/dashboard/src/app/models/` so components and stores only express state and rendering logic.

## Implementation Steps

1. Verify whether the current dashboard component still contains the inline interfaces named in the task.
2. Extract the analytics derived-row shapes into `analytics.model.ts` and tighten their literal unions.
3. Move `AgentMetadata` into `agent-editor.model.ts` and import it from the store.
4. Validate the dashboard build as far as the current worktree allows.

## Notes

- The dashboard command-center code has already evolved beyond the original `QuickAction` and `TeamGroup` references, so that part of the task is verification-only in the current tree.
- Keep the refactor limited to the task file scope.
