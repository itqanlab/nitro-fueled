# Handoff — TASK_2026_156

## Files Changed
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (new, mock request/response contracts and in-memory session shape)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (new, mock start/stop/status lifecycle)
- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (new, validated REST endpoints)
- apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts (new, NestJS module wiring)
- apps/dashboard-api/src/app/app.module.ts (modified, registers auto-pilot module)
- apps/dashboard/src/app/models/api.types.ts (modified, adds auto-pilot API contracts)
- apps/dashboard/src/app/services/api.service.ts (modified, adds auto-pilot client methods)
- apps/dashboard/src/app/views/project/project.component.ts (modified, start flow + polling state machine)
- apps/dashboard/src/app/views/project/project.component.html (modified, starting/running UI states)
- apps/dashboard/src/app/views/project/project.component.scss (modified, auto-pilot status note styles)
- task-tracking/TASK_2026_156/task.md (modified, populated file scope)
- task-tracking/TASK_2026_156/tasks.md (new, batch/task breakdown)

## Commits
- ee52c6f: feat(dashboard): add mock auto-pilot start flow for TASK_2026_156

## Decisions
- Kept the backend mocked with an in-memory session map so the UI flow can be wired without touching real cortex or CLI spawning.
- Used polling-driven status promotion (`starting` to `running`) in the project page to match the acceptance criteria with minimal new UI.
- Added explicit request validation in the NestJS controller so mock endpoints still enforce safe task and session id inputs.

## Known Risks
- Mock auto-pilot sessions are process-local and reset on API restart; persistence and real worker control are still deferred.
- Workspace builds currently fail on unrelated pre-existing TypeScript errors in `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts` and `apps/dashboard/src/app/views/new-task/new-task.component.ts`.
