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
import { catchError, debounceTime, of, Subject, switchMap, startWith } from 'rxjs';
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

export type LogTab = 'events' | 'workers' | 'sessions' | 'search';

export interface EventFilters {
  sessionId: string;
  taskId: string;
  eventType: string;
  severity: string;
}

// Enriched types for template (no method calls in templates)
interface EnrichedEvent extends CortexEvent {
  typeClass: string;
  formattedData: string;
}

interface EnrichedPhase {
  id: number;
  worker_run_id: string;
  task_id: string;
  phase: string;
  model: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  input_tokens: number;
  output_tokens: number;
  outcome: string | null;
  phaseIdStr: string;
  isExpanded: boolean;
}

interface EnrichedWorker extends CortexWorker {
  statusClass: string;
}

interface EnrichedWorkerDetail {
  worker: EnrichedWorker;
  phases: EnrichedPhase[];
  events: EnrichedEvent[];
  filteredEvents: EnrichedEvent[];
}

interface EnrichedSessionWorker extends CortexWorker {
  statusClass: string;
}

interface EnrichedSessionDetail {
  sessionId: string;
  eventCount: number;
  workerCount: number;
  taskIds: readonly string[];
  startTime: string | null;
  lastActivity: string | null;
  events: EnrichedEvent[];
  workers: EnrichedSessionWorker[];
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
  public readonly searchStartTime = signal('');
  public readonly searchEndTime = signal('');

  public readonly selectedWorkerId = signal('');
  public readonly selectedSessionId = signal('');
  public readonly workerSearchQuery = signal('');

  public readonly liveEvents = signal<CortexEvent[]>([]);
  public readonly isLive = signal(true);
  public readonly expandedPhases = signal<Set<string>>(new Set());

  private readonly workerSelect$ = new Subject<string>();
  private readonly sessionSelect$ = new Subject<string>();
  private readonly search$ = new Subject<string>();

  private readonly eventsRaw = toSignal(
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

  private readonly workerDetailRaw = toSignal(
    this.workerSelect$.pipe(
      switchMap((id) => this.api.getWorkerLogs(id).pipe(catchError(() => of(null as WorkerLogEntry | null)))),
      startWith(null as WorkerLogEntry | null),
    ),
    { initialValue: null as WorkerLogEntry | null },
  );

  private readonly sessionDetailRaw = toSignal(
    this.sessionSelect$.pipe(
      switchMap((id) => this.api.getSessionLogs(id).pipe(catchError(() => of(null as SessionLogSummary | null)))),
      startWith(null as SessionLogSummary | null),
    ),
    { initialValue: null as SessionLogSummary | null },
  );

  public readonly searchResultData = toSignal(
    this.search$.pipe(
      debounceTime(200),
      switchMap((q) => {
        if (!q || q.length < 2) return of(null as LogSearchResult | null);
        return this.api.searchLogs(q, {
          sessionId: this.searchSessionFilter() || undefined,
          taskId: this.searchTaskFilter() || undefined,
          startTime: this.searchStartTime() || undefined,
          endTime: this.searchEndTime() || undefined,
          limit: 100,
        }).pipe(catchError(() => of(null as LogSearchResult | null)));
      }),
      startWith(null as LogSearchResult | null),
    ),
    { initialValue: null as LogSearchResult | null },
  );

  /** Enriched search results with type classes and formatted data. */
  public readonly enrichedSearchResults = computed((): (EnrichedEvent & { session_id: string })[] | null => {
    const raw = this.searchResultData();
    if (!raw) return null;
    return raw.events.map((e) => ({
      ...e,
      typeClass: this.eventTypeClass(e.event_type),
      formattedData: this.formatEventData(e.data),
    }));
  });

  public readonly searchResultTotal = computed(() => this.searchResultData()?.total ?? 0);
  public readonly searchResultQuery = computed(() => this.searchResultData()?.query ?? '');

  /** Unified display events — respects both live mode and active filters. */
  public readonly displayEvents = computed((): EnrichedEvent[] => {
    const base = this.isLive() && this.liveEvents().length > 0
      ? this.liveEvents()
      : this.eventsRaw();
    const filters = this.eventFilters();
    let result = base;

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
        const lower = e.event_type.toLowerCase();
        if (sev === 'error') return dataStr.includes('error') || dataStr.includes('fail') || lower.includes('fail') || lower.includes('error');
        if (sev === 'warning') return dataStr.includes('warn') || lower.includes('warn');
        if (sev === 'info') return !dataStr.includes('error') && !dataStr.includes('fail') && !dataStr.includes('warn');
        return true;
      });
    }

