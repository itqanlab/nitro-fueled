import React, { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { ws } from '../api/socket.js';
import { useDashboardStore } from '../store/index.js';
import type { DashboardEvent, DashboardStats, TaskStatus } from '../types/index.js';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

export function useInitialData(): void {
  const setRegistry = useDashboardStore((s) => s.setRegistry);
  const setPlan = useDashboardStore((s) => s.setPlan);
  const setState = useDashboardStore((s) => s.setState);
  const setLoading = useDashboardStore((s) => s.setLoading);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const loadData = async (): Promise<void> => {
      try {
        const [registry, plan, state] = await Promise.all([
          api.getRegistry(),
          api.getPlan(),
          api.getState(),
        ]);
        setRegistry(registry);
        setPlan(plan);
        setState(state);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();

    // Re-hydrate on WebSocket reconnect so stale state is refreshed.
    const unsubscribeReconnect = ws.onReconnect(() => {
      void loadData();
    });

    return unsubscribeReconnect;
  }, [setRegistry, setPlan, setState, setLoading]);
}

export function useWebSocket(): void {
  const setRegistry = useDashboardStore((s) => s.setRegistry);
  const setPlan = useDashboardStore((s) => s.setPlan);
  const setState = useDashboardStore((s) => s.setState);
  const setTask = useDashboardStore((s) => s.setTask);
  const setTaskReviews = useDashboardStore((s) => s.setTaskReviews);
  const patchTaskStatus = useDashboardStore((s) => s.patchTaskStatus);
  const removeTaskFromRegistry = useDashboardStore((s) => s.removeTaskFromRegistry);
  const removeActiveWorker = useDashboardStore((s) => s.removeActiveWorker);
  const appendLogEntry = useDashboardStore((s) => s.appendLogEntry);

  useEffect(() => {
    ws.connect();

    const unsubscribe = ws.subscribe((event: DashboardEvent) => {
      switch (event.type) {
        case 'task:state_changed': {
          const taskId = event.payload.taskId as string;
          const to = event.payload.to as TaskStatus;
          patchTaskStatus(taskId, to);
          break;
        }
        case 'task:created':
        case 'task:updated':
          // Need full registry — partial payload doesn't carry all fields.
          void api.getRegistry().then(setRegistry).catch(console.error);
          break;
        case 'task:deleted':
          removeTaskFromRegistry(event.payload.taskId as string);
          break;
        case 'worker:spawned':
          // Payload lacks full ActiveWorker fields — need full state.
          void api.getState().then(setState).catch(console.error);
          break;
        case 'worker:completed':
        case 'worker:failed':
          removeActiveWorker(event.payload.workerId as string);
          break;
        case 'worker:progress':
          // No store patch needed — progress data not shown incrementally yet.
          break;
        case 'log:entry': {
          const entry = event.payload as { timestamp: string; event: string };
          appendLogEntry(entry);
          break;
        }
        case 'state:refreshed':
          void api.getState().then(setState).catch(console.error);
          break;
        case 'plan:updated':
          void api.getPlan().then(setPlan).catch(console.error);
          break;
        case 'review:written': {
          const taskId = event.payload.taskId as string;
          if (TASK_ID_RE.test(taskId)) {
            void api.getTask(taskId).then((data) => setTask(taskId, data)).catch(console.error);
            void api.getTaskReviews(taskId).then((reviews) => setTaskReviews(taskId, reviews)).catch(console.error);
          }
          break;
        }
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Stats are polled every 30s — not on every store mutation.
export function useStats(): DashboardStats | null {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);

  useEffect(() => {
    const load = (): void => {
      void api.getStats().then(setStats).catch(console.error);
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return stats;
}
