# Task: Add backend API endpoints for Settings persistence


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

Settings tabs (API Keys, Launchers, Subscriptions, Mapping) have no backend endpoints. Need to add them so the frontend SettingsService can persist data.

## Endpoints to add
- GET/POST/PATCH/DELETE /api/settings/api-keys
- GET/POST/PATCH /api/settings/launchers
- GET/POST/DELETE /api/settings/subscriptions
- GET/PUT /api/settings/mapping

## Acceptance Criteria
- All 4 settings categories have working CRUD endpoints
- Data persists across server restarts
- Endpoints return correct shapes for SettingsService

## Dependencies

- TASK_2026_305

## Acceptance Criteria

- [ ] API keys CRUD endpoints implemented
- [ ] Launchers CRUD endpoints implemented
- [ ] Subscriptions endpoints implemented
- [ ] Mapping GET/PUT endpoints implemented

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Backend only. Can run in parallel with TASK_2026_316 (settings frontend).
