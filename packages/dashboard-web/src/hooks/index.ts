import React, { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { ws } from '../api/socket.js';
import { useDashboardStore } from '../store/index.js';
import type { DashboardEvent, DashboardStats } from '../types/index.js';

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
  }, [setRegistry, setPlan, setState, setLoading]);
}

export function useWebSocket(): void {
  const setRegistry = useDashboardStore((s) => s.setRegistry);
  const setPlan = useDashboardStore((s) => s.setPlan);
  const setState = useDashboardStore((s) => s.setState);
  const setTask = useDashboardStore((s) => s.setTask);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    ws.connect();

    const unsubscribe = ws.subscribe((event: DashboardEvent) => {
      switch (event.type) {
        case 'task:created':
        case 'task:updated':
        case 'task:state_changed':
          void api.getRegistry().then(setRegistry).catch(console.error);
          break;
        case 'worker:spawned':
        case 'worker:progress':
        case 'worker:completed':
        case 'worker:failed':
        case 'log:entry':
        case 'state:refreshed':
          void api.getState().then(setState).catch(console.error);
          break;
        case 'plan:updated':
          void api.getPlan().then(setPlan).catch(console.error);
          break;
        case 'review:written':
          const taskId = event.payload.taskId as string;
          void api.getTask(taskId).then((data) => setTask(taskId, data)).catch(console.error);
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [setRegistry, setPlan, setState, setTask]);
}

export function useStats(): DashboardStats | null {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);

  useEffect(() => {
    void api.getStats().then(setStats).catch(console.error);
  }, [lastUpdated]);

  return stats;
}
