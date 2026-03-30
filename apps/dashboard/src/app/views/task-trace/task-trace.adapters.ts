import type {
  CortexTaskTrace,
  CortexWorker,
  CortexPhase,
  CortexReview,
  CortexFixCycle,
  CortexEvent,
} from '../../models/api.types';
import { mapWorker, mapPhase, mapReview, mapFixCycle } from './task-trace.mappers';
import type {
  TimelineEvent,
  TaskTraceViewModel,
} from './task-trace.model';

export type {
  WorkerRow,
  PhaseRow,
  ReviewRow,
  FixCycleRow,
  TimelineEvent,
  TaskTraceViewModel,
} from './task-trace.model';

function buildTimeline(
  workers: CortexWorker[],
  phases: CortexPhase[],
  reviews: CortexReview[],
  fixCycles: CortexFixCycle[],
  events: CortexEvent[],
): TimelineEvent[] {
  const timed: Array<{ time: string; event: TimelineEvent }> = [];

  for (const w of workers) {
    timed.push({
      time: w.spawn_time,
      event: {
        time: w.spawn_time,
        label: `Worker spawned: ${w.label}`,
        type: 'worker',
        detail: `${w.worker_type} — ${w.model} via ${w.launcher}`,
        cost: w.cost,
        tokens: w.input_tokens + w.output_tokens,
      },
    });
  }

  for (const p of phases) {
    timed.push({
      time: p.start_time,
      event: {
        time: p.start_time,
        label: `Phase: ${p.phase}`,
        type: 'phase',
        detail: `${p.model} — ${p.duration_minutes != null ? p.duration_minutes.toFixed(1) + ' min' : 'in progress'}`,
        tokens: p.input_tokens + p.output_tokens,
      },
    });
  }

  for (const e of (events ?? [])) {
    timed.push({
      time: e.created_at,
      event: {
        time: e.created_at,
        label: `Event: ${e.event_type.slice(0, 80)}`,
        type: 'event',
        detail: `source: ${e.source.slice(0, 80)}`,
      },
    });
  }

  timed.sort((a, b) => a.time.localeCompare(b.time));
  const result: TimelineEvent[] = timed.map(t => t.event);

  for (const r of [...reviews].sort((a, b) => a.id - b.id)) {
    result.push({
      time: null,
      label: `Review: ${r.review_type}`,
      type: 'review',
      detail: `score ${r.score} — ${r.findings_count} findings, ${r.critical_count} critical`,
    });
  }

  for (const f of [...fixCycles].sort((a, b) => a.id - b.id)) {
    result.push({
      time: null,
      label: 'Fix Cycle',
      type: 'fix',
      detail: `applied: ${f.fixes_applied}, skipped: ${f.fixes_skipped}, manual: ${f.required_manual}`,
    });
  }

  return result;
}

export function adaptTaskTrace(raw: CortexTaskTrace | null): TaskTraceViewModel | null {
  if (!raw) return null;
  return {
    taskId: raw.task_id,
    workers: raw.workers.map(mapWorker),
    phases: raw.phases.map(mapPhase),
    reviews: raw.reviews.map(mapReview),
    fixCycles: raw.fix_cycles.map(mapFixCycle),
    timelineEvents: buildTimeline(
      raw.workers,
      raw.phases,
      raw.reviews,
      raw.fix_cycles,
      raw.events,
    ),
  };
}
