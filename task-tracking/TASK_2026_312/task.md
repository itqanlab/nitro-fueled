# Task: Audit and fix Analytics screens


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Analytics screens (/analytics, /analytics/model-performance) are listed as real API but have not been fully audited. Need to verify all tabs work and remove any mock/fallback data.

## What to do
1. Read apps/dashboard/src/app/views/analytics/ (all files)
2. Verify cost tab: getAnalyticsCost()
3. Verify efficiency tab: getAnalyticsEfficiency()
4. Verify models tab: getAnalyticsModels()
5. Verify sessions tab: getAnalyticsSessions()
6. Read ModelPerfAnalyticsComponent — verify wiring
7. Remove any mock or fallback data

## Acceptance Criteria
- All analytics tabs use real API
- No mock or fallback data in production paths
- Charts render with real data

## Dependencies

- TASK_2026_311

## Acceptance Criteria

- [ ] Cost tab uses real API
- [ ] Efficiency tab uses real API
- [ ] Models tab uses real API
- [ ] Sessions tab uses real API
- [ ] No mock fallback data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/analytics/


## Parallelism

Independent. Can run in parallel with TASK_2026_313 (telemetry).
