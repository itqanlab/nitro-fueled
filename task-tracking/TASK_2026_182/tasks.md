# Development Tasks - TASK_2026_182

## Batch 1: Remove deprecated code — COMPLETE

**Developer**: nitro-systems-developer

### Task 1.1: Remove getConfigPath() from provider-config.ts

**File**: apps/cli/src/utils/provider-config.ts
**Notes**: Verified zero active callers across all source files. Removed the deprecated function and its JSDoc comment entirely.
**Status**: COMPLETE

### Task 1.2: Fix rxjs/operators deep import

**File**: apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
**Notes**: Changed `import { map } from 'rxjs/operators'` to `import { map } from 'rxjs'`. The /operators sub-path is deprecated since RxJS v6; all operators are available at the root path.
**Status**: COMPLETE

### Task 1.3: Investigate better-sqlite3 / prebuild-install upgrade

**File**: apps/cli/package.json (no change)
**Notes**: better-sqlite3@12.8.0 (latest) still depends on `prebuild-install: '^7.1.1'`. Upgrading from 11.8.2 → 12.x would not resolve the prebuild-install deprecation. Not actionable — documented in completion report.
**Status**: COMPLETE
