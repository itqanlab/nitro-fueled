# Implementation Plan - TASK_2026_088

## Codebase Investigation Summary

### Libraries Discovered
- **@nestjs/websockets**: WebSocket gateway support (apps/dashboard-api/package.json:15)
  - Key exports: @WebSocketGateway, @WebSocketServer, @SubscribeMessage, @ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect
 Socket)
  - Evidence: Package.json includes @nestjs/websockets@^11.5.1 and @nestjs/platform-socket.io@^11.5.1
- **@nestjs/platform-socket.io**: Socket.IO platform adapter (apps/dashboard-api/package.json:16)
  - Provides Socket.IO server and client types (Server, Namespace, Socket)
  - Documentation: Verified through NestJS documentation queries

### Patterns identified
- **NestJS Module Pattern**: Module definition with providers and exports
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.module.ts:1-30
  - Components: Module decorator, providers array, exports array
  - Conventions: Services marked with @Injectable, controllers registered separately
- **NestJS Service Pattern**: Injectable services with constructor injection
  - Evidence: apps/dashboard-api/src/dashboard/sessions.service.ts:1-134
  - Components: @Injectable decorator, constructor injection of dependencies, Logger for logging
- **NestJS Controller Pattern**: Controllers with decorator-based routing
  - Evidence: apps/dashboard-api/src/dashboard/dashboard.controller.ts:1-198
  - Components: @Controller decorator, @Get/@Post route decorators, @Param for path params
- **WebSocket Connection Pattern**: Event-based broadcasting using event bus
  - Evidence: apps/dashboard-service/src/server/websocket.ts:9-62
  - Components: WebSocketBroadcaster class, event subscription, broadcast to all clients

### Integration Points
- **DashboardModule**: Module to register the gateway
  - Location: apps/dashboard-api/src/dashboard/dashboard.module.ts
  - Interface: Module with providers array
  - Usage: Add DashboardGateway to providers array
- **SessionsService**: Session data access service
  - Location: apps/dashboard-api/src/dashboard/sessions.service.ts
  - Interface: getSessions(), getSession(), getActiveSessions(), setSessionState(), setSessionLog()
  - Usage: Inject via constructor for real-time session data
- **AnalyticsService**: Analytics data access service
  - Location: apps/dashboard-api/src/dashboard/analytics.service.ts
  - Interface: getCostData(), getEfficiencyData(), getModelsData(), getSessionsData()
  - Usage: Inject via constructor for real-time analytics data
- **WatcherService**: File change event subscription
  - Location: apps/dashboard-api/src/dashboard/watcher.service.ts
  - Interface: subscribe(handler: (path: string, event: FileChangeEvent) => void): () => void
  - Usage: Subscribe to file changes to trigger WebSocket broadcasts
- **DashboardEvent Type**: Event structure for WebSocket messages
  - Location: apps/dashboard-api/src/dashboard/dashboard.types.ts
  - Interface: { readonly type: DashboardEventType; readonly timestamp: string; readonly payload: Record<string, unknown> }
  - Usage: Emit events in same format as existing implementation

## Architecture Design (Codebase-Aligned)

### Design Philosophy
**Chosen Approach**: NestJS @WebSocketGateway with Socket.IO platform adapter
**Rationale**: This approach fits the requirements by providing a standard NestJS WebSocket implementation that can emit events in the same format as the existing ws-based implementation, maintaining protocol compatibility while leveraging NestJS dependency injection and lifecycle management.
**Evidence**:
- NestJS WebSocket gateways are the standard pattern in this codebase (package.json includes @nestjs/websockets)
- Services use constructor injection pattern (sessions.service.ts:14, analytics.service.ts:34)
- Modules register providers in providers array (dashboard.module.ts:16-26)

### Component Specifications

#### Component 1: DashboardGateway
**Purpose**: Provide real-time WebSocket broadcasting of dashboard events, maintaining protocol compatibility with existing clients
**Pattern**: NestJS WebSocket Gateway with lifecycle hooks and service injection
**Evidence**:
- WebSocket broadcasting pattern: apps/dashboard-service/src/server/websocket.ts:9-62
- NestJS service injection pattern: apps/dashboard-api/src/dashboard/sessions.service.ts:15-16
- NestJS module registration pattern: apps/dashboard-api/src/dashboard/dashboard.module.ts:16-26

