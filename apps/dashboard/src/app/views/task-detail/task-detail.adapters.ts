import type {
  FullTaskData,
  CortexTaskTrace,
  CortexTaskContext,
  CortexWorker,
  CortexPhase,
  CortexReview,
  CortexEvent,
  PipelineData,
} from '../../models/api.types';
import type {
  TaskDetailViewModel,
  StatusTransition,
  PhaseTimingEntry,
  WorkerEntry,
  ReviewEntry,
  EventEntry,
} from './task-detail.model';

export function adaptTaskDetail(
  taskId: string,
  taskData: FullTaskData | null,
  traceData: CortexTaskTrace | null,
  contextData: CortexTaskContext | null,
  pipelineData: PipelineData | null,
): TaskDetailViewModel | null {
  if (!taskData && !traceData && !contextData) return null;

  const def = taskData?.definition;
  const registry = taskData?.registryRecord;
  const completion = taskData?.completionReport ?? null;
  const cortexAvailable = traceData !== null || contextData !== null;
  const pipelineAvailable = pipelineData !== null;

  const title = def?.title ?? registry?.description ?? taskId;
  const type = def?.type ?? contextData?.type ?? registry?.type ?? 'FEATURE';
  const priority = def?.priority ?? contextData?.priority ?? 'P2-Medium';
  const complexity = def?.complexity ?? contextData?.complexity ?? 'Medium';
  const status = registry?.status ?? 'CREATED';
  const createdAt = registry?.created ?? contextData?.created_at ?? '';
  const updatedAt = contextData?.updated_at ?? null;
  const description = def?.description ?? contextData?.description ?? '';
  const dependencies = extractDependencies(def?.dependencies ?? [], contextData?.dependencies ?? []);
  const acceptanceCriteria = parseAcceptanceCriteria(def?.acceptanceCriteria ?? [], contextData?.acceptance_criteria ?? '');
  const fileScope = [...(contextData?.file_scope ?? [])];

  const workers = mapWorkers(traceData?.workers ?? []);
  const phases = mapPhases(traceData?.phases ?? []);
  const reviews = mapReviews(traceData?.reviews ?? []);
  const events = mapEvents(traceData?.events ?? []);

  const totalCost = workers.reduce((acc, w) => acc + w.cost, 0);
  const totalInputTokens = workers.reduce((acc, w) => acc + w.inputTokens, 0);
  const totalOutputTokens = workers.reduce((acc, w) => acc + w.outputTokens, 0);

  const statusTransitions = buildStatusTransitions(events, status, createdAt);
  const dependentTasks = findDependentTasks(taskId, events);

  return {
    taskId,
    title,
    type,
    priority,
    complexity,
    status,
    createdAt,
    updatedAt,
    description,
    dependencies,
    dependentTasks,
    acceptanceCriteria,
    fileScope,
    statusTransitions,
    workers,
    phases,
    reviews,
    events,
    completionReport: completion ? {
      filesCreated: [...completion.filesCreated],
      filesModified: [...completion.filesModified],
      findingsFixed: [...completion.findingsFixed],
      rootCause: completion.rootCause ?? null,
      fix: completion.fix ?? null,
      reviewScores: [...completion.reviewScores],
    } : null,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    cortexAvailable,
    pipelineAvailable,
  };
}

function extractDependencies(defDeps: readonly string[], cortexDeps: string[]): string[] {
  const set = new Set<string>();
  for (const d of defDeps) {
    const match = d.match(/TASK_\d{4}_\d{3}/);
    if (match) set.add(match[0]);
  }
  for (const d of cortexDeps) {
    const match = d.match(/TASK_\d{4}_\d{3}/);
    if (match) set.add(match[0]);
  }
  return [...set];
}

function parseAcceptanceCriteria(defCriteria: readonly string[], cortexCriteria: string): string[] {
  if (defCriteria.length > 0) return [...defCriteria];
  if (!cortexCriteria) return [];
  return cortexCriteria
    .split('\n')
    .map(line => line.replace(/^[-*\[\]]|\[.*?\]/g, '').trim())
    .filter(line => line.length > 0);
}

function mapWorkers(workers: CortexWorker[]): WorkerEntry[] {
  return workers.map(w => ({
    id: w.id,
    workerType: w.worker_type,
    label: w.label,
    status: w.status,
    model: w.model,
    provider: w.provider,
    launcher: w.launcher,
    spawnTime: w.spawn_time,
    outcome: w.outcome,
    retryNumber: w.retry_number,
    cost: w.cost,
    inputTokens: w.input_tokens,
    outputTokens: w.output_tokens,
    sessionId: w.session_id,
  }));
}

function mapPhases(phases: CortexPhase[]): PhaseTimingEntry[] {
  return phases.map(p => ({
    phase: p.phase,
    model: p.model,
    durationMinutes: p.duration_minutes,
    inputTokens: p.input_tokens,
    outputTokens: p.output_tokens,
    outcome: p.outcome,
    startTime: p.start_time,
    endTime: p.end_time,
  }));
}

function mapReviews(reviews: CortexReview[]): ReviewEntry[] {
  return reviews.map(r => ({
    id: r.id,
    reviewType: r.review_type,
    score: r.score,
    findingsCount: r.findings_count,
    criticalCount: r.critical_count,
    modelThatBuilt: r.model_that_built,
    modelThatReviewed: r.model_that_reviewed,
  }));
}

function mapEvents(events: CortexEvent[]): EventEntry[] {
  return events.map(e => ({
    id: e.id,
    eventType: e.event_type,
    source: e.source,
    timestamp: e.created_at,
    data: e.data,
  }));
}

function buildStatusTransitions(events: EventEntry[], currentStatus: string, createdAt: string): StatusTransition[] {
  const transitions: StatusTransition[] = [];
  const statusEvents = events.filter(e =>
    e.eventType === 'IN_PROGRESS' ||
    e.eventType === 'IMPLEMENTED' ||
    e.eventType === 'IN_REVIEW' ||
    e.eventType === 'COMPLETE' ||
    e.eventType === 'status'
  );

  let prevStatus = 'CREATED';
  let prevTime = createdAt;

  if (createdAt) {
    transitions.push({
      from: '',
      to: 'CREATED',
      timestamp: createdAt,
      duration: null,
    });
  }

  for (const event of statusEvents) {
    const newStatus = (event.data as Record<string, unknown>)?.['status'] as string ?? event.eventType;
    if (newStatus && newStatus !== prevStatus) {
      const duration = prevTime ? formatDuration(prevTime, event.timestamp) : null;
      transitions.push({
        from: prevStatus,
        to: newStatus,
        timestamp: event.timestamp,
        duration,
      });
      prevStatus = newStatus;
      prevTime = event.timestamp;
    }
  }

  return transitions;
}

function findDependentTasks(taskId: string, events: EventEntry[]): string[] {
  const deps = new Set<string>();
  for (const event of events) {
    const data = event.data;
    if (data && typeof data === 'object' && 'task_id' in data) {
      const tid = data['task_id'] as string;
      if (tid && tid !== taskId && /^TASK_\d{4}_\d{3}$/.test(tid)) {
        deps.add(tid);
      }
    }
  }
  return [...deps];
}

function formatDuration(start: string, end: string): string | null {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(ms) || ms < 0) return null;
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } catch {
    return null;
  }
}
