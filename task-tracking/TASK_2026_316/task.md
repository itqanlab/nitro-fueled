# Task: Wire SettingsService to backend API for all tabs


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

After TASK_2026_305 audit and TASK_2026_315 backend, wire SettingsService to persist to real API instead of localStorage/memory.

## Tabs to fix
1. API Keys — wire to GET/POST/PATCH/DELETE /api/settings/api-keys
2. Launchers — wire to GET/POST/PATCH /api/settings/launchers
3. Subscriptions — wire to GET/POST/DELETE /api/settings/subscriptions
4. Mapping — wire matrix save to GET/PUT /api/settings/mapping

## Acceptance Criteria
- All settings tabs load data from backend on init
- All mutations persist to backend
- Settings survive page refresh

## Dependencies

- TASK_2026_305
- TASK_2026_315

## Acceptance Criteria

- [ ] SettingsService loads all data from backend on init
- [ ] API Keys CRUD calls backend
- [ ] Launchers CRUD calls backend
- [ ] Mapping matrix persists to backend

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/services/settings.service.ts
- apps/dashboard/src/app/services/api.service.ts


## Parallelism

Frontend only. Depends on TASK_2026_315 backend. Can run in parallel with other frontend tasks.
