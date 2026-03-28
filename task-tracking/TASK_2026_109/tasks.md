# Development Tasks - TASK_2026_109

**Total Tasks**: 23 | **Batches**: 6 | **Status**: 1/6 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- [Dashboard types exist at dashboard.types.ts]: Verified - 366 lines of TypeScript interfaces
- [Controller has 18 endpoints]: Verified - 18 GET endpoints in DashboardController
- [NestJS patterns used]: Verified - Standard @Controller, @Get, @Param decorators

### Risks Identified

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Response envelope breaks existing Angular clients | HIGH | Document clearly; coordinate with frontend update |
| DTOs may drift from actual service return types | MEDIUM | TypeScript compiler catches mismatches; keep in sync |

---

## Batch 1: Foundation - Dependencies and Enums COMPLETE

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Install Required Dependencies COMPLETE

**File**: apps/dashboard-api/package.json
**Spec Reference**: implementation-plan.md:636-652
**Pattern to Follow**: Standard npm dependencies

**Quality Requirements**:
- Install @nestjs/swagger as production dependency
- Install class-validator and class-transformer as dev dependencies

**Validation Notes**:
- Verify versions are compatible with NestJS 11.x

**Implementation Details**:
- Add to dependencies: `"@nestjs/swagger": "^11.0.0"`
- Add to devDependencies: `"class-validator": "^0.14.0"`, `"class-transformer": "^0.5.1"`

---

### Task 1.2: Create Task Enums DTO COMPLETE

**File**: apps/dashboard-api/src/app/dtos/enums/task.enums.ts
**Spec Reference**: implementation-plan.md:405-410, dashboard.types.ts:3-43
**Pattern to Follow**: TypeScript enum exports

**Quality Requirements**:
- All enums must match existing types exactly
- Use TypeScript const enums for performance

**Validation Notes**:
- Compare against TaskStatus, TaskType, TaskPriority, TaskComplexity in dashboard.types.ts

**Implementation Details**:
- Imports: None (pure enum definitions)
- Exports: TaskStatus, TaskType, TaskPriority, TaskComplexity
- Values: Match dashboard.types.ts exactly (CREATED, IN_PROGRESS, IMPLEMENTED, etc.)

---

### Task 1.3: Create Worker Enums DTO COMPLETE

**File**: apps/dashboard-api/src/app/dtos/enums/worker.enums.ts
**Spec Reference**: implementation-plan.md:407-408, dashboard.types.ts:25-29
**Pattern to Follow**: TypeScript enum exports

**Quality Requirements**:
- All enums must match existing types exactly

**Validation Notes**:
- Compare against WorkerType, WorkerStatus, WorkerHealth, ReviewSeverity, PipelinePhaseStatus

**Implementation Details**:
- Exports: WorkerType, WorkerStatus, WorkerHealth, ReviewSeverity, PipelinePhaseStatus
- Values: 'Build' | 'Review', 'running' | 'completed' | 'failed' | 'killed', etc.

---

### Task 1.4: Create Enums Barrel Export COMPLETE

**File**: apps/dashboard-api/src/app/dtos/enums/index.ts
**Spec Reference**: implementation-plan.md:421
**Pattern to Follow**: Standard barrel export pattern

**Quality Requirements**:
- Re-export all enums from a single entry point

**Implementation Details**:
- Export all enums from task.enums.ts and worker.enums.ts

---

**Batch 1 Verification**:

- All dependencies installed: `npm ls @nestjs/swagger class-validator class-transformer`
- Enum files exist and match existing types
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Batch 2: Foundation - Common DTOs and Versioning PENDING

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: Batch 1

### Task 2.1: Create Common DTOs (Envelope, Meta, Error) PENDING

**File**: apps/dashboard-api/src/app/dtos/common.dto.ts
**Spec Reference**: implementation-plan.md:331-375
**Pattern to Follow**: @nestjs/swagger @ApiProperty decorators

**Quality Requirements**:
- ResponseEnvelopeDto must wrap generic T
- ErrorDto must have code and message
- All properties decorated with @ApiProperty

**Implementation Details**:
- Imports: ApiProperty, ApiPropertyOptional from @nestjs/swagger
- Classes: MetaDto, ResponseEnvelopeDto<T>, ErrorDto, ErrorEnvelopeDto
- Each property needs @ApiProperty with example and description

---

### Task 2.2: Create Common DTOs Barrel Export PENDING

**File**: apps/dashboard-api/src/app/dtos/index.ts
**Spec Reference**: implementation-plan.md:403-404
**Pattern to Follow**: Standard barrel export

