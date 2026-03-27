import type {
  DashboardEvent,
  TaskRecord,
  OrchestratorState,
} from '../events/event-types.js';

export function diffRegistry(
  oldRecords: ReadonlyArray<TaskRecord>,
  newRecords: ReadonlyArray<TaskRecord>,
): ReadonlyArray<DashboardEvent> {
  const events: DashboardEvent[] = [];
  const now = new Date().toISOString();
  const oldMap = new Map(oldRecords.map((r) => [r.id, r]));
  const newMap = new Map(newRecords.map((r) => [r.id, r]));

  for (const [id, newRecord] of newMap) {
    const oldRecord = oldMap.get(id);
    if (!oldRecord) {
      events.push({
        type: 'task:created',
        timestamp: now,
        payload: { taskId: id, type: newRecord.type },
      });
      continue;
    }

    if (oldRecord.status !== newRecord.status) {
      events.push({
        type: 'task:state_changed',
        timestamp: now,
        payload: {
          taskId: id,
          from: oldRecord.status,
          to: newRecord.status,
        },
      });
    }

    if (oldRecord.description !== newRecord.description || oldRecord.type !== newRecord.type) {
      events.push({
        type: 'task:updated',
        timestamp: now,
        payload: { taskId: id, field: 'description', oldValue: oldRecord.description, newValue: newRecord.description },
      });
    }
  }

  for (const [id, oldRecord] of oldMap) {
    if (!newMap.has(id)) {
      events.push({
        type: 'task:deleted',
        timestamp: now,
        payload: { taskId: id, field: 'deleted', oldValue: oldRecord.status, newValue: null },
      });
    }
  }

  return events;
}

export function diffState(
  oldState: OrchestratorState | null,
  newState: OrchestratorState,
): ReadonlyArray<DashboardEvent> {
  const events: DashboardEvent[] = [];
  const now = new Date().toISOString();

  if (oldState === null) {
    for (const worker of newState.activeWorkers) {
      events.push({
        type: 'worker:spawned',
        timestamp: now,
        payload: {
          workerId: worker.workerId,
          taskId: worker.taskId,
          type: worker.workerType,
        },
      });
    }
    return events;
  }

  const oldWorkerIds = new Set(oldState.activeWorkers.map((w) => w.workerId));
  const newWorkerIds = new Set(newState.activeWorkers.map((w) => w.workerId));

  for (const worker of newState.activeWorkers) {
    if (!oldWorkerIds.has(worker.workerId)) {
      events.push({
        type: 'worker:spawned',
        timestamp: now,
        payload: {
          workerId: worker.workerId,
          taskId: worker.taskId,
          type: worker.workerType,
        },
      });
    }
  }

  for (const worker of oldState.activeWorkers) {
    if (!newWorkerIds.has(worker.workerId)) {
      const completed = newState.completedTasks.find(
        (t) =>
          t.taskId === worker.taskId &&
          !oldState.completedTasks.some((ot) => ot.taskId === t.taskId),
      );
      const failed = newState.failedTasks.find(
        (t) =>
          t.taskId === worker.taskId &&
          !oldState.failedTasks.some((ot) => ot.taskId === t.taskId),
      );

      if (failed) {
        events.push({
          type: 'worker:failed',
          timestamp: now,
          payload: {
            workerId: worker.workerId,
            taskId: worker.taskId,
            reason: failed.reason,
          },
        });
      } else {
        events.push({
          type: 'worker:completed',
          timestamp: now,
          payload: {
            workerId: worker.workerId,
            taskId: worker.taskId,
            finalState: completed ? 'completed' : 'removed',
          },
        });
      }
    }
  }

  if (newState.sessionLog.length > oldState.sessionLog.length) {
    const newEntries = newState.sessionLog.slice(oldState.sessionLog.length);
    for (const entry of newEntries) {
      events.push({
        type: 'log:entry',
        timestamp: now,
        payload: { timestamp: entry.timestamp, event: entry.event },
      });
    }
  }

  return events;
}
