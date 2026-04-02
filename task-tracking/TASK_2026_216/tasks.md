# Development Tasks — TASK_2026_216

## Batch 1: Analytics Module — COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Create analytics DTOs

**File**: apps/dashboard-api/src/analytics/analytics.dto.ts
**Status**: COMPLETE

DTOs for all 4 endpoints: ModelPerformanceRowDto, ModelPerformanceResponseDto, LauncherMetricsDto, LauncherMetricsResponseDto, RoutingRecommendationDto, RoutingRecommendationsResponseDto.

### Task 1.2: Create AnalyticsService

**File**: apps/dashboard-api/src/analytics/analytics.service.ts
**Status**: COMPLETE

Service wrapping CortexService with:
- `getModelPerformance(filters?)` — maps CortexModelPerformance[] to DTOs
- `getModelPerformanceById(modelId)` — per-model breakdown
- `getLauncherMetrics(launcherId?)` — groups workers by launcher, aggregates cost/tokens/completion
- `getRoutingRecommendations()` — picks best model per task type by avg_review_score

### Task 1.3: Create AnalyticsController

**File**: apps/dashboard-api/src/analytics/analytics.controller.ts
**Status**: COMPLETE

Controller with 4 GET endpoints under /api/analytics. Throws 503 when cortex DB unavailable.

### Task 1.4: Create AnalyticsModule

**File**: apps/dashboard-api/src/analytics/analytics.module.ts
**Status**: COMPLETE

NestJS module importing DashboardModule (to access exported CortexService).

### Task 1.5: Register AnalyticsModule in AppModule

**File**: apps/dashboard-api/src/app/app.module.ts
**Status**: COMPLETE

Added AnalyticsModule to imports array.