**Implementation Details**:
- Export all from common.dto.ts
- Export all from enums/index.ts
- Export all from responses/index.ts (will be created in Batch 3)
- Export all from requests/index.ts (will be created in Batch 3)

---

### Task 2.3: Enable API Versioning in main.ts PENDING

**File**: apps/dashboard-api/src/main.ts
**Spec Reference**: implementation-plan.md:117-131
**Pattern to Follow**: NestJS VersioningType.URI

**Quality Requirements**:
- Enable URI versioning: /api/v1/...
- Preserve existing CORS configuration

**Validation Notes**:
- All endpoints will change from /api/... to /api/v1/...
- Coordinate with frontend team

**Implementation Details**:
- Import: VersioningType from @nestjs/common
- Add: `app.enableVersioning({ type: VersioningType.URI })`
- Keep existing CORS config unchanged

---

### Task 2.4: Add Version Decorators to Controllers PENDING

**File**: apps/dashboard-api/src/dashboard/dashboard.controller.ts, apps/dashboard-api/src/app/health.controller.ts
**Spec Reference**: implementation-plan.md:136-153
**Pattern to Follow**: NestJS @Controller version option

**Quality Requirements**:
- Both controllers must use version '1'
- Existing functionality preserved

**Implementation Details**:
- DashboardController: Change `@Controller('api')` to `@Controller({ path: 'api', version: '1' })`
- HealthController: Change `@Controller()` to `@Controller({ version: '1' })`

---

**Batch 2 Verification**:

- Common DTOs exist with @ApiProperty decorators
- Versioning enabled in main.ts
- Both controllers have version decorators
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Batch 3: Response DTOs - Part 1 (Core Entities) PENDING

**Developer**: nitro-backend-developer
**Tasks**: 5 | **Dependencies**: Batch 2

### Task 3.1: Create TaskRecord and TaskDefinition DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/task-record.dto.ts
**Spec Reference**: implementation-plan.md:377-401, dashboard.types.ts:31-51
**Pattern to Follow**: @ApiProperty decorators with enum references

**Quality Requirements**:
- All properties from TaskRecord and TaskDefinition interfaces
- Enums referenced via @ApiProperty({ enum: ... })
- Readonly fields documented

**Implementation Details**:
- Imports: ApiProperty, ApiPropertyOptional from @nestjs/swagger; enums from ../enums
- Classes: TaskRecordDto, TaskDefinitionDto
- Properties: id, status, type, description, created, model, title, priority, complexity, dependencies, acceptanceCriteria, references

---

### Task 3.2: Create OrchestratorState and Related DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/orchestrator-state.dto.ts
**Spec Reference**: dashboard.types.ts:83-139
**Pattern to Follow**: Nested DTOs with @ApiProperty

**Quality Requirements**:
- All nested structures (ActiveWorker, CompletedTask, FailedTask, LogEntry) as separate classes
- OrchestratorStateDto aggregates all nested types

**Implementation Details**:
- Classes: ActiveWorkerDto, CompletedTaskDto, FailedTaskDto, LogEntryDto, TaskQueueItemDto, RetryTrackerDto, ConfigurationDto, OrchestratorStateDto
- Use @ApiProperty({ type: [Class] }) for arrays

---

### Task 3.3: Create Plan Data DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/plan.dto.ts
**Spec Reference**: dashboard.types.ts:53-81
**Pattern to Follow**: Nested DTOs with @ApiProperty

**Quality Requirements**:
- PlanPhase, PlanData with nested currentFocus and decisions

**Implementation Details**:
- Classes: PlanPhaseTaskMapDto, PlanPhaseDto, CurrentFocusDto, DecisionDto, PlanDataDto

---

### Task 3.4: Create Review and Completion Report DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/review.dto.ts, apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts
**Spec Reference**: dashboard.types.ts:141-169
**Pattern to Follow**: Nested DTOs

**Quality Requirements**:
- ReviewFinding, ReviewData, CompletionReport with nested reviewScores

**Implementation Details**:
- review.dto.ts: ReviewFindingDto, ReviewDataDto
- completion-report.dto.ts: ReviewScoreDto, CompletionReportDto

---

### Task 3.5: Create FullTaskData DTO PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/full-task.dto.ts
**Spec Reference**: dashboard.types.ts:182-187
**Pattern to Follow**: Composite DTO referencing other DTOs

**Quality Requirements**:
- References TaskDefinitionDto, TaskRecordDto, ReviewDataDto, CompletionReportDto

**Implementation Details**:
- Import related DTOs
- Class: FullTaskDataDto with nullable fields properly typed

