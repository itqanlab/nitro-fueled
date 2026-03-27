import type { DashboardEventBus } from '../events/event-bus.js';
import type { DashboardEvent } from '../events/event-types.js';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export class WebSocketBroadcaster {
  private wss: WebSocketServer | null = null;
  private unsubscribe: (() => void) | null = null;

  public attach(httpServer: Server, eventBus: DashboardEventBus): void {
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    });

    this.wss.on('error', (error) => {
      console.error('[websocket] Error:', error.message);
    });

    this.unsubscribe = eventBus.subscribe((event: DashboardEvent) => {
      this.broadcast(event);
    });
  }

  public close(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close();
      }
      this.wss.close();
      this.wss = null;
    }
  }

  private broadcast(event: DashboardEvent): void {
    if (!this.wss) return;

    const message = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, (err) => {
          if (err) console.error('[websocket] send error:', err.message);
        });
      }
    }
  }
}
