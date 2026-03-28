import { Injectable, DestroyRef, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import type { DashboardEvent } from '../../../../dashboard-api/src/dashboard/dashboard.types';

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
  private readonly socket: Socket;

  public readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();

  constructor() {
    const wsUrl = environment.wsUrl !== '' ? environment.wsUrl : window.location.origin;
    this.socket = io(wsUrl);

    this.socket.on('dashboard-event', (event: unknown) => {
      if (isDashboardEvent(event)) {
        this.eventsSubject.next(event);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.socket.disconnect();
      this.eventsSubject.complete();
    });
  }
}
