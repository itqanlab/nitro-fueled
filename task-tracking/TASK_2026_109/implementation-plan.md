# Implementation Plan - TASK_2026_109

## API Contract Layer - OpenAPI Spec, Typed DTOs, Versioned Endpoints

---

## Codebase Investigation Summary

### Libraries Analyzed

1. **@nestjs/swagger** (TO BE INSTALLED)
   - Purpose: OpenAPI/Swagger integration for NestJS
   - Key exports: `DocumentBuilder`, `SwaggerModule`, `ApiTags`, `ApiOperation`, `ApiResponse`, `ApiProperty`, `ApiParam`, `ApiBody`
   - Documentation: Context7 query confirms setup patterns

2. **class-validator** (TO BE INSTALLED)
   - Purpose: Input validation decorators for DTOs
   - Key exports: `IsString`, `IsNotEmpty`, `IsOptional`, `IsEnum`, `IsInt`, `IsArray`, `ValidateNested`

3. **class-transformer** (TO BE INSTALLED)
   - Purpose: Transform plain objects to class instances
   - Key exports: `plainToInstance`, `Type`, `Exclude`, `Expose`

### Existing Patterns Identified

1. **Controller Structure** (apps/dashboard-api/src/dashboard/dashboard.controller.ts:23)
   - Pattern: `@Controller('api')` with constructor dependency injection
   - Endpoints: 16 GET endpoints across health, registry, plan, state, tasks, workers, sessions, analytics
   - Response types: Direct return of service method results (no DTO wrapping)
   - Evidence: dashboard.controller.ts:23-197

2. **Type Definitions** (apps/dashboard-api/src/dashboard/dashboard.types.ts)
   - Pattern: TypeScript `interface` and `type` definitions (not classes)
   - Key types: `TaskRecord`, `OrchestratorState`, `PlanData`, `SessionData`, `DashboardStats`, `GraphData`, `AnalyticsCostData`, etc.
   - Evidence: dashboard.types.ts:1-366

3. **Service Layer** (apps/dashboard-api/src/dashboard/pipeline.service.ts:65, sessions.service.ts:13, analytics.service.ts:33)
   - Pattern: `@Injectable()` services with Map-based state management
   - Return types: Explicitly typed via TypeScript return annotations
   - Evidence: pipeline.service.ts, sessions.service.ts, analytics.service.ts

4. **Module Structure** (apps/dashboard-api/src/app/app.module.ts:1, dashboard.module.ts:16)
   - Pattern: `@Module({})` with imports, controllers, providers, exports
   - Evidence: app.module.ts, dashboard.module.ts

5. **Bootstrap Configuration** (apps/dashboard-api/src/main.ts:1)
   - Pattern: `NestFactory.create()` with CORS enabled
   - Port: Environment variable or 0 (random available port)
   - Evidence: main.ts:5-19

### Integration Points

1. **DashboardController** - Main REST API with 16 endpoints
   - Location: apps/dashboard-api/src/dashboard/dashboard.controller.ts
   - Endpoints to decorate:
     - `GET /api/health` - Health check
     - `GET /api/registry` - Task registry
     - `GET /api/plan` - Plan data
     - `GET /api/state` - Orchestrator state
     - `GET /api/tasks/:id` - Single task
     - `GET /api/tasks/:id/reviews` - Task reviews
     - `GET /api/tasks/:id/pipeline` - Task pipeline
     - `GET /api/anti-patterns` - Anti-patterns
     - `GET /api/review-lessons` - Review lessons
     - `GET /api/stats` - Dashboard stats
     - `GET /api/graph` - Dependency graph
     - `GET /api/workers/tree` - Worker tree
     - `GET /api/sessions/active` - Active sessions
     - `GET /api/sessions/:id` - Single session
     - `GET /api/sessions` - All sessions
     - `GET /api/analytics/cost` - Cost analytics
     - `GET /api/analytics/efficiency` - Efficiency analytics
     - `GET /api/analytics/models` - Model analytics
     - `GET /api/analytics/sessions` - Session comparison

2. **HealthController** - Simple health endpoint
   - Location: apps/dashboard-api/src/app/health.controller.ts
   - Endpoints: `GET /health`

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Layered API Contract with Response Envelope

**Rationale**:
1. Versioning at URI level (`/api/v1/...`) matches NestJS idiomatic patterns
2. Response envelope standardizes all API responses for client consumption
3. DTOs provide type safety, validation, and self-documentation via Swagger
4. Interceptor pattern for response envelope is non-invasive to existing controller logic

