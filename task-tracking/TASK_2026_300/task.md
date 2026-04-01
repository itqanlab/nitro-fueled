# Task: Audit and fix Analytics screens (cost, efficiency, model performance)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Analytics screens (/analytics, /analytics/model-performance) were listed as using real API but have not been fully audited. Need to verify all tabs and sub-views work correctly.

## Screens
- /analytics — AnalyticsComponent (tabs: cost, efficiency, models, sessions)
- /analytics/model-performance — ModelPerfAnalyticsComponent

## What to do
1. Read AnalyticsComponent — identify all API calls and any mock data
2. Verify cost tab: getAnalyticsCost()
3. Verify efficiency tab: getAnalyticsEfficiency()
4. Verify models tab: getAnalyticsModels()
5. Verify sessions tab: getAnalyticsSessions()
6. Verify routing recommendations: getAnalyticsRoutingRecommendations()
7. Verify launchers analytics: getAnalyticsLaunchers()
8. Read ModelPerfAnalyticsComponent — verify vs ModelPerformanceComponent telemetry variant
9. Remove any mock/fallback data

## Acceptance Criteria
- All analytics tabs use real API
- No mock data in analytics screens
- Charts/tables render with real data
- Loading/error states handled

## Dependencies

- TASK_2026_299

## Acceptance Criteria

- [ ] All analytics tabs use real API
- [ ] No mock or fallback data
- [ ] Charts render correctly
- [ ] Loading/error states handled

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/analytics/
- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Independent. Can run in parallel with TASK_2026_309 (telemetry views).
