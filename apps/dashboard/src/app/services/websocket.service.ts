import { Injectable, DestroyRef, inject } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import type { CortexEvent, DashboardEvent } from '../models/api.types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

/** Exponential backoff configuration for socket.io reconnection. */
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;

function isDashboardEvent(value: unknown): value is DashboardEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['type'] === 'string' &&
    typeof (value as Record<string, unknown>)['timestamp'] === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsSubject = new Subject<DashboardEvent>();
  private readonly cortexEventsSubject = new Subject<CortexEvent>();
  private readonly connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  private readonly socket: Socket;

  public readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();
  public readonly cortexEvents$: Observable<CortexEvent> = this.cortexEventsSubject.asObservable();
  /** Emits the current connection state. Replays the last value to new subscribers. */
  public readonly connectionStatus$: Observable<ConnectionStatus> = this.connectionStatusSubject.asObservable();

  constructor() {
    const wsUrl = environment.wsUrl !== '' ? environment.wsUrl : window.location.origin;

    this.socket = io(wsUrl, {
      reconnection: true,
      reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
      reconnectionDelay: RECONNECT_BASE_DELAY_MS,
      reconnectionDelayMax: RECONNECT_MAX_DELAY_MS,
      randomizationFactor: 0.5,
    });

    this.socket.on('connect', () => {
      this.connectionStatusSubject.next('connected');
    });

    this.socket.on('disconnect', () => {
      this.connectionStatusSubject.next('disconnected');
    });

    this.socket.on('reconnect_attempt', () => {
      this.connectionStatusSubject.next('reconnecting');
    });

    this.socket.on('dashboard-event', (event: unknown) => {
      if (isDashboardEvent(event)) {
        this.eventsSubject.next(event);
      }
    });

    this.socket.on('cortex-event', (event: unknown) => {
      if (this.isCortexEvent(event)) {
        this.cortexEventsSubject.next(event);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.socket.disconnect();
      this.eventsSubject.complete();
      this.cortexEventsSubject.complete();
      this.connectionStatusSubject.complete();
    });
  }

  private isCortexEvent(value: unknown): value is CortexEvent {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>)['event_type'] === 'string' &&
      typeof (value as Record<string, unknown>)['created_at'] === 'string'
    );
  }
}
