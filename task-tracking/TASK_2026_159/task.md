# Task: New Task Page — Single Textarea Task Creator

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Redesign the existing `/new-task` page to be a simple, single-textarea task creation interface. The user writes everything they want in one text area (free-form natural language description), and the backend runs the task creator logic to parse, validate, size-check, auto-split if needed, and create the task files — mirroring what `/nitro-create-task` does in the CLI.

**What to build:**

1. **Simplified UI** — Replace the current new-task form with a single large textarea and a "Create Task" button. The textarea is the only required input — the user describes what they want in natural language.

2. **Optional overrides** — Collapsible "Advanced" section below the textarea with optional fields: Type, Priority, Complexity, Model, Dependencies. These default to auto-detect/defaults if not set.

3. **Backend endpoint** — `POST /api/tasks/create` in dashboard-api:
   - Accepts `{ description: string, overrides?: { type?, priority?, complexity?, model?, dependencies? } }`
   - Runs task creator logic: determine next ID, parse description, sizing validation, auto-split if needed
   - Returns created task(s): `{ tasks: [{ taskId, title, status, folder }], autoSplit?: boolean }`
   - For now: mock the creation, return fake task IDs

4. **Creation feedback** — After submission: show success with created task ID(s). If auto-split happened, show all created tasks. Link to view in project queue. Option to create another immediately.

5. **Loading state** — Processing indicator while task is being created.

All mock for now — backend returns mock responses simulating task creation and auto-split.

## Dependencies

- None

## Acceptance Criteria

- [ ] `/new-task` page shows a single large textarea as primary input
- [ ] Collapsible "Advanced" section provides optional overrides (Type, Priority, Complexity, Model, Dependencies)
- [ ] "Create Task" button submits to `POST /api/tasks/create`
- [ ] Success state shows created task ID(s) with link to project queue
- [ ] Auto-split scenario shows multiple created tasks with explanation
- [ ] Loading spinner displays during creation

## References

- Existing new-task view: `apps/dashboard/src/app/views/new-task/`
- Existing new-task model: `apps/dashboard/src/app/models/new-task.model.ts`
- Existing new-task constants: `apps/dashboard/src/app/services/new-task.constants.ts`
- Dashboard API: `apps/dashboard-api/src/`
- Task creator skill reference: `.claude/commands/nitro-create-task.md`

## File Scope

- `apps/dashboard/src/app/views/new-task/new-task.component.ts` (modified)
- `apps/dashboard/src/app/views/new-task/new-task.component.html` (modified)
- `apps/dashboard/src/app/views/new-task/new-task.component.scss` (modified)
- `apps/dashboard-api/src/tasks/tasks.controller.ts` (new)
- `apps/dashboard-api/src/tasks/tasks.service.ts` (new)
- `apps/dashboard/src/app/services/api.service.ts` (modified — add createTask method)

## Parallelism

✅ Can run in parallel — no file scope overlap with CREATED tasks. The new-task view files are unique to this task. `api.service.ts` is a minimal addition (1 method).
