# Development Tasks - TASK_2026_173

**Total Tasks**: 5 | **Batches**: 3 | **Status**: 0/3 complete

## Batch 1: Build Shared HTTP Guard Infrastructure - PENDING

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Create the global HTTP auth guard

**File**: apps/dashboard-api/src/app/auth/http-auth.guard.ts
**Status**: PENDING

### Task 1.2: Add any required auth barrel export or local auth module wiring

**File**: apps/dashboard-api/src/app/auth/index.ts
**Status**: PENDING

## Batch 2: Apply Guard Globally And Finalize Exemptions - PENDING

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1

### Task 2.1: Register the HTTP guard via `APP_GUARD`

**File**: apps/dashboard-api/src/app/app.module.ts
**Status**: PENDING

### Task 2.2: Finalize health/docs route behavior and any required bootstrap adjustment

**File**: apps/dashboard-api/src/main.ts
**Status**: PENDING

## Batch 3: Add Verification Coverage - PENDING

**Developer**: nitro-backend-developer
**Tasks**: 1 | **Dependencies**: Batch 2

### Task 3.1: Add Jest coverage for enabled, disabled, valid, invalid, and exempt-route behavior

**File**: apps/dashboard-api/test/app/http-auth.guard.spec.ts
**Status**: PENDING
