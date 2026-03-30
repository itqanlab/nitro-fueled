import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleDestroy, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';
import { WatcherService } from './watcher.service';
import { CortexService } from './cortex.service';
import type { DashboardEvent, FileChangeEvent } from './dashboard.types';
import { WsAuthGuard } from './auth/ws-auth.guard';

/**
 * DashboardGateway provides real-time WebSocket broadcasting of dashboard events.
 * Migrated from dashboard-service/src/server/websocket.ts to NestJS Socket.IO.
 * Maintains protocol compatibility with existing clients.
 * WebSocket authentication guard added (TASK_2026_131).
 */
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200'],
  },
})
@Injectable()
export class DashboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(DashboardGateway.name);
  private watcherUnsubscribe: (() => void) | null = null;
  private cortexPollInterval: ReturnType<typeof setInterval> | null = null;
  private lastCortexEventId = 0;

  public constructor(
    private readonly sessionsService: SessionsService,
    private readonly analyticsService: AnalyticsService,
    private readonly watcherService: WatcherService,
    private readonly cortexService: CortexService,
  ) {}

  /**
   * Called after the gateway is initialized.
   * Seeds lastCortexEventId with the current DB max so we don't replay history on restart.
   */
  public afterInit(): void {
    this.logger.log('WebSocket gateway initialized');
    // Seed with current max event ID to avoid replaying full event history on restart
    const seed = this.cortexService.getEventsSince(0);
    if (seed !== null && seed.length > 0) {
      this.lastCortexEventId = seed[seed.length - 1]!.id;
      this.logger.debug(`Cortex event polling seeded at id=${this.lastCortexEventId}`);
    }
    this.setupWatcherSubscription();
    this.startCortexPolling();
  }

  /**
   * Handle new WebSocket client connections.
   * Emits a connection acknowledgment matching existing ws protocol format.
   */
  @UseGuards(WsAuthGuard)
  public handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    // Emit connection event matching existing protocol
    client.emit('dashboard-event', {
      type: 'connected',
      timestamp: new Date().toISOString(),
      payload: {},
    });
  }

  /**
   * Handle client disconnections.
   */
  public handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Clean up the watcher subscription on module destroy.
   */
  public onModuleDestroy(): void {
    if (this.watcherUnsubscribe) {
      this.watcherUnsubscribe();
      this.watcherUnsubscribe = null;
      this.logger.log('Watcher subscription cleaned up');
    }
    if (this.cortexPollInterval !== null) {
      clearInterval(this.cortexPollInterval);
      this.cortexPollInterval = null;
      this.logger.log('Cortex event polling stopped');
    }
  }

  /**
   * Subscribe to WatcherService for file change events.
   * Triggers broadcasts when files in task-tracking change.
   */
  private setupWatcherSubscription(): void {
    this.watcherUnsubscribe = this.watcherService.subscribe(
      async (_path: string, _event: FileChangeEvent): Promise<void> => {
        await this.broadcastChanges();
      },
    );
  }

  /**
   * Broadcast session and analytics updates to all connected clients.
   * Wraps service calls in try-catch to prevent broadcast failures from crashing the gateway.
   */
  private async broadcastChanges(): Promise<void> {
    // Broadcast session updates
    try {
      const sessions = this.sessionsService.getSessions();
      this.broadcastEvent({
        type: 'sessions:changed',
        timestamp: new Date().toISOString(),
        payload: { sessions },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to broadcast session updates: ${message}`);
    }

    // Broadcast analytics updates using state:refreshed event type
    try {
      const costData = await this.analyticsService.getCostData();
      this.broadcastEvent({
        type: 'state:refreshed',
        timestamp: new Date().toISOString(),
        payload: { analytics: costData },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to broadcast analytics updates: ${message}`);
    }
  }

  /**
   * Broadcast a dashboard event to all connected clients.
   */
  private broadcastEvent(event: DashboardEvent): void {
    if (!this.server) {
      this.logger.warn('Server not initialized, skipping broadcast');
      return;
    }
    this.server.emit('dashboard-event', event);
  }

  /**
   * Start polling the cortex events table every 3 seconds.
   * Emits 'cortex-event' to all connected clients for each new event.
   */
  private startCortexPolling(): void {
    this.cortexPollInterval = setInterval(() => {
      this.pollCortexEvents();
    }, 3000);
  }

  /**
   * Poll cortex for new events since the last seen event ID.
   * Skips silently when cortex is unavailable (DB not found).
   */
  private pollCortexEvents(): void {
    const events = this.cortexService.getEventsSince(this.lastCortexEventId);
    if (events === null) {
      // Cortex DB unavailable — skip silently
      return;
    }
    if (events.length === 0) {
      return;
    }
    for (const event of events) {
      if (event.id > this.lastCortexEventId) {
        this.lastCortexEventId = event.id;
      }
      if (!this.server) continue;
      this.server.emit('cortex-event', event);
    }
    this.logger.debug(`Emitted ${events.length} cortex event(s); lastEventId=${this.lastCortexEventId}`);
  }
}
