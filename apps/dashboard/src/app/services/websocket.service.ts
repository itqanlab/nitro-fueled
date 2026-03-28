import { Injectable, DestroyRef, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import type { DashboardEvent } from '../../../../dashboard-api/src/dashboard/dashboard.types';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsSubject = new Subject<DashboardEvent>();
  private readonly socket: Socket;

  readonly events$: Observable<DashboardEvent> = this.eventsSubject.asObservable();

  constructor() {
    const wsUrl = environment.wsUrl || window.location.origin;
    this.socket = io(wsUrl);

    this.socket.on('dashboard-event', (event: DashboardEvent) => {
      this.eventsSubject.next(event);
    });

    this.destroyRef.onDestroy(() => {
      this.socket.disconnect();
      this.eventsSubject.complete();
    });
  }
}
