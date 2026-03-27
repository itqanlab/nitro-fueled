# Development Tasks — TASK_2026_039

## Batch 1: Backend — Types, Parser, Store, Routes - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Add PipelineData, WorkerTree, SessionAnalytics types to event-types.ts

**File**: `packages/dashboard-service/src/events/event-types.ts`
**Status**: COMPLETE

### Task 1.2: Create session-analytics.parser.ts

**File**: `packages/dashboard-service/src/parsers/session-analytics.parser.ts`
**Status**: COMPLETE

### Task 1.3: Extend StateStore with session analytics + getTaskPipeline + getWorkerTree

**File**: `packages/dashboard-service/src/state/store.ts`
**Status**: COMPLETE

### Task 1.4: Register SessionAnalyticsParser in FileRouter

**File**: `packages/dashboard-service/src/parsers/file-router.ts`
**Status**: COMPLETE

### Task 1.5: Add /api/tasks/:id/pipeline and /api/workers/tree routes

**File**: `packages/dashboard-service/src/server/http.ts`
**Status**: COMPLETE

### Task 1.6: Export new types from index.ts

**File**: `packages/dashboard-service/src/index.ts`
**Status**: COMPLETE

## Batch 2: Frontend — Types, API client, Views, Nav - COMPLETE

**Developer**: nitro-frontend-developer

### Task 2.1: Add PipelineData, WorkerTree types to web types/index.ts

**File**: `packages/dashboard-web/src/types/index.ts`
**Status**: COMPLETE

### Task 2.2: Add getTaskPipeline and getWorkerTree to API client

**File**: `packages/dashboard-web/src/api/client.ts`
**Status**: COMPLETE

### Task 2.3: Create Pipeline view

**File**: `packages/dashboard-web/src/views/Pipeline.tsx`
**Status**: COMPLETE

### Task 2.4: Create Squad view

**File**: `packages/dashboard-web/src/views/Squad.tsx`
**Status**: COMPLETE

### Task 2.5: Register routes in App.tsx

**File**: `packages/dashboard-web/src/App.tsx`
**Status**: COMPLETE

### Task 2.6: Add Pipeline and Squad nav items to Sidebar

**File**: `packages/dashboard-web/src/components/Sidebar.tsx`
**Status**: COMPLETE