**Evidence**:
- NestJS URI versioning: Context7 docs (versioning.md)
- Response interceptor pattern: Standard NestJS interceptor pattern
- DTO validation: Context7 docs (pipes.md, techniques/validation.md)

### Component Specifications

---

#### Component 1: API Versioning Configuration

**Purpose**: Enable URI-based API versioning (`/api/v1/...`) to support future breaking changes

**Pattern**: NestJS VersioningType.URI

**Evidence**: Context7 docs (versioning.md) - `app.enableVersioning({ type: VersioningType.URI })`

**Responsibilities**:
- Enable versioning in bootstrap (main.ts)
- Apply version '1' to all existing controllers
- Configure version prefix (default 'v')

**Implementation Pattern**:
```typescript
// Pattern source: Context7 NestJS versioning docs
// File: apps/dashboard-api/src/main.ts
import { VersioningType } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable URI versioning: /api/v1/...
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // ... existing CORS config
}
```

**Controller Migration Pattern**:
```typescript
// Pattern source: Context7 NestJS versioning docs
// File: apps/dashboard-api/src/dashboard/dashboard.controller.ts
@Controller({
  path: 'api',
  version: '1',
})
export class DashboardController { ... }

// File: apps/dashboard-api/src/app/health.controller.ts
@Controller({
  version: '1',
})
export class HealthController { ... }
```

**Files Affected**:
- apps/dashboard-api/src/main.ts (MODIFY)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (MODIFY)
- apps/dashboard-api/src/app/health.controller.ts (MODIFY)

---

#### Component 2: Response Envelope Interceptor

**Purpose**: Wrap all API responses in a standardized envelope format for consistent client consumption

**Pattern**: NestJS Interceptor (NestInterceptor)

**Evidence**: Standard NestJS interceptor pattern

**Responsibilities**:
- Transform successful responses to `{ success: true, data: ..., meta: {...} }`
- Include timestamp and API version in metadata
- Preserve raw response data structure

**Implementation Pattern**:
```typescript
// Pattern source: NestJS interceptor pattern
// File: apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      })),
    );
  }
}
```

**Files Affected**:
- apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts (CREATE)
- apps/dashboard-api/src/main.ts (MODIFY - apply globally)

---

#### Component 3: Exception Filter for Error Envelope

**Purpose**: Standardize error responses in the same envelope format

**Pattern**: NestJS Exception Filter (ExceptionFilter)

**Evidence**: Standard NestJS exception filter pattern

**Responsibilities**:
- Catch all exceptions
- Transform to `{ success: false, error: {...}, meta: {...} }`
- Map exception types to error codes

**Implementation Pattern**:
```typescript
// Pattern source: NestJS exception filter pattern
// File: apps/dashboard-api/src/app/filters/error-envelope.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    version: string;
  };
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const code = this.mapStatusToCode(status);
    const message = this.extractMessage(exceptionResponse);

    const errorEnvelope: ErrorEnvelope = {
      success: false,
      error: { code, message },
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    response.status(status).json(errorEnvelope);
  }

  private mapStatusToCode(status: number): string {
    const codeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return codeMap[status] ?? 'UNKNOWN_ERROR';
  }

  private extractMessage(response: unknown): string {
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      if (typeof obj['message'] === 'string') return obj['message'];
      if (typeof obj['error'] === 'string') return obj['error'];
    }
    return 'An error occurred';
  }
}
```

**Files Affected**:
- apps/dashboard-api/src/app/filters/error-envelope.filter.ts (CREATE)
- apps/dashboard-api/src/main.ts (MODIFY - apply globally)

---

#### Component 4: DTOs for Request/Response

**Purpose**: Provide typed, validated, and documented DTOs for all API endpoints

**Pattern**: Class-based DTOs with Swagger and class-validator decorators

**Evidence**:
- Context7 docs (nestjs/swagger - @ApiProperty decorators)
- Context7 docs (nestjs/docs.nestjs.com - class-validator integration)

**Responsibilities**:
- Define response DTOs for all existing types
- Add @ApiProperty decorators for Swagger schema generation
- Convert existing TypeScript interfaces to class-based DTOs
- Export from shared location for client consumption

