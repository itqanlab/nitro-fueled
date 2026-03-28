import type { DashboardEvent } from '../types/index.js';

type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

type EventHandler = (event: DashboardEvent) => void;
type StateHandler = (state: WebSocketState) => void;

const DEFAULT_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private handlers: Set<EventHandler> = new Set();
  private stateHandlers: Set<StateHandler> = new Set();
  private reconnectHandlers: Set<() => void> = new Set();
  private state: WebSocketState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = DEFAULT_RECONNECT_DELAY;
  private shouldReconnect = true;
  private hasConnectedBefore = false;

  public constructor(url?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = url ?? `${protocol}//${host}/ws`;
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  public subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    handler(this.state);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  public onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  public getState(): WebSocketState {
    return this.state;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.setState('connected');
      if (this.hasConnectedBefore) {
        this.reconnectHandlers.forEach((h) => h());
      }
      this.hasConnectedBefore = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = DEFAULT_RECONNECT_DELAY;
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected', event.code, event.reason);
      this.ws = null;
      this.setState('disconnected');

      if (this.shouldReconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.setState('error');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DashboardEvent;
        this.notifyHandlers(data);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };
  }

  private setState(newState: WebSocketState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.stateHandlers.forEach((handler) => handler(newState));
  }

  private notifyHandlers(event: DashboardEvent): void {
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('[WebSocket] Handler error:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WebSocket] Max reconnection attempts reached');
      this.setState('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay;
    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 1.5,
        MAX_RECONNECT_DELAY,
      );
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const ws = new WebSocketClient();
