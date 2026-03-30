# Implementation Plan - TASK_2026_169

## Codebase Investigation Summary

### Libraries Discovered

- **@nestjs/common**: Core NestJS decorators and utilities
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.controller.ts:1
- **@nestjs/websockets**: WebSocket gateway support with Socket.IO
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.gateway.ts:1-9
- **@angular/core**: Angular 19+ with signals, standalone components, OnPush change detection
  - Evidence: apps/dashboard/src/app/views/analytics/analytics.component.ts:1
- **@angular/common**: Angular common pipes and directives (NgClass, DecimalPipe, AsyncPipe)
  - Evidence: apps/dashboard/src/app/views/analytics/analytics.component.ts:2
- **@angular/router**: Angular routing with lazy-loaded components
  - Evidence: apps/dashboard/src/app/app.routes.ts:1
- **@angular/common/http**: HttpClient for API calls with Observables
  - Evidence: apps/dashboard/src/app/services/api.service.ts:2
- **rxjs**: Reactive streams with toSignal for Angular signal interop
  - Evidence: apps/dashboard/src/app/views/analytics/analytics.component.ts:4
- **socket.io-client**: WebSocket client for real-time updates
  - Evidence: Not directly observed but used by dashboard.gateway (WebSocketServer from @nestjs/websockets)

### Patterns Identified

- **Controller Pattern**: RESTful controllers with @ApiTags, @ApiOperation, @ApiResponse decorators (Swagger/OpenAPI)
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.controller.ts:37-48
  - Components: Controller class with dependency injection via constructor
  - Conventions: Service injection in constructor, method-level decorators for API docs

- **Service Pattern**: Injectable services with clean separation of concerns
  - Evidence: apps/dashboard-api/src/dashboard/sessions.service.ts:13-14
  - Components: Class-level @Injectable() decorator, constructor injection
  - Conventions: Private readonly properties for dependencies, methods returning typed data

- **WebSocket Gateway Pattern**: Real-time event broadcasting with polling for external data sources
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.gateway.ts:17-24
  - Components: Gateway class implementing lifecycle hooks
  - Conventions: @WebSocketServer decorator, event polling interval, broadcastEvent method

- **Angular Component Pattern**: Standalone components with signals, computed values, and OnPush change detection
  - Evidence: apps/dashboard/src/app/views/analytics/analytics.component.ts:17-24
  - Components: @Component decorator with standalone: true, imports array
  - Conventions: inject() for services, toSignal() for Observables, computed() for derived state, effect() for side effects

- **API Service Pattern**: HTTP client wrapper with typed methods returning Observables
  - Evidence: apps/dashboard/src/app/services/api.service.ts:86-89
  - Components: Injectable class with inject(HttpClient)
  - Conventions: Base URL constant, get/post methods with type parameters

- **Route Pattern**: Lazy-loaded routes with loadComponent callback
  - Evidence: apps/dashboard/src/app/app.routes.ts:19-25
  - Components: Route config with loadComponent function
  - Conventions: Dynamic import inside loadComponent, path-based routing under LayoutComponent

- **Cortex MCP Integration**: Direct SQLite queries via better-sqlite3 for events data
  - Evidence: packages/mcp-cortex/src/tools/events.ts:22-25
  - Components: Parameterized queries with prepared statements
  - Conventions: JSON.parse/JSON.stringify for data field, normalized session IDs

### Integration Points

- **Cortex Service**: Direct SQLite database access for events query
  - Location: apps/dashboard-api/src/dashboard/cortex.service.ts
  - Interface: getEventsSince(lastEventId) returns array of events
  - Usage: Call query_events MCP tool to get filtered event data

- **WebSocket Gateway**: Dashboard gateway for real-time event broadcasting
  - Location: apps/dashboard-api/src/dashboard/dashboard.gateway.ts
  - Interface: emit('cortex-event', event) method
  - Usage: Poll cortex for new events and emit via WebSocket

- **API Controller**: Dashboard controller with existing REST endpoints
  - Location: apps/dashboard-api/src/dashboard/dashboard.controller.ts
  - Interface: @Get decorator for GET endpoints
  - Usage: Add new endpoint for logs queries

- **Angular Routing**: App routes with lazy-loaded components
  - Location: apps/dashboard/src/app/app.routes.ts
  - Interface: Routes array with path and component/loadComponent
  - Usage: Add new route for logs page