**Implementation Pattern**:
```typescript
// Pattern source: Context7 @nestjs/swagger docs
// File: apps/dashboard-api/src/app/dtos/common.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Response timestamp' })
  timestamp: string;

  @ApiProperty({ example: 'v1', description: 'API version' })
  version: string;
}

export class ResponseEnvelopeDto<T> {
  @ApiProperty({ description: 'Request success status' })
  success: true;

  @ApiProperty({ description: 'Response payload' })
  data: T;

  @ApiProperty({ type: MetaDto, description: 'Response metadata' })
  meta: MetaDto;
}

export class ErrorDto {
  @ApiProperty({ example: 'NOT_FOUND', description: 'Error code' })
  code: string;

  @ApiProperty({ example: 'Task not found', description: 'Error message' })
  message: string;
}

export class ErrorEnvelopeDto {
  @ApiProperty({ description: 'Request failure status' })
  success: false;

  @ApiProperty({ type: ErrorDto, description: 'Error details' })
  error: ErrorDto;

  @ApiProperty({ type: MetaDto, description: 'Response metadata' })
  meta: MetaDto;
}
```

**Response DTOs** (converted from dashboard.types.ts interfaces):
```typescript
// File: apps/dashboard-api/src/app/dtos/responses/task-record.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskType } from '../enums/task.enums';

export class TaskRecordDto {
  @ApiProperty({ example: 'TASK_2026_001', description: 'Unique task identifier' })
  id: string;

  @ApiProperty({ enum: TaskStatus, description: 'Current task status' })
  status: TaskStatus;

  @ApiProperty({ enum: TaskType, description: 'Task type' })
  type: TaskType;

  @ApiProperty({ example: 'Add authentication system', description: 'Task description' })
  description: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Creation timestamp' })
  created: string;

  @ApiPropertyOptional({ example: 'claude-sonnet-4-20250514', description: 'Model used' })
  model?: string;
}
```

**Files Affected**:
- apps/dashboard-api/src/app/dtos/index.ts (CREATE - barrel export)
- apps/dashboard-api/src/app/dtos/common.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/enums/task.enums.ts (CREATE)
- apps/dashboard-api/src/app/dtos/enums/worker.enums.ts (CREATE)
- apps/dashboard-api/src/app/dtos/enums/index.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/task-record.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/registry.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/plan.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/orchestrator-state.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/full-task.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/review.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/anti-patterns.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/lessons.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/stats.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/graph.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/worker-tree.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/session.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/responses/index.ts (CREATE)
- apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts (CREATE)
- apps/dashboard-api/src/app/dtos/requests/index.ts (CREATE)

---

#### Component 5: Swagger Module Configuration

**Purpose**: Configure and expose Swagger UI at `/api/docs`

**Pattern**: NestJS Swagger DocumentBuilder pattern

**Evidence**: Context7 docs (nestjs/swagger - SwaggerModule setup)

**Responsibilities**:
- Configure OpenAPI document metadata
- Setup Swagger UI at `/api/docs`
- Export JSON spec at `/api/docs-json`
- Add API tags for grouping

**Implementation Pattern**:
```typescript
// Pattern source: Context7 @nestjs/swagger docs
// File: apps/dashboard-api/src/main.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable versioning and CORS (existing)
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors({ ... });

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Nitro-Fueled Dashboard API')
    .setDescription('Internal development dashboard API for task orchestration monitoring')
    .setVersion('1.0')
    .addTag('health', 'Health check endpoints')
    .addTag('registry', 'Task registry operations')
    .addTag('plan', 'Project plan data')
    .addTag('state', 'Orchestrator state')
    .addTag('tasks', 'Task operations')
    .addTag('workers', 'Worker management')
    .addTag('sessions', 'Session management')
    .addTag('analytics', 'Cost and efficiency analytics')
    .addTag('knowledge', 'Anti-patterns and lessons learned')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Nitro-Fueled API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
}
```

**Files Affected**:
- apps/dashboard-api/src/main.ts (MODIFY)

---

#### Component 6: Controller OpenAPI Decorators

**Purpose**: Document all controller endpoints with OpenAPI metadata

**Pattern**: @ApiTags, @ApiOperation, @ApiResponse decorators

**Evidence**: Context7 docs (nestjs/swagger - @ApiResponse decorators)

**Responsibilities**:
- Add @ApiTags to controller class
- Add @ApiOperation to each method
- Add @ApiResponse for success and error responses
- Add @ApiParam for path parameters

