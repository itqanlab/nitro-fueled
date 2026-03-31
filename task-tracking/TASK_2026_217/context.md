# Context — TASK_2026_217

## User Intent
Build the frontend Analytics page at /analytics/model-performance with heatmap matrix, per-launcher metrics, and routing recommendation cards.

## Strategy
FEATURE — skip PM — direct implementation. Depends on TASK_2026_216 (COMPLETE).

## Codebase Observations
- Angular 19 + NG-ZORRO dashboard; all components are standalone
- Existing model-performance view at views/model-performance/ uses old /cortex/analytics route
- New analytics endpoints (TASK_2026_216): /api/analytics/model-performance, /api/analytics/launchers, /api/analytics/routing-recommendations
- ApiService pattern: inject HttpClient, private readonly base = apiUrl/api
- Route pattern: loadComponent with lazy imports
- Sidebar uses MOCK_SIDEBAR_SECTIONS from mock-data.constants.ts
- Need to add GET /api/analytics/launchers backend endpoint (currently only per-launcher)
- New types to add to api.types.ts: AnalyticsModelPerformanceRow, LauncherMetrics, RoutingRecommendation (and response wrappers)