---

**Batch 3 Verification**:

- All 5 DTO files exist with @ApiProperty decorators
- Enums properly referenced
- Nested types use correct class references
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Batch 4: Response DTOs - Part 2 (Dashboard and Analytics) PENDING

**Developer**: nitro-backend-developer
**Tasks**: 5 | **Dependencies**: Batch 3

### Task 4.1: Create Stats and Graph DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/stats.dto.ts, apps/dashboard-api/src/app/dtos/responses/graph.dto.ts
**Spec Reference**: dashboard.types.ts:189-236
**Pattern to Follow**: Record types and simple DTOs

**Quality Requirements**:
- DashboardStats with Record<string, number> types
- GraphNode, GraphEdge, GraphData DTOs

**Implementation Details**:
- stats.dto.ts: DashboardStatsDto
- graph.dto.ts: GraphNodeDto, GraphEdgeDto, GraphDataDto

---

### Task 4.2: Create Session DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/session.dto.ts
**Spec Reference**: dashboard.types.ts:202-217
**Pattern to Follow**: Nested DTOs

**Quality Requirements**:
- SessionSummary, SessionData with nullable state

**Implementation Details**:
- Classes: SessionSummaryDto, SessionDataDto
- Reference OrchestratorStateDto for state field

---

### Task 4.3: Create Worker Tree DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/worker-tree.dto.ts
**Spec Reference**: dashboard.types.ts:278-298
**Pattern to Follow**: Recursive DTO structure

**Quality Requirements**:
- WorkerTreeNode has recursive children array
- WorkerTree as container

**Implementation Details**:
- Classes: WorkerTreeNodeDto (recursive), WorkerTreeDto
- Use @ApiProperty({ type: () => [WorkerTreeNodeDto] }) for recursive reference

---

### Task 4.4: Create Analytics DTOs PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts
**Spec Reference**: dashboard.types.ts:299-363
**Pattern to Follow**: Multiple related DTOs

**Quality Requirements**:
- SessionCostPoint, EfficiencyPoint, ModelUsagePoint, SessionComparisonRow
- AnalyticsCostData, AnalyticsEfficiencyData, AnalyticsModelsData, AnalyticsSessionsData

**Implementation Details**:
- Classes: SessionAnalyticsDto, SessionCostPointDto, EfficiencyPointDto, ModelUsagePointDto, SessionComparisonRowDto
- Container classes: AnalyticsCostDataDto, AnalyticsEfficiencyDataDto, AnalyticsModelsDataDto, AnalyticsSessionsDataDto

---

### Task 4.5: Create Knowledge DTOs and Barrel Exports PENDING

**File**: apps/dashboard-api/src/app/dtos/responses/anti-patterns.dto.ts, apps/dashboard-api/src/app/dtos/responses/lessons.dto.ts, apps/dashboard-api/src/app/dtos/responses/index.ts, apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts, apps/dashboard-api/src/app/dtos/requests/index.ts
**Spec Reference**: dashboard.types.ts:171-180
**Pattern to Follow**: Simple DTOs and barrel exports

**Quality Requirements**:
- AntiPatternRule, LessonEntry DTOs
- TaskIdParamDto with validation
- All response DTOs exported from index.ts

**Implementation Details**:
- anti-patterns.dto.ts: AntiPatternRuleDto
- lessons.dto.ts: LessonEntryDto
- task-id.param.dto.ts: TaskIdParamDto with @IsString() and pattern validation
- responses/index.ts: Export all response DTOs
- requests/index.ts: Export TaskIdParamDto

---

**Batch 4 Verification**:

- All response DTO files exist
- All request param DTOs exist
- Barrel exports properly configured
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Batch 5: Swagger Integration and Response Envelope PENDING

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: Batch 4

### Task 5.1: Configure Swagger in main.ts PENDING

**File**: apps/dashboard-api/src/main.ts
**Spec Reference**: implementation-plan.md:444-482
**Pattern to Follow**: NestJS DocumentBuilder pattern

**Quality Requirements**:
- Swagger UI at /api/docs
- JSON spec at /api/docs-json
- All tags configured (health, registry, plan, state, tasks, workers, sessions, analytics, knowledge)

**Implementation Details**:
- Import: DocumentBuilder, SwaggerModule from @nestjs/swagger
- Create DocumentBuilder with title, description, version, tags
- Setup SwaggerModule at 'api/docs' endpoint
- Add customSiteTitle option

---

### Task 5.2: Create Response Envelope Interceptor PENDING