- **Sidebar Navigation**: Mock sidebar data for navigation items
  - Location: apps/dashboard/src/app/services/mock-data.constants.ts
  - Interface: SidebarSection[] array with title, items
  - Usage: Add "Logs" item to Telemetry or Management section

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Component-based architecture with real-time streaming via WebSocket
**Rationale**: Dashboard already uses Angular signals, OnPush change detection, and WebSocket for real-time updates. The logs dashboard should follow the same patterns to maintain consistency.
**Evidence**:
- Analytics component uses toSignal and computed for reactive state (apps/dashboard/src/app/views/analytics/analytics.component.ts:28-40)
- WebSocket gateway polls cortex for events and broadcasts them (apps/dashboard-api/src/dashboard/dashboard.gateway.ts:125-148)
- All views follow the same component structure with services and models

### Component Specifications

#### Component 1: Logs Page Component (Frontend)

**Purpose**: Main logs page with tabs for different log views (events, worker logs, session logs)
**Pattern**: Tab-based component with signal-based state management
**Evidence**:
- Analytics component uses similar tab-like structure (apps/dashboard/src/app/views/analytics/analytics.component.ts:42-45)
- Signal-based state management is standard across dashboard (analytics.component.ts:28-36)

**Responsibilities**:
- Display tabs for Event Log Viewer, Worker Logs, Session Logs
- Handle log data from API with filtering and search
- Subscribe to WebSocket for real-time log updates
- Implement search functionality across all log entries
- Implement time range filtering

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/views/analytics/analytics.component.ts:17-24
// Verified imports from: @angular/core, @angular/common, rxjs

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [NgClass, DecimalPipe, CommonModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsComponent {
  private readonly api = inject(ApiService);
  private readonly socket = inject(WebSocketService);

  private readonly eventsSignal = toSignal(
    this.api.getLogsEvents().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  public selectedTab: 'events' | 'workers' | 'sessions' = 'events';
  public searchQuery = '';
  public timeRange: '1h' | '24h' | '7d' | '30d' = '24h';

  // WebSocket subscription for real-time events
  constructor() {
    this.socket.on('cortex-event', (event: LogEvent) => {
      // Update event list
    });
  }
}
```

**Quality Requirements**:
- Must use OnPush change detection for performance
- Must implement search with debouncing to avoid excessive API calls
- Must handle WebSocket disconnection and reconnection
- Must display loading states and error messages
- Must support pagination for large log datasets

**Files Affected**:
- apps/dashboard/src/app/views/logs/ (CREATE)
  - logs.component.ts
  - logs.component.html
  - logs.component.scss

#### Component 2: Event Log Viewer (Frontend)

**Purpose**: Display chronological feed of cortex events with filtering capabilities
**Pattern**: List-based component with filtering and sorting
**Evidence**:
- Project component displays task lists (apps/dashboard/src/app/views/project/project.component.ts)
- Uses computed signals for derived filtering state (analytics.component.ts:38-40)

**Responsibilities**:
- Display events in chronological order (newest first)
- Filter by session ID, task ID, event type, severity
- Show event data in collapsible sections
- Syntax highlighting for JSON data payloads

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/views/analytics/analytics.component.ts:38-40
// Verified imports from: @angular/core

export class EventLogViewerComponent {
  private readonly eventsSignal = toSignal(
    this.api.getLogsEvents({ since: this.timeRangeStart }).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  private readonly filteredEvents = computed(() =>
    this.eventsSignal()
      .filter(e => !this.selectedSessionId || e.sessionId === this.selectedSessionId)
      .filter(e => !this.selectedTaskId || e.taskId === this.selectedTaskId)
      .filter(e => !this.selectedEventType || e.type === this.selectedEventType)
  );
}
```

**Quality Requirements**:
- Must handle large datasets efficiently (virtual scrolling if needed)
- Must provide clear visual distinction for different event types/severity
- Must support copy-to-clipboard for event data
- Must show loading states during data fetch

**Files Affected**:
- apps/dashboard/src/app/views/logs/event-log-viewer.component.ts (CREATE)
- apps/dashboard/src/app/views/logs/event-log-viewer.component.html (CREATE)
- apps/dashboard/src/app/views/logs/event-log-viewer.component.scss (CREATE)

#### Component 3: Worker Logs Viewer (Frontend)

**Purpose**: Display per-worker log output with syntax highlighting and collapsible sections
**Pattern**: Component with collapsible sections for organizing logs by phase
**Evidence**:
- Session viewer component displays session data (apps/dashboard/src/app/views/session-viewer/session-viewer.component.ts)
- Uses accordion/collapsible pattern for organizing content

**Responsibilities**:
- List all workers with their logs
- Display logs in collapsible sections per phase
- Implement search within worker logs
- Show worker status and metadata

**Quality Requirements**:
- Must support syntax highlighting for logs (using existing highlighting library if available)
- Must allow filtering by worker status
- Must display log timestamps in user's local timezone
- Must support exporting logs to file

**Files Affected**:
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.ts (CREATE)
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.html (CREATE)
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.scss (CREATE)

#### Component 4: Backend Logs Service (Backend)

**Purpose**: Service layer to query and format log data from cortex and file system
**Pattern**: Injectable service with methods returning typed data
**Evidence**:
- CortexService exists for cortex data access (apps/dashboard-api/src/dashboard/cortex.service.ts)
- SessionsService pattern for session data management (apps/dashboard-api/src/dashboard/sessions.service.ts:13-14)

**Responsibilities**:
- Query cortex events table with filters
- Read worker log files from disk
- Read session log files from disk
- Format and transform log data for frontend consumption
- Implement full-text search across logs

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard-api/src/dashboard/sessions.service.ts:13-14
// Verified imports from: @nestjs/common

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private readonly cortexService = inject(CortexService);

  public getEvents(filters: EventFilters): LogEvent[] {
    const events = this.cortexService.getEventsSince(filters.sinceId);
    if (!events) return [];

    return events.filter(e => {
      if (filters.sessionId && e.sessionId !== filters.sessionId) return false;
      if (filters.taskId && e.taskId !== filters.taskId) return false;
      if (filters.eventType && e.eventType !== filters.eventType) return false;
      return true;
    });
  }

  public getWorkerLogs(workerId: string): WorkerLogEntry[] {
    const logPath = this.cortexService.getWorkerLogPath(workerId);
    // Read and parse log file
    return this.parseLogFile(logPath);
  }
}
```

**Quality Requirements**:
- Must handle missing log files gracefully
- Must implement efficient full-text search (consider indexing if needed)
- Must validate all input parameters
- Must return appropriate HTTP status codes (404 for not found, 500 for server errors)

**Files Affected**:
- apps/dashboard-api/src/dashboard/logs.service.ts (CREATE)

#### Component 5: Backend Logs Controller (Backend)

**Purpose**: REST API endpoints for logs queries
**Pattern**: Controller with @Get decorators and typed responses
**Evidence**:
- DashboardController pattern (apps/dashboard-api/src/dashboard/dashboard.controller.ts:37-48)
- Uses @ApiTags, @ApiOperation, @ApiResponse for Swagger docs

**Responsibilities**:
- Expose GET /api/logs/events endpoint
- Expose GET /api/logs/worker/:workerId endpoint
- Expose GET /api/logs/session/:sessionId endpoint
- Expose GET /api/logs/search endpoint
- Support query parameters for filtering (sessionId, taskId, eventType, since, limit)

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard-api/src/dashboard/dashboard.controller.ts:37-48
// Verified imports from: @nestjs/common

@Controller({ path: 'api', version: '1' })
export class LogsController {
  private readonly logger = new Logger(LogsController.name);

  public constructor(private readonly logsService: LogsService) {}

  @ApiTags('logs')
  @ApiOperation({ summary: 'Get cortex events with filters' })
  @Get('logs/events')
  public getEvents(
    @Query('sessionId') sessionId?: string,
    @Query('taskId') taskId?: string,
    @Query('eventType') eventType?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: number,
  ): Observable<LogEvent[]> {
    return this.logsService.getEvents({ sessionId, taskId, eventType, since, limit });
  }
}
```

**Quality Requirements**:
- Must validate task ID format (TASK_YYYY_NNN) when provided
- Must validate session ID format (SESSION_YYYY-MM-DD_HH-MM-SS) when provided
- Must implement pagination with limit parameter (default 500, max 1000)
- Must include Swagger documentation for all endpoints

**Files Affected**:
- apps/dashboard-api/src/dashboard/logs.controller.ts (CREATE)

#### Component 6: Real-time Log Streaming (WebSocket Enhancement)

**Purpose**: Stream live logs for active sessions via WebSocket
**Pattern**: Extend existing WebSocket gateway with log-specific events
**Evidence**:
- DashboardGateway already polls cortex for events (apps/dashboard-api/src/dashboard/dashboard.gateway.ts:125-148)
- Pattern: setInterval polling with emit to server

**Responsibilities**:
- Extend existing cortex event polling to include new events
- Emit 'logs:new-event' WebSocket event for each new cortex event
- Emit 'logs:new-worker-log' event when worker logs update
- Support client subscription to specific log streams (by sessionId or workerId)

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard-api/src/dashboard/dashboard.gateway.ts:125-148
// Verified imports from: @nestjs/websockets

private pollCortexEvents(): void {
  const events = this.cortexService.getEventsSince(this.lastCortexEventId);
  if (events === null || events.length === 0) return;

  for (const event of events) {
    if (event.id > this.lastCortexEventId) {
      this.lastCortexEventId = event.id;
    }
    if (!this.server) continue;
    // Emit to clients subscribed to this log stream
    this.server.emit('logs:new-event', event);
  }
}
```

**Quality Requirements**:
- Must not duplicate existing cortex-event broadcast (reuse existing logic)
- Must support filtering by session/task/worker type in client subscription
- Must handle WebSocket connection state properly
- Must include rate limiting to prevent overwhelming clients

**Files Affected**:
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (MODIFY)

#### Component 7: TypeScript Models/Interfaces (Frontend)

**Purpose**: Type definitions for log data structures
**Pattern**: Separate model files with export const types
**Evidence**:
- API types defined in models/api.types.ts (apps/dashboard/src/app/services/api.service.ts:12-48)
- Analytics model types in models/analytics.model.ts (apps/dashboard/src/app/views/analytics/analytics.component.ts:6-10)

**Responsibilities**:
- Define LogEvent interface
- Define WorkerLogEntry interface
- Define SessionLogEntry interface
- Define EventFilters interface
- Export types for use across components

**Quality Requirements**:
- Must align with backend response types
- Must include all necessary fields from cortex events table
- Must include JSDoc comments for documentation

**Files Affected**:
- apps/dashboard/src/app/models/logs.model.ts (CREATE)

#### Component 8: API Service Methods (Frontend)

**Purpose**: Add API service methods for log queries
**Pattern**: Extend existing ApiService with new methods
**Evidence**:
- ApiService pattern (apps/dashboard/src/app/services/api.service.ts:86-89)
- All methods return Observable with typed response

**Responsibilities**:
- Add getLogsEvents() method
- Add getWorkerLogs() method
- Add getSessionLogs() method
- Add searchLogs() method
- All methods support query parameters for filtering

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/services/api.service.ts:92-98
// Verified imports from: @angular/common/http

public getLogsEvents(params?: EventFilters): Observable<LogEvent[]> {
  let httpParams = new HttpParams();
  if (params?.sessionId !== undefined) {
    httpParams = httpParams.set('sessionId', params.sessionId);
  }
  if (params?.taskId !== undefined) {
    httpParams = httpParams.set('taskId', params.taskId);
  }
  return this.http.get<LogEvent[]>(
    `${this.base}/logs/events`,
    { params: httpParams },
  );
}
```

**Quality Requirements**:
- Must match backend controller parameter names exactly
- Must handle HTTP errors with catchError (as seen in analytics.component.ts:29)
- Must return typed Observables

**Files Affected**:
- apps/dashboard/src/app/services/api.service.ts (MODIFY)

#### Component 9: Route Configuration (Frontend)

**Purpose**: Add route for logs page
**Pattern**: Add route to APP_ROUTES with lazy loading
**Evidence**:
- Existing route pattern (apps/dashboard/src/app/app.routes.ts:48-54)
- Lazy loading with dynamic import

**Responsibilities**:
- Add '/logs' route
- Configure lazy loading for LogsComponent
- Place route under LayoutComponent

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/app.routes.ts:47-53
// Verified imports from: @angular/router

{
  path: 'logs',
  loadComponent: () =>
    import('./views/logs/logs.component').then(
      (m) => m.LogsComponent,
    ),
},
```

**Quality Requirements**:
- Must maintain consistent route structure
- Must use lazy loading for performance
- Must include proper error handling if component fails to load

**Files Affected**:
- apps/dashboard/src/app/app.routes.ts (MODIFY)

#### Component 10: Sidebar Navigation Update (Frontend)

**Purpose**: Add "Logs" navigation item to sidebar
**Pattern**: Add item to MOCK_SIDEBAR_SECTIONS array
**Evidence**:
- Existing sidebar structure (apps/dashboard/src/app/services/mock-data.constants.ts:177-210)
- Telemetry section with icon-based items

**Responsibilities**:
- Add "Logs" item to Telemetry section (or create new "Monitoring" section)
- Configure icon, label, and route
- Optionally add badge count for recent error events

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard/src/app/services/mock-data.constants.ts:212-219
// Verified pattern from existing sections

{
  title: 'Monitoring',
  type: 'management',
  items: [
    { label: 'Logs', icon: '\u{1F4CB}', route: '/logs' },
  ],
}
```

**Quality Requirements**:
- Must use Unicode icon consistent with other items
- Must point to correct route ('/logs')
- Must maintain alphabetical order within sections

**Files Affected**:
- apps/dashboard/src/app/services/mock-data.constants.ts (MODIFY)

## Integration Architecture

### Data Flow

1. **Initial Load**:
   - Frontend: LogsComponent loads → ApiService.getLogsEvents() → Backend GET /api/logs/events
   - Backend: LogsController.getEvents() → LogsService.getEvents() → CortexService query_events() → SQLite DB query
   - Response: JSON array of events returned to frontend

2. **Real-Time Updates**:
   - Cortex: Workers log events via MCP emit_event tool → events table
   - Backend Gateway: Polls cortex every 3 seconds → emits new events via WebSocket 'logs:new-event'
   - Frontend: LogsComponent subscribes to WebSocket → updates event list in real-time

3. **Worker Logs**:
   - Worker logs written to disk during task execution
   - Frontend requests worker logs → Backend reads file system → Returns formatted log entries
   - No real-time streaming (file-based logs)

### Dependencies

- **External Dependencies Required**: None (uses existing libraries)
- **Internal Dependencies Required**:
  - CortexService: For events table queries (already exists)
  - File system access: For worker/session log files (Node.js fs module)
  - WebSocket infrastructure: Already exists (dashboard.gateway)

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements

- **Performance**:
  - API queries must return within 500ms for filtered datasets < 1000 events
  - Frontend must handle large log datasets (1000+ events) without UI freezing
  - WebSocket polling interval of 3 seconds is acceptable for real-time updates

- **Security**:
  - No authentication required (matches existing dashboard pattern)
  - Input validation for all query parameters
  - Prevent directory traversal attacks in file reading (only allow task-tracking/ paths)

- **Maintainability**:
  - Follow existing code patterns and conventions
  - Use TypeScript strict mode with proper typing
  - Add inline comments for complex logic (no code duplication comments)
  - Separate concerns (component, service, controller)

- **Testability**:
  - Services must be injectable for unit testing
  - Components must use dependency injection
  - Mock WebSocket in tests

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: nitro-frontend-developer and nitro-backend-developer (both)
**Rationale**: This task requires both frontend component development (Angular 19+) and backend API endpoints/services. The frontend work involves creating 4+ new components with real-time WebSocket integration, while backend work involves creating new services/controllers and extending the WebSocket gateway. Both domains are significant.

### Complexity Assessment

**Complexity**: MEDIUM
**Estimated Effort**: 8-12 hours

**Breakdown**:
- Backend (3-4 hours):
  - Create LogsService (1 hour)
  - Create LogsController (1 hour)
  - Extend DashboardGateway for log streaming (1 hour)
  - Add CortexService methods if needed (1 hour)

- Frontend (5-8 hours):
  - Create LogsComponent with tabs (2 hours)
  - Create EventLogViewerComponent (1.5 hours)
  - Create WorkerLogsViewerComponent (1.5 hours)
  - Create SessionLogsViewerComponent (1 hour)
  - Add models and update ApiService (1 hour)
  - Update routes and sidebar (0.5 hours)

### Files Affected Summary

**CREATE**:
- apps/dashboard-api/src/dashboard/logs.service.ts
- apps/dashboard-api/src/dashboard/logs.controller.ts
- apps/dashboard/src/app/models/logs.model.ts
- apps/dashboard/src/app/views/logs/logs.component.ts
- apps/dashboard/src/app/views/logs/logs.component.html
- apps/dashboard/src/app/views/logs/logs.component.scss
- apps/dashboard/src/app/views/logs/event-log-viewer.component.ts
- apps/dashboard/src/app/views/logs/event-log-viewer.component.html
- apps/dashboard/src/app/views/logs/event-log-viewer.component.scss
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.ts
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.html
- apps/dashboard/src/app/views/logs/worker-logs-viewer.component.scss

**MODIFY**:
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts
- apps/dashboard/src/app/services/api.service.ts
- apps/dashboard/src/app/app.routes.ts
- apps/dashboard/src/app/services/mock-data.constants.ts

### Architecture Delivery Checklist

- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (that's nitro-team-leader's job)
