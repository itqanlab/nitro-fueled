# TASK_2026_216 — Model × Launcher Performance — Backend Analytics Endpoints

## Metadata
| Field | Value |
|-------|-------|
| Type | FEATURE |
| Priority | P1-High |
| Complexity | Medium |
| Status | CREATED |
| Dependencies | none |
| Created | 2026-03-30 |

## Description
Split 1/2 from TASK_2026_199. Build backend analytics endpoints: GET /api/analytics/model-performance (full matrix), GET /api/analytics/model-performance/:modelId (per-model breakdown), GET /api/analytics/launcher/:launcherId (per-launcher metrics), GET /api/analytics/routing-recommendations. Data from cortex get_model_performance, get_provider_stats, query_events, workers table. New NestJS module.

## File Scope
- apps/dashboard-api/src/analytics/analytics.controller.ts (new)
- apps/dashboard-api/src/analytics/analytics.service.ts (new)
- apps/dashboard-api/src/analytics/analytics.module.ts (new)

## Parallelism
- Can run in parallel: Yes
- Conflicts with: none
- Wave: any
