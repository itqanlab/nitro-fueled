# Task: Wire Provider Hub screen to real provider API


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

ProviderHubComponent (/providers) uses MOCK_PROVIDER_HUB_DATA entirely. Needs to be wired to real provider quota and config API.

## Context
- File: apps/dashboard/src/app/views/providers/provider-hub.component.ts
- Mock: MOCK_PROVIDER_HUB_DATA from provider-hub.constants.ts
- Real API: ApiService.getProviderQuota() → GET /api/providers/quota
- Settings quota tab already uses getProviderQuota() successfully

## What to do
1. Replace MOCK_PROVIDER_HUB_DATA with ApiService.getProviderQuota() call
2. Map quota API response to budget tracking and provider card display
3. Wire model toggle (enable/disable model per provider) — add backend endpoint if needed
4. Remove MOCK_PROVIDER_HUB_DATA and provider-hub.constants.ts import
5. Handle loading and error states

## Acceptance Criteria
- Provider cards show real quota data
- Budget bar reflects real usage vs limit
- Model toggles persist (or show not-yet-implemented if no backend support)
- MOCK_PROVIDER_HUB_DATA removed

## Dependencies

- TASK_2026_298

## Acceptance Criteria

- [ ] Provider cards use real quota API data
- [ ] Budget bar driven by real data
- [ ] MOCK_PROVIDER_HUB_DATA removed
- [ ] Loading/error states handled

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/providers/provider-hub.component.ts
- apps/dashboard/src/app/services/api.service.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Independent. Can run in parallel with TASK_2026_301 (models) and TASK_2026_303 (MCP).