**Implementation Pattern**:
```typescript
// Pattern source: Context7 @nestjs/swagger docs
// File: apps/dashboard-api/src/dashboard/dashboard.controller.ts
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TaskRecordDto } from '../app/dtos/responses/task-record.dto';
import { ErrorEnvelopeDto } from '../app/dtos/common.dto';

@Controller({ path: 'api', version: '1' })
@ApiTags('registry')
export class DashboardController {
  // ... constructor

  @Get('registry')
  @ApiOperation({ summary: 'Get task registry', description: 'Returns all task records from the registry' })
  @ApiResponse({ status: 200, description: 'Task registry retrieved', type: [TaskRecordDto] })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorEnvelopeDto })
  public getRegistry(): ReadonlyArray<TaskRecordDto> {
    return this.pipelineService.getRegistry();
  }

  @Get('tasks/:id')
  @ApiTags('tasks')
  @ApiOperation({ summary: 'Get task by ID', description: 'Returns full task data including definition, reviews, and completion report' })
  @ApiParam({ name: 'id', description: 'Task ID (format: TASK_YYYY_NNN)', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Task data retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid task ID format', type: ErrorEnvelopeDto })
  @ApiResponse({ status: 404, description: 'Task not found', type: ErrorEnvelopeDto })
  public getTask(@Param('id') id: string) { ... }
}
```

**Files Affected**:
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (MODIFY)
- apps/dashboard-api/src/app/health.controller.ts (MODIFY)

---

#### Component 7: OpenAPI Spec Export on Build

**Purpose**: Auto-generate `openapi.json` spec file during build process

**Pattern**: Build script that generates spec file

**Evidence**: Standard NestJS pattern for spec generation

**Responsibilities**:
- Add build script to generate OpenAPI spec
- Output to `dist/openapi.json`
- Make spec available for SDK generation

**Implementation Pattern**:
```json
// File: apps/dashboard-api/package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "build:spec": "ts-node -r tsconfig-paths/register scripts/generate-spec.ts",
    "postbuild": "npm run build:spec"
  }
}
```

```typescript
// File: apps/dashboard-api/scripts/generate-spec.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app/app.module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function generateSpec(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableVersioning({ type: VersioningType.URI });

  const config = new DocumentBuilder()
    .setTitle('Nitro-Fueled Dashboard API')
    .setDescription('Internal development dashboard API')
    .setVersion('1.0')
    // ... tags
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = join(__dirname, '../dist/openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI spec generated at ${outputPath}`);
  await app.close();
}

generateSpec().catch((err) => {
  console.error('Failed to generate spec:', err);
  process.exit(1);
});
```

**Files Affected**:
- apps/dashboard-api/package.json (MODIFY)
- apps/dashboard-api/scripts/generate-spec.ts (CREATE)

---

## Integration Architecture

### Data Flow

```
HTTP Request
    ↓
[ValidationPipe] ← Request DTO validation
    ↓
[Controller] ← @ApiTags, @ApiOperation, @ApiResponse decorators
    ↓
[Service] ← Business logic (unchanged)
    ↓
[ResponseEnvelopeInterceptor] ← Wrap response in envelope
    ↓
HTTP Response (enveloped)
```

### Error Flow

```
Exception thrown
    ↓
[ErrorEnvelopeFilter] ← Catch and transform to error envelope
    ↓
