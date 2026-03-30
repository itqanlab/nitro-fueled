# Development Tasks - TASK_2026_187

**Total Tasks**: 8 | **Batches**: 3 | **Status**: 0/3 complete

## Batch 1: Backend Session History Contract - PENDING

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Add ended-session list aggregation

**File**: apps/dashboard-api/src/dashboard/sessions-history.service.ts
**Status**: PENDING

### Task 1.2: Add session-detail aggregation for tasks, workers, timeline, and log content

**File**: apps/dashboard-api/src/dashboard/sessions-history.service.ts
**Status**: PENDING

### Task 1.3: Wire `/api/sessions` and `/api/sessions/:id` to the new history contract without regressing `/api/sessions/active*`

**File**: apps/dashboard-api/src/dashboard/dashboard.controller.ts
**Status**: PENDING

## Batch 2: Frontend Contracts and Sessions List - PENDING

**Developer**: nitro-frontend-developer
**Tasks**: 3 | **Dependencies**: Batch 1

### Task 2.1: Add typed session history list/detail contracts and API client methods

**File**: apps/dashboard/src/app/models/api.types.ts
**Status**: PENDING

### Task 2.2: Implement the `/sessions` list page with pagination, summary stats, and outcome badges

**File**: apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts
**Status**: PENDING

### Task 2.3: Add the Sessions sidebar entry and route registration for the new history flow

**File**: apps/dashboard/src/app/app.routes.ts
**Status**: PENDING

## Batch 3: Session Detail Page and Polish - PENDING

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 2

### Task 3.1: Implement the `/sessions/:id` detail page with task results, timeline, workers, and session log sections

**File**: apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts
**Status**: PENDING

### Task 3.2: Finish responsive styling, loading states, and unknown-data fallbacks for sessions list/detail

**File**: apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss
**Status**: PENDING