**File**: apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
**Spec Reference**: implementation-plan.md:171-209
**Pattern to Follow**: NestJS NestInterceptor pattern

**Quality Requirements**:
- Wrap all responses in { success: true, data: ..., meta: {...} }
- Include timestamp and version in meta
- Preserve response data structure

**Validation Notes**:
- RISK: Existing Angular clients will break - they must update to unwrap response.data

**Implementation Details**:
- Imports: Injectable, NestInterceptor, ExecutionContext, CallHandler from @nestjs/common; Observable from rxjs; map from rxjs/operators
- Interface: ResponseEnvelope<T>
- Class: ResponseEnvelopeInterceptor<T> implements NestInterceptor

---

### Task 5.3: Create Error Envelope Filter PENDING

**File**: apps/dashboard-api/src/app/filters/error-envelope.filter.ts
**Spec Reference**: implementation-plan.md:218-307
**Pattern to Follow**: NestJS ExceptionFilter pattern

**Quality Requirements**:
- Catch all exceptions
- Transform to { success: false, error: {...}, meta: {...} }
- Map HTTP status to error codes

**Implementation Details**:
- Imports: ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus from @nestjs/common; Response from express
- Interface: ErrorEnvelope
- Class: ErrorEnvelopeFilter implements ExceptionFilter
- Methods: catch(), mapStatusToCode(), extractMessage()

---

### Task 5.4: Apply Interceptor and Filter Globally in main.ts PENDING

**File**: apps/dashboard-api/src/main.ts
**Spec Reference**: implementation-plan.md
**Pattern to Follow**: NestJS global providers

**Quality Requirements**:
- ResponseEnvelopeInterceptor applied globally
- ErrorEnvelopeFilter applied globally
- All endpoints automatically wrapped

**Implementation Details**:
- Import interceptor and filter
- Use app.useGlobalInterceptors(new ResponseEnvelopeInterceptor())
- Use app.useGlobalFilters(new ErrorEnvelopeFilter())

---

**Batch 5 Verification**:

- Swagger UI accessible at /api/docs
- All endpoints documented
- Response envelope applied to all responses
- Error envelope applied to all errors
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Batch 6: Controller Decorators, Build Integration, and Verification PENDING

**Developer**: nitro-backend-developer
**Tasks**: 5 | **Dependencies**: Batch 5

### Task 6.1: Add Swagger Decorators to DashboardController PENDING

**File**: apps/dashboard-api/src/dashboard/dashboard.controller.ts
**Spec Reference**: implementation-plan.md:489-536
**Pattern to Follow**: @ApiTags, @ApiOperation, @ApiResponse, @ApiParam

**Quality Requirements**:
- All 18 endpoints documented with @ApiOperation
- @ApiResponse for 200, 400, 404, 500 status codes where applicable
- @ApiParam for :id parameters
- @ApiTags grouping (health, registry, plan, state, tasks, workers, sessions, analytics, knowledge)

**Implementation Details**:
- Import: ApiTags, ApiOperation, ApiResponse, ApiParam from @nestjs/swagger
- Add @ApiTags at class level for main group
- Add @ApiTags at method level for cross-group endpoints
- Add @ApiOperation with summary and description
- Add @ApiResponse for each status code

---

### Task 6.2: Add Swagger Decorators to HealthController PENDING

**File**: apps/dashboard-api/src/app/health.controller.ts
**Spec Reference**: implementation-plan.md:536-537
**Pattern to Follow**: @ApiTags, @ApiOperation, @ApiResponse

**Quality Requirements**:
- Health endpoint documented
- @ApiTags('health')

**Implementation Details**:
- Import: ApiTags, ApiOperation, ApiResponse from @nestjs/swagger
- Add decorators to getHealth() method

---

### Task 6.3: Create OpenAPI Spec Generation Script PENDING

**File**: apps/dashboard-api/scripts/generate-spec.ts
**Spec Reference**: implementation-plan.md:566-599
**Pattern to Follow**: NestJS programmatic spec generation

**Quality Requirements**:
- Generate openapi.json on build
- Output to dist/openapi.json
- Silent logger during generation

**Implementation Details**:
- Import: NestFactory from @nestjs/core; DocumentBuilder, SwaggerModule from @nestjs/swagger; VersioningType from @nestjs/common
- Import: writeFileSync from node:fs; join from node:path
- Import: AppModule from ../src/app/app.module
- Create app with logger: false
- Enable versioning (same as main.ts)
- Build document with same config as main.ts
- Write JSON to dist/openapi.json

---

### Task 6.4: Update package.json with Build Scripts PENDING