**Responsibilities**:
- Handle client connection lifecycle (connection, disconnection)
- Emit connection acknowledgment on new connections
- Broadcast dashboard events to all connected clients
- Subscribe to WatcherService for file change events
- Maintain backward compatibility with existing WebSocket protocol

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard-service/src/server/websocket.ts:9-62
// Verified imports from: @nestjs/websockets, @nestjs/platform-socket.io
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';
import { WatcherService } from './watcher.service';
import type { DashboardEvent } from './dashboard.types';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200'],
  },
})
@Injectable()
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(DashboardGateway.name);
  private watcherUnsubscribe: (() => void) | null = null;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly analyticsService: AnalyticsService,
    private readonly watcherService: WatcherService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
    this.setupWatcherSubscription();
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    // Emit connection event matching existing protocol
    client.emit(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
    }));
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  private setupWatcherSubscription() {
    this.watcherUnsubscribe = this.watcherService.subscribe(async (path, event) => {
      // Trigger broadcasts based on file changes
      await this.broadcastChanges();
    });
  }

  private async broadcastChanges() {
    // Broadcast session updates
    const sessions = this.sessionsService.getSessions();
    this.broadcastEvent({
      type: 'sessions:changed',
      timestamp: new Date().toISOString(),
      payload: { sessions },
    });

    // Broadcast analytics updates
    const costData = await this.analyticsService.getCostData();
    this.broadcastEvent({
      type: 'analytics:updated',
      timestamp: new Date().toISOString(),
      payload: { cost: costData },
    });
  }

  private broadcastEvent(event: DashboardEvent) {
    this.server.emit('dashboard-event', event);
  }
}
```

**Quality Requirements**:
- Functional: Must emit events in same format as ws implementation (type, timestamp, payload)
- Functional: Must handle connection/disconnection lifecycle properly
- Non-functional: Maintain backward compatibility with existing React dashboard client
- Non-functional: Log connection events appropriately
- Pattern compliance: Use NestJS dependency injection for services
- Pattern compliance: Implement OnGatewayConnection and OnGatewayDisconnect interfaces

**Files Affected**:
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (CREATE)

#### Component 2: DashboardModule Registration
**Purpose**: Register DashboardGateway in DashboardModule providers
**Pattern**: NestJS Module provider registration
**Evidence**:
- Module provider pattern: apps/dashboard-api/src/dashboard/dashboard.module.ts:14-27
- Service export pattern: apps/dashboard-api/src/dashboard/dashboard.module.ts:27

**Responsibilities**:
- Add DashboardGateway to providers array
- Ensure gateway is available for dependency injection

**Implementation Pattern**:
```typescript
// Pattern source: apps/dashboard-api/src/dashboard/dashboard.module.ts:14-27
// Modify existing module to add gateway provider
@Module({
  controllers: [DashboardController],
  providers: [
    DiffService,
    WorkerTreeService,
    PipelineService,
    SessionsService,
    {
      provide: AnalyticsService,
      useFactory: () => new AnalyticsService(process.cwd()),
    },
    WatcherService,
    DashboardGateway, // ADD THIS
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService],
})
export class DashboardModule {}
```

**Quality Requirements**:
- Functional: Gateway must be registered as provider
- Functional: Module must compile without errors
- Pattern compliance: Follow existing provider registration pattern

**Files Affected**:
- apps/dashboard-api/src/dashboard/dashboard.module.ts (MODIFY)

## Integration Architecture

### Data Flow
1. Client connects to WebSocket endpoint on dashboard-api server
2. DashboardGateway.handleConnection() emits 'connected' event to client
3. WatcherService detects file changes in task-tracking directory
4. WatcherService triggers subscribed handler in DashboardGateway
5. DashboardGateway fetches updated data from SessionsService/AnalyticsService
6. DashboardGateway broadcasts dashboard events to all connected clients
7. Clients receive events and update UI accordingly

### Dependencies
- External dependencies: @nestjs/websockets, @nestjs/platform-socket.io (already installed)
- Internal dependencies: SessionsService, AnalyticsService, WatcherService (already exist)

## Quality Requirements (Architecture-Level)

### Non-Functional Requirements
- **Performance**: WebSocket events must be broadcast efficiently without blocking
- **Security**: CORS must restrict origins to localhost:3000, localhost:5173, localhost:4200
- **Maintainability**: Gateway must follow NestJS patterns for consistency
- **Testability**: Gateway must use dependency injection for mockable services
- **Backward Compatibility**: Event format must match existing ws implementation exactly

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
 **Rationale**: This is a backend WebSocket migration task involving NestJS framework patterns, service injection, and server-side real-time communication. No frontend UI changes required.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 2-3 hours

### Files Affected Summary

**CREATE**: apps/dashboard-api/src/dashboard/dashboard.gateway.ts
**MODIFY**: apps/dashboard-api/src/dashboard/dashboard.module.ts

### Architecture Deliverables
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (that's nitro-team-leader's job)