HTTP Response (error envelope)
```

### Dependencies

**New Dependencies (to install)**:
```json
{
  "dependencies": {
    "@nestjs/swagger": "^11.0.0"
  },
  "devDependencies": {
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  }
}
```

**Internal Dependencies**:
- All existing services (PipelineService, SessionsService, AnalyticsService)
- All existing types (dashboard.types.ts) - will be migrated to DTOs

---

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

- **Performance**: Response envelope adds minimal overhead (simple object wrapping)
- **Security**: No authentication added (internal dev tool per task requirements)
- **Maintainability**: DTOs centralize type definitions, easy to extend
- **Testability**: DTOs can be validated independently, Swagger enables contract testing
- **Backward Compatibility**: URI versioning ensures current clients unaffected; all endpoints move to `/api/v1/...`

### Pattern Compliance

- Versioning follows NestJS URI versioning pattern
- DTOs use @ApiProperty decorators for Swagger integration
- Response envelope uses NestJS interceptor pattern
- Error handling uses NestJS exception filter pattern

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: nitro-backend-developer

**Rationale**: This is a pure backend task involving NestJS patterns, DTO creation, and OpenAPI configuration. No frontend work required.

### Complexity Assessment

**Complexity**: MEDIUM

**Estimated Effort**: 4-6 hours

**Risk Factors**:
1. DTO creation is tedious but straightforward (many types to convert)
2. Response envelope may affect existing WebSocket broadcasts (need to verify)
3. Versioning changes URL paths (may break existing clients if not coordinated)

### Files Affected Summary

**CREATE** (15 files):
- apps/dashboard-api/src/app/dtos/index.ts
- apps/dashboard-api/src/app/dtos/common.dto.ts
- apps/dashboard-api/src/app/dtos/enums/task.enums.ts
- apps/dashboard-api/src/app/dtos/enums/worker.enums.ts
- apps/dashboard-api/src/app/dtos/enums/index.ts
- apps/dashboard-api/src/app/dtos/responses/task-record.dto.ts
- apps/dashboard-api/src/app/dtos/responses/registry.dto.ts
- apps/dashboard-api/src/app/dtos/responses/plan.dto.ts
- apps/dashboard-api/src/app/dtos/responses/orchestrator-state.dto.ts
- apps/dashboard-api/src/app/dtos/responses/full-task.dto.ts
- apps/dashboard-api/src/app/dtos/responses/review.dto.ts
- apps/dashboard-api/src/app/dtos/responses/stats.dto.ts
- apps/dashboard-api/src/app/dtos/responses/graph.dto.ts
- apps/dashboard-api/src/app/dtos/responses/session.dto.ts
- apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts
- apps/dashboard-api/src/app/dtos/responses/worker-tree.dto.ts
- apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts
- apps/dashboard-api/src/app/dtos/responses/anti-patterns.dto.ts
- apps/dashboard-api/src/app/dtos/responses/lessons.dto.ts
- apps/dashboard-api/src/app/dtos/responses/index.ts
- apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts
- apps/dashboard-api/src/app/dtos/requests/index.ts
- apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
- apps/dashboard-api/src/app/filters/error-envelope.filter.ts
- apps/dashboard-api/scripts/generate-spec.ts

**MODIFY** (5 files):
- apps/dashboard-api/package.json (add dependencies, scripts)
- apps/dashboard-api/src/main.ts (versioning, swagger, interceptor, filter)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (version decorator, swagger decorators)
- apps/dashboard-api/src/app/health.controller.ts (version decorator, swagger decorators)
- apps/dashboard-api/src/app/app.module.ts (import DTOs module if needed)

### Architecture Delivery Checklist

- [x] All components specified with evidence
- [x] All patterns verified from codebase (Context7 docs for @nestjs/swagger, NestJS docs for versioning)
- [x] All imports verified as existing (standard NestJS packages)
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed

---

## Risk Assessment and Mitigation

### Risk 1: Existing Client Breakage from Versioning

**Impact**: HIGH - Angular dashboard may stop working

**Mitigation**:
1. Coordinate with frontend to update API base URL to `/api/v1/`
2. Test all endpoints after versioning change
3. Document new URL patterns clearly

### Risk 2: Response Envelope Breaks Type Expectations

**Impact**: MEDIUM - Clients expecting direct data may fail

**Mitigation**:
1. Response envelope wraps data; clients must access `response.data`
2. Update Angular services to unwrap envelope
3. Document envelope structure in Swagger

### Risk 3: WebSocket Gateway Not Updated

**Impact**: LOW - WebSocket events may not follow envelope pattern

**Mitigation**:
1. WebSocket events intentionally NOT wrapped (different protocol)
2. Only HTTP REST responses use envelope
3. Document distinction in Swagger

### Risk 4: DTO Drift from Actual Types

**Impact**: MEDIUM - DTOs may not match actual service return types

**Mitigation**:
1. DTOs derived directly from dashboard.types.ts
2. TypeScript compiler will catch type mismatches
3. Keep DTOs in sync with types during future changes

---

## Implementation Sequence

**Phase 1: Foundation** (Est. 1-2 hours)
1. Install dependencies (@nestjs/swagger, class-validator, class-transformer)
2. Create enums DTOs from existing types
3. Create common DTOs (envelope, meta, error)
4. Enable API versioning in main.ts

**Phase 2: Response DTOs** (Est. 1.5-2 hours)
5. Create all response DTOs (task-record, registry, plan, state, etc.)
6. Create request parameter DTOs (task-id.param.dto.ts)
7. Create barrel exports (index.ts files)

**Phase 3: Swagger Integration** (Est. 1 hour)
8. Configure Swagger in main.ts
9. Add decorators to DashboardController
10. Add decorators to HealthController

**Phase 4: Response Envelope** (Est. 0.5-1 hour)
11. Create ResponseEnvelopeInterceptor
12. Create ErrorEnvelopeFilter
13. Apply globally in main.ts

**Phase 5: Build Integration** (Est. 0.5 hour)
14. Create generate-spec.ts script
15. Update package.json scripts
16. Verify openapi.json generation

**Phase 6: Verification** (Est. 0.5 hour)
17. Test all endpoints via Swagger UI
18. Verify response envelope format
19. Verify error envelope format
20. Verify openapi.json spec completeness
