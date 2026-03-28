# Out-of-Scope Findings — TASK_2026_094

## Skipped Minor Findings

### Extract `type: 'text' as const` helper (Style finding)
- **Source**: review-code-style.md
- **Reason**: Applying this fix requires touching 8+ existing `server.tool(...)` handlers throughout `apps/session-orchestrator/src/index.ts` that were written before TASK_2026_094. These pre-existing handlers are outside the change set introduced by this task. Refactoring them all would go well beyond the task's scope and risks introducing regressions in tested handlers. Recommend a dedicated cleanup task (e.g., `chore(orchestrator): extract textContent helper and reorganize tool handlers`).
- **Status**: Deferred to follow-on cleanup task

### index.ts exceeds 200-line service file size limit (Style finding)
- **Source**: review-code-style.md
- **Reason**: The 259-line count is a pre-existing condition — `index.ts` was already over limit before this task added the `emit_event` handler. The recommendation to extract tool handlers to `tools/emit-event.ts` etc. is valid but would require moving all 8 handlers, each a non-trivial refactor. Flagged for a follow-on task.
- **Status**: Deferred to follow-on cleanup task