    return result.map((e) => ({
      ...e,
      typeClass: this.eventTypeClass(e.event_type),
      formattedData: this.formatEventData(e.data),
    }));
  });

  public readonly liveCount = computed(() => this.liveEvents().length);

  /** Enriched worker list with status classes precomputed. */
  public readonly enrichedWorkers = computed((): EnrichedWorker[] =>
    this.workersResult().map((w) => ({
      ...w,
      statusClass: this.workerStatusClass(w.status),
    })),
  );

  /** Enriched worker detail — precomputes phase expand state and event formatting. */
  public readonly enrichedWorkerDetail = computed((): EnrichedWorkerDetail | null => {
    const detail = this.workerDetailRaw();
    if (!detail) return null;
    const expanded = this.expandedPhases();
    const wq = this.workerSearchQuery().toLowerCase();

    const allEvents: EnrichedEvent[] = detail.events.map((e) => ({
      ...e,
      typeClass: this.eventTypeClass(e.event_type),
      formattedData: this.formatEventData(e.data),
    }));

    const filteredEvents = wq
      ? allEvents.filter((e) =>
          e.event_type.toLowerCase().includes(wq) ||
          e.formattedData.toLowerCase().includes(wq) ||
          (e.task_id ?? '').toLowerCase().includes(wq),
        )
      : allEvents;

    return {
      worker: { ...detail.worker, statusClass: this.workerStatusClass(detail.worker.status) },
      phases: detail.phases.map((p) => ({
        ...p,
        phaseIdStr: String(p.id),
        isExpanded: expanded.has(String(p.id)),
      })),
      events: allEvents,
      filteredEvents,
    };
  });

  /** Enriched session detail with precomputed event and worker classes. */
  public readonly enrichedSessionDetail = computed((): EnrichedSessionDetail | null => {
    const detail = this.sessionDetailRaw();
    if (!detail) return null;
    return {
      sessionId: detail.sessionId,
      eventCount: detail.eventCount,
      workerCount: detail.workerCount,
      taskIds: detail.taskIds,
      startTime: detail.startTime,
      lastActivity: detail.lastActivity,
      events: detail.events.map((e) => ({
        ...e,
        typeClass: this.eventTypeClass(e.event_type),
        formattedData: this.formatEventData(e.data),
      })),
      workers: detail.workers.map((w) => ({
        ...w,
        statusClass: this.workerStatusClass(w.status),
      })),
    };
  });

  public constructor() {
    // Re-trigger search when query or any filter changes
    effect(() => {
      const q = this.searchQuery();
      this.searchSessionFilter();
      this.searchTaskFilter();
      this.searchStartTime();
      this.searchEndTime();
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
    this.workerSearchQuery.set('');
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

  public togglePhase(phaseIdStr: string): void {
    this.expandedPhases.update((set) => {
      const next = new Set(set);
      if (next.has(phaseIdStr)) next.delete(phaseIdStr);
      else next.add(phaseIdStr);
      return next;
    });
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

  private eventTypeClass(eventType: string): string {
    const lower = eventType.toLowerCase();
    if (lower.includes('fail') || lower.includes('error')) return 'event-type--error';
    if (lower.includes('warn')) return 'event-type--warning';
    if (lower.includes('complete') || lower.includes('success')) return 'event-type--success';
    if (lower.includes('spawn') || lower.includes('start')) return 'event-type--info';
    return 'event-type--default';
  }

  private workerStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'worker-status--running';
      case 'completed': return 'worker-status--completed';
      case 'failed': return 'worker-status--failed';
      default: return 'worker-status--default';
    }
  }

  private formatEventData(data: Record<string, unknown>): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }
}
