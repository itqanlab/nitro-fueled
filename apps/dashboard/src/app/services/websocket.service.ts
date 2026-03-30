import { Injectable, DestroyRef, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import type { CortexEvent, DashboardEvent } from '../models/api.types';

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
  private readonly socket: Socket;

  public readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();
  public readonly cortexEvents$: Observable<CortexEvent> = this.cortexEventsSubject.asObservable();

  constructor() {
    const wsUrl = environment.wsUrl !== '' ? environment.wsUrl : window.location.origin;
    this.socket = io(wsUrl);

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