**File**: apps/dashboard-api/package.json
**Spec Reference**: implementation-plan.md:554-564
**Pattern to Follow**: npm scripts pattern

**Quality Requirements**:
- build:spec script to generate OpenAPI spec
- Add ts-node and tsconfig-paths if needed

**Implementation Details**:
- Add script: "build:spec": "ts-node -r tsconfig-paths/register scripts/generate-spec.ts"
- Optionally add postbuild hook or keep manual

---

### Task 6.5: Verify All Endpoints via Swagger UI PENDING

**File**: N/A - Manual verification task
**Spec Reference**: implementation-plan.md:811-816
**Pattern to Follow**: Manual testing

**Quality Requirements**:
- All 18 endpoints accessible in Swagger UI
- Response envelope format verified
- Error envelope format verified (test with invalid task ID)
- openapi.json generated successfully

**Implementation Details**:
- Start server: `npm run start:dev`
- Access /api/docs
- Test each endpoint group:
  - GET /api/v1/health
  - GET /api/v1/registry
  - GET /api/v1/plan
  - GET /api/v1/state
  - GET /api/v1/tasks/:id (valid and invalid IDs)
  - GET /api/v1/anti-patterns
  - GET /api/v1/review-lessons
  - GET /api/v1/stats
  - GET /api/v1/graph
  - GET /api/v1/workers/tree
  - GET /api/v1/sessions/active
  - GET /api/v1/sessions/:id
  - GET /api/v1/sessions
  - GET /api/v1/analytics/cost
  - GET /api/v1/analytics/efficiency
  - GET /api/v1/analytics/models
  - GET /api/v1/analytics/sessions
- Run: `npm run build:spec`
- Verify dist/openapi.json exists and is valid JSON

---

**Batch 6 Verification**:

- All controller endpoints have Swagger decorators
- Swagger UI loads at /api/docs
- All endpoints testable from Swagger UI
- Response envelope format consistent
- Error envelope format consistent
- openapi.json generated on build
- Build passes: `cd apps/dashboard-api && npm run build`

---

## Summary

| Batch | Tasks | Developer | Status |
| ----- | ----- | --------- | ------ |
| 1 | 4 | nitro-backend-developer | PENDING |
| 2 | 4 | nitro-backend-developer | PENDING |
| 3 | 5 | nitro-backend-developer | PENDING |
| 4 | 5 | nitro-backend-developer | PENDING |
| 5 | 4 | nitro-backend-developer | PENDING |
| 6 | 5 | nitro-backend-developer | PENDING |
| **Total** | **27** | | |

---

## Files to Create

1. apps/dashboard-api/src/app/dtos/enums/task.enums.ts
2. apps/dashboard-api/src/app/dtos/enums/worker.enums.ts
3. apps/dashboard-api/src/app/dtos/enums/index.ts
4. apps/dashboard-api/src/app/dtos/common.dto.ts
5. apps/dashboard-api/src/app/dtos/index.ts
6. apps/dashboard-api/src/app/dtos/responses/task-record.dto.ts
7. apps/dashboard-api/src/app/dtos/responses/orchestrator-state.dto.ts
8. apps/dashboard-api/src/app/dtos/responses/plan.dto.ts
9. apps/dashboard-api/src/app/dtos/responses/review.dto.ts
10. apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts
11. apps/dashboard-api/src/app/dtos/responses/full-task.dto.ts
12. apps/dashboard-api/src/app/dtos/responses/stats.dto.ts
13. apps/dashboard-api/src/app/dtos/responses/graph.dto.ts
14. apps/dashboard-api/src/app/dtos/responses/session.dto.ts
15. apps/dashboard-api/src/app/dtos/responses/worker-tree.dto.ts
16. apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts
17. apps/dashboard-api/src/app/dtos/responses/anti-patterns.dto.ts
18. apps/dashboard-api/src/app/dtos/responses/lessons.dto.ts
19. apps/dashboard-api/src/app/dtos/responses/index.ts
20. apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts
21. apps/dashboard-api/src/app/dtos/requests/index.ts
22. apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
23. apps/dashboard-api/src/app/filters/error-envelope.filter.ts
24. apps/dashboard-api/scripts/generate-spec.ts

## Files to Modify

1. apps/dashboard-api/package.json (dependencies and scripts)
2. apps/dashboard-api/src/main.ts (versioning, swagger, interceptor, filter)
3. apps/dashboard-api/src/dashboard/dashboard.controller.ts (version decorator, swagger decorators)
4. apps/dashboard-api/src/app/health.controller.ts (version decorator, swagger decorators)
