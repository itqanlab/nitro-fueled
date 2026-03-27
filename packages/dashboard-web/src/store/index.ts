import { create } from 'zustand';
import type {
  TaskRecord,
  TaskStatus,
  PlanData,
  OrchestratorState,
  FullTaskData,
  ReviewData,
  SessionSummary,
  SessionData,
} from '../types/index.js';

interface DashboardState {
  registry: readonly TaskRecord[];
  plan: PlanData | null;
  state: OrchestratorState | null;
  tasks: Map<string, FullTaskData>;
  reviews: Map<string, readonly ReviewData[]>;
  isLoading: boolean;
  lastUpdated: number;

  // Full replacements (initial hydration + plan:updated)
  setRegistry: (tasks: readonly TaskRecord[]) => void;
  setPlan: (plan: PlanData | null) => void;
  setState: (state: OrchestratorState | null) => void;
  setTask: (taskId: string, data: FullTaskData) => void;
  setTaskReviews: (taskId: string, reviews: readonly ReviewData[]) => void;
  setLoading: (loading: boolean) => void;

  // Sessions slice
  sessions: readonly SessionSummary[];
  selectedSessionId: string | null;
  sessionData: Map<string, SessionData>;
  setSessions: (sessions: readonly SessionSummary[]) => void;
  setSelectedSession: (id: string | null) => void;
  setSessionData: (id: string, data: SessionData) => void;

  // Incremental patches (WebSocket events)
  patchTaskStatus: (taskId: string, status: TaskStatus) => void;
  removeTaskFromRegistry: (taskId: string) => void;
  removeActiveWorker: (workerId: string) => void;
  appendLogEntry: (entry: { timestamp: string; event: string }) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  registry: [],
  plan: null,
  state: null,
  tasks: new Map(),
  reviews: new Map(),
  isLoading: true,
  lastUpdated: Date.now(),
  sessions: [],
  selectedSessionId: null,
  sessionData: new Map(),

  setRegistry: (registry) => set({ registry, lastUpdated: Date.now() }),
  setPlan: (plan) => set({ plan, lastUpdated: Date.now() }),
  setState: (state) => set({ state, lastUpdated: Date.now() }),
  setTask: (taskId, data) =>
    set((prev) => {
      const tasks = new Map(prev.tasks);
      tasks.set(taskId, data);
      return { tasks, lastUpdated: Date.now() };
    }),
  setTaskReviews: (taskId, reviews) =>
    set((prev) => {
      const map = new Map(prev.reviews);
      map.set(taskId, reviews);
      return { reviews: map };
    }),
  setLoading: (isLoading) => set({ isLoading }),

  setSessions: (sessions) => set({ sessions, lastUpdated: Date.now() }),
  setSelectedSession: (id) => set({ selectedSessionId: id }),
  setSessionData: (id, data) =>
    set((prev) => {
      const sessionData = new Map(prev.sessionData);
      sessionData.set(id, data);
      return { sessionData };
    }),

  patchTaskStatus: (taskId, status) =>
    set((prev) => ({
      registry: prev.registry.map((t) =>
        t.id === taskId ? { ...t, status } : t,
      ),
    })),

  removeTaskFromRegistry: (taskId) =>
    set((prev) => ({
      registry: prev.registry.filter((t) => t.id !== taskId),
    })),

  removeActiveWorker: (workerId) =>
    set((prev) => {
      if (!prev.state) return {};
      return {
        state: {
          ...prev.state,
          activeWorkers: prev.state.activeWorkers.filter(
            (w) => w.workerId !== workerId,
          ),
        },
      };
    }),

  appendLogEntry: (entry) =>
    set((prev) => {
      if (!prev.state) return {};
      return {
        state: {
          ...prev.state,
          sessionLog: [...prev.state.sessionLog, entry],
        },
      };
    }),
}));
