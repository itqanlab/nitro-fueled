# Implementation Plan — TASK_2026_132

## Overview

This plan addresses three CRITICAL/SERIOUS findings deferred from TASK_2026_109 (API Contract Layer):
1. Missing DTO validation decorators on `TaskIdParamDto` (CRITICAL - path traversal risk)
2. Runtime dependencies in devDependencies (class-validator, class-transformer)
3. `analytics.dto.ts` exceeds 200-line limit (288 lines)

---

## Phase 1: DTO Validation & ValidationPipe Registration

### 1.1 TaskIdParamDto Validation Decorators

**File**: `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts`

**Changes**:
- Import decorators from `class-validator`: `IsString`, `Matches`
- Add `@IsString()` decorator to `id` field
- Add `@Matches(/^TASK_\d{4}_\d{3}$/)` decorator to `id` field
- Update `@ApiModelProperty` to remove redundant `pattern` (validator handles this)

**Rationale**:
- `@IsString()` ensures type safety at runtime
- `@Matches()` enforces exact format matching, preventing path traversal attacks
- This is the CRITICAL security finding from TASK_2026_109

**Implementation**:
```typescript
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TaskIdParamDto {
  @IsString()
  @Matches(/^TASK_\d{4}_\d{3}$/)
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID in format TASK_YYYY_NNN',
  })
  public readonly id!: string;
}
```

---

### 1.2 ValidationPipe Global Registration

**File**: `apps/dashboard-api/src/main.ts`

**Changes**:
- Import `ValidationPipe` from `@nestjs/common`
- Register `ValidationPipe` globally with options: `{ whitelist: true, forbidNonWhitelisted: true }`
- Place registration after app creation, before versioning

**Rationale**:
- `whitelist: true` strips properties without decorators (strict DTO mode)
- `forbidNonWhitelisted: true` rejects requests with unknown properties (400 Bad Request)
- This ensures all DTOs are validated globally, not just those with explicit `@UsePipes()`
- Required for `class-validator` decorators to be effective

**Implementation**:
```typescript
import { ValidationPipe } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ... existing CORS setup ...

  // Global DTO validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableVersioning({ type: VersioningType.URI });
  // ... rest of bootstrap ...
}
```

---

### 1.3 Move Runtime Dependencies

**File**: `apps/dashboard-api/package.json`

**Changes**:
- Move `class-validator` from `devDependencies` to `dependencies`
- Move `class-transformer` from `devDependencies` to `dependencies`

**Rationale**:
- These packages are required at runtime by `ValidationPipe`
- NestJS decorators from these packages execute at runtime
- Production builds prune devDependencies, which would break validation

**Implementation**:
```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    // ... other deps ...
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^11.1.17",
    // ... other dev deps ... (class-validator/class-transformer removed)
  }
}
```

---

## Phase 2: DTO File Split

### 2.1 Analyze Current Structure

**Current File**: `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` (288 lines)

**DTOs in file**:
1. `SessionAnalyticsDto` - Session analytics summary
2. `SessionCostPointDto` - Cost data point for a single session
3. `EfficiencyPointDto` - Efficiency metrics for a single session
4. `ModelUsagePointDto` - Model usage statistics across all sessions
5. `SessionComparisonRowDto` - Session comparison row for tabular view
6. `AnalyticsCostDataDto` - Cost analytics aggregating all sessions
7. `AnalyticsEfficiencyDataDto` - Efficiency analytics aggregating all sessions
8. `AnalyticsModelsDataDto` - Model usage analytics aggregating usage
9. `AnalyticsSessionsDataDto` - Session comparison analytics data

---

### 2.2 Proposed Split Structure

Create subdirectory: `apps/dashboard-api/src/app/dtos/responses/analytics/`

**File 1: `session.dto.ts`** (~100 lines)
- `SessionAnalyticsDto` - Session summary data
- `SessionComparisonRowDto` - Session comparison row

**File 2: `cost.dto.ts`** (~70 lines)
- `SessionCostPointDto` - Individual session cost point
- `AnalyticsCostDataDto` - Aggregated cost analytics

**File 3: `efficiency.dto.ts`** (~70 lines)
- `EfficiencyPointDto` - Individual session efficiency point
- `AnalyticsEfficiencyDataDto` - Aggregated efficiency analytics

**File 4: `models.dto.ts`** (~70 lines)
- `ModelUsagePointDto` - Individual model usage point
- `AnalyticsModelsDataDto` - Aggregated model usage analytics

**Rationale**:
- Group by domain concern: session, cost, efficiency, models
- Each file stays under 150 lines (well under 200-line limit)
- Logical co-location of related DTOs
- Improves discoverability and maintainability

---

### 2.3 Barrel Export Updates

**File**: `apps/dashboard-api/src/app/dtos/responses/analytics/index.ts`

