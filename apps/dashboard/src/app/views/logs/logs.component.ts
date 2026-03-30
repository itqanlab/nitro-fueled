import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of, Subject, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { TabNavComponent, TabItem } from '../../shared/tab-nav/tab-nav.component';
import type {
  CortexEvent,
  CortexSession,
  CortexWorker,
  LogSearchResult,
  WorkerLogEntry,
  SessionLogSummary,
} from '../../models/api.types';

type LogTab = 'events' | 'workers' | 'sessions' | 'search';

interface EventFilters {
  sessionId: string;
  taskId: string;
  eventType: string;
  severity: string;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [DatePipe, NgClass, DecimalPipe, FormsModule, TabNavComponent],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsComponent {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly tabs: TabItem[] = [
    { id: 'events', label: 'Events', icon: '\u{1F4CB}' },
    { id: 'workers', label: 'Workers', icon: '\u{1F477}' },
    { id: 'sessions', label: 'Sessions', icon: '\u{1F4C5}' },
    { id: 'search', label: 'Search', icon: '\u{1F50D}' },
  ];

  public readonly activeTab = signal<LogTab>('events');

  public readonly eventFilters = signal<EventFilters>({
    sessionId: '',
    taskId: '',
    eventType: '',
    severity: '',
  });

  public readonly searchQuery = signal('');
  public readonly searchSessionFilter = signal('');
  public readonly searchTaskFilter = signal('');

  public readonly selectedWorkerId = signal('');
  public readonly selectedSessionId = signal('');

  public readonly liveEvents = signal<CortexEvent[]>([]);
  public readonly isLive = signal(true);

  public readonly expandedPhases = signal<Set<string>>(new Set());

  private readonly workerSelect$ = new Subject<string>();
  private readonly sessionSelect$ = new Subject<string>();
  private readonly search$ = new Subject<string>();

  public readonly eventsResult = toSignal(
    this.api.getLogEvents({ limit: 200 }).pipe(catchError(() => of([] as CortexEvent[]))),
    { initialValue: [] as CortexEvent[] },
  );

  public readonly workersResult = toSignal(
    this.api.getCortexWorkers({}).pipe(catchError(() => of([] as CortexWorker[]))),
    { initialValue: [] as CortexWorker[] },
  );

  public readonly sessionsResult = toSignal(
    this.api.getCortexSessions().pipe(catchError(() => of([] as CortexSession[]))),
    { initialValue: [] as CortexSession[] },
  );

  public readonly workerDetailResult = toSignal(
    this.workerSelect$.pipe(
      switchMap((id) => this.api.getWorkerLogs(id).pipe(catchError(() => of(null as WorkerLogEntry | null)))),
      startWith(null as WorkerLogEntry | null),
    ),
    { initialValue: null as WorkerLogEntry | null },
  );

  public readonly sessionDetailResult = toSignal(
    this.sessionSelect$.pipe(
      switchMap((id) => this.api.getSessionLogs(id).pipe(catchError(() => of(null as SessionLogSummary | null)))),
      startWith(null as SessionLogSummary | null),
    ),
    { initialValue: null as SessionLogSummary | null },
  );

  public readonly searchResultData = toSignal(
    this.search$.pipe(
      switchMap((q) => {
        if (!q || q.length < 2) return of(null as LogSearchResult | null);
        return this.api.searchLogs(q, {
          sessionId: this.searchSessionFilter() || undefined,
          taskId: this.searchTaskFilter() || undefined,
          limit: 100,
        }).pipe(catchError(() => of(null as LogSearchResult | null)));
      }),
      startWith(null as LogSearchResult | null),
    ),
    { initialValue: null as LogSearchResult | null },
  );

  public readonly filteredEvents = computed(() => {
    const events = this.eventsResult();
    const filters = this.eventFilters();
    let result = events;

    if (filters.sessionId) {
      result = result.filter((e) => e.session_id.includes(filters.sessionId));
    }
    if (filters.taskId) {
      result = result.filter((e) => e.task_id?.includes(filters.taskId));
    }
    if (filters.eventType) {
      const et = filters.eventType.toLowerCase();
      result = result.filter((e) => e.event_type.toLowerCase().includes(et));
    }
    if (filters.severity) {
      const sev = filters.severity.toLowerCase();
      result = result.filter((e) => {
        const dataStr = JSON.stringify(e.data).toLowerCase();
        const eventTypeLower = e.event_type.toLowerCase();
        if (sev === 'error') return dataStr.includes('error') || dataStr.includes('fail') || eventTypeLower.includes('fail') || eventTypeLower.includes('error');
        if (sev === 'warning') return dataStr.includes('warn') || eventTypeLower.includes('warn');
        if (sev === 'info') return !dataStr.includes('error') && !dataStr.includes('fail') && !dataStr.includes('warn');
        return true;
      });
    }
    return result;
  });

  public constructor() {
    effect(() => {
      const q = this.searchQuery();
      if (q.length >= 2) {
        this.search$.next(q);
      }
    });

    const sub = this.ws.cortexEvents$.subscribe((event: CortexEvent) => {
      this.liveEvents.update((prev) => [...prev.slice(-499), event]);
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  public updateEventFilter(key: string, value: string): void {
    const current = this.eventFilters();
    this.eventFilters.set({
      sessionId: key === 'sessionId' ? value : current.sessionId,
      taskId: key === 'taskId' ? value : current.taskId,
      eventType: key === 'eventType' ? value : current.eventType,
      severity: key === 'severity' ? value : current.severity,
    });
  }

  public onTabChange(tabId: string): void {
    this.activeTab.set(tabId as LogTab);
  }

  public selectWorker(workerId: string): void {
    this.selectedWorkerId.set(workerId);
    this.workerSelect$.next(workerId);
  }

  public selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    this.sessionSelect$.next(sessionId);
  }

  public toggleLive(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.isLive.set(checked);
  }

  public getEventTypeClass(eventType: string): string {
    const lower = eventType.toLowerCase();
    if (lower.includes('fail') || lower.includes('error')) return 'event-type--error';
    if (lower.includes('warn')) return 'event-type--warning';
    if (lower.includes('complete') || lower.includes('success')) return 'event-type--success';
    if (lower.includes('spawn') || lower.includes('start')) return 'event-type--info';
    return 'event-type--default';
  }

  public getWorkerStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'worker-status--running';
      case 'completed': return 'worker-status--completed';
      case 'failed': return 'worker-status--failed';
      default: return 'worker-status--default';
    }
  }

  public togglePhase(phaseId: string): void {
    this.expandedPhases.update((set) => {
      const next = new Set(set);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  public phaseId(id: number): string {
    return String(id);
  }

  public isPhaseExpanded(phaseId: string): boolean {
    return this.expandedPhases().has(phaseId);
  }

  public formatEventData(data: Record<string, unknown>): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  public trackByEventId(_index: number, event: CortexEvent): number {
    return event.id;
  }

  public trackByWorkerId(_index: number, worker: CortexWorker): string {
    return worker.id;
  }

  public trackBySessionId(_index: number, session: CortexSession): string {
    return session.id;
  }
}
