import React, { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { ws } from '../api/socket.js';
import { useDashboardStore } from '../store/index.js';
import type { DashboardEvent, DashboardStats, TaskStatus, SessionData } from '../types/index.js';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

export function useInitialData(): void {
  const setRegistry = useDashboardStore((s) => s.setRegistry);
  const setPlan = useDashboardStore((s) => s.setPlan);
  const setState = useDashboardStore((s) => s.setState);
  const setLoading = useDashboardStore((s) => s.setLoading);
  const setSessions = useDashboardStore((s) => s.setSessions);
  const setSelectedSession = useDashboardStore((s) => s.setSelectedSession);
  const setSessionData = useDashboardStore((s) => s.setSessionData);
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

        const sessions = await api.getSessions();
        setSessions(sessions);

        // Auto-select most recent active session, or most recent overall.
        const activeOnes = sessions.filter((s) => s.isActive);
        const defaultSession = activeOnes[0] ?? sessions[0] ?? null;
        if (defaultSession) {
          setSelectedSession(defaultSession.sessionId);
          try {
            const data = await api.getSession(defaultSession.sessionId);
            setSessionData(defaultSession.sessionId, data);
          } catch (err) {
            console.error('Failed to load default session data:', err);
          }
        }
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
  }, [setRegistry, setPlan, setState, setLoading, setSessions, setSelectedSession, setSessionData]);
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
  const setSessions = useDashboardStore((s) => s.setSessions);
  const setSessionData = useDashboardStore((s) => s.setSessionData);

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
        case 'sessions:changed':
          void api.getSessions().then(setSessions).catch(console.error);
          break;
        case 'session:updated': {
          const sessionId = event.payload.sessionId as string;
          // Read selectedSessionId fresh at event time to avoid stale closures.
          const currentSelectedId = useDashboardStore.getState().selectedSessionId;
          if (sessionId === currentSelectedId) {
            void api.getSession(sessionId).then((d: SessionData) => setSessionData(sessionId, d)).catch(console.error);
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

export function useSessionData(): SessionData | null {
  return useDashboardStore((s) => {
    const id = s.selectedSessionId;
    return id ? (s.sessionData.get(id) ?? null) : null;
  });
}