Create a new barrel file that re-exports all split DTOs:
```typescript
export * from './session.dto';
export * from './cost.dto';
export * from './efficiency.dto';
export * from './models.dto';
```

**File**: `apps/dashboard-api/src/app/dtos/responses/index.ts`

Update barrel to import from new structure:
```typescript
// ... other DTO exports ...
export * from './analytics';
```

**Rationale**:
- Maintains backward compatibility for imports
- Import paths like `from './dtos/responses/analytics.dto'` will need updating to `from './dtos/responses/analytics'`
- Barrel provides clean public API

---

### 2.4 Controller Import Updates

**Files to update** (grep for imports of analytics DTOs):
- Any controller importing from `analytics.dto.ts`
- Update to import from `analytics/index.ts` or specific sub-files

**Verification**:
- Use `grep` to find all import statements referencing analytics DTOs
- Update each to use the new barrel structure
- Verify Swagger still documents endpoints correctly

---

## Phase 3: Verification & Testing

### 3.1 Build Verification

**Steps**:
1. Run `cd apps/dashboard-api && npm run build`
2. Ensure TypeScript compilation succeeds
3. Check for any import/export errors

### 3.2 Swagger UI Regression Test

**Steps**:
1. Start server: `cd apps/dashboard-api && npm run start:dev`
2. Navigate to `http://localhost:3000/api/docs` (or configured port)
3. Verify all analytics endpoints are documented
4. Verify request/response schemas are correct
5. Verify TaskIdParamDto validation is documented

**Checklist**:
- [ ] All analytics endpoints visible
- [ ] Request schemas show correct DTOs
- [ ] Response schemas show correct DTOs
- [ ] TaskIdParamDto shows validation constraints
- [ ] No "Could not resolve reference" errors

### 3.3 Runtime Validation Test

**Manual Test Cases**:
1. Valid task ID: `GET /api/v1/tasks/TASK_2026_001` → should succeed
2. Invalid format: `GET /api/v1/tasks/TASK_2026_1` → should return 400 Bad Request
3. Path traversal: `GET /api/v1/tasks/TASK_2026_001/../etc/passwd` → should return 400
4. Extra property: `GET /api/v1/tasks/TASK_2026_001?extra=foo` (if query params) → should return 400

---

## Implementation Order

1. **Phase 1.3** first (move dependencies) - no code changes, enables rest
2. **Phase 1.1** second (TaskIdParamDto) - CRITICAL security fix
3. **Phase 1.2** third (ValidationPipe) - enables decorators to work
4. **Phase 2.2** fourth (create split files) - file structure
5. **Phase 2.3** fifth (barrel exports) - maintain imports
6. **Phase 2.4** sixth (controller updates) - update imports
7. **Phase 3** seventh (verification) - build and test

---

## Anti-Patterns Reviewed

From `.claude/anti-patterns.md` and `.claude/review-lessons/`:
- ✅ Input Validation: Validate at system boundaries (Phase 1.1, 1.2)
- ✅ Type Safety: Use typed decorators, not casts (Phase 1.1)
- ✅ Code Size: Split files under 300 lines (Phase 2)
- ✅ NestJS Conventions: Use ValidationPipe for all endpoints (Phase 1.2)

---

## Decisions & Rationale

1. **Why strict DTO mode (whitelist/forbidNonWhitelisted)?**
   - Prevents mass assignment attacks
   - Rejects malformed requests early with clear 400 errors
   - Aligns with security best practices

2. **Why this specific split (4 files vs 3 or 5)?**
   - 9 DTOs across 4 domains → 2-3 DTOs per file (manageable)
   - Each domain is a cohesive concern (cost, efficiency, etc.)
   - Keeps all files under 150 lines
   - Alternative: 9 separate files would be too granular

3. **Why move dependencies before adding ValidationPipe?**
   - Build fails if ValidationPipe is registered but deps not in dependencies
   - Ensures subsequent steps have runtime dependencies available

---

## Known Risks

1. **Import breaking**: Any external code importing from `analytics.dto.ts` will break
   - Mitigation: Use `grep` to find all import statements
   - Migration path: Update imports to use new barrel

2. **Swagger schema regeneration**: Split may change schema generation order
   - Mitigation: Verify all endpoints still documented correctly
   - Manual verification step included in Phase 3

3. **ValidationPipe mode changes**: Existing clients sending extra fields will get 400
   - This is intentional (security improvement)
   - Document as breaking change in API if external consumers exist (internal API currently)

---

## Rollback Plan

If issues arise after deployment:
1. Revert package.json deps to devDependencies
2. Remove ValidationPipe from main.ts
3. Delete `analytics/` subdirectory
4. Restore original `analytics.dto.ts`
5. Revert TaskIdParamDto decorators
6. `npm run build` to verify restore