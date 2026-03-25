import { create } from 'zustand';
import type { TaskRecord, PlanData, OrchestratorState, FullTaskData } from '../types/index.js';

interface DashboardState {
  registry: readonly TaskRecord[];
  plan: PlanData | null;
  state: OrchestratorState | null;
  tasks: Map<string, FullTaskData>;
  isLoading: boolean;
  lastUpdated: number;
  setRegistry: (tasks: readonly TaskRecord[]) => void;
  setPlan: (plan: PlanData | null) => void;
  setState: (state: OrchestratorState | null) => void;
  setTask: (taskId: string, data: FullTaskData) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  registry: [],
  plan: null,
  state: null,
  tasks: new Map(),
  isLoading: true,
  lastUpdated: Date.now(),
  setRegistry: (registry) =>
    set({ registry, lastUpdated: Date.now() }),
  setPlan: (plan) => set({ plan, lastUpdated: Date.now() }),
  setState: (state) => set({ state, lastUpdated: Date.now() }),
  setTask: (taskId, data) =>
    set((prev) => {
      const tasks = new Map(prev.tasks);
      tasks.set(taskId, data);
      return { tasks, lastUpdated: Date.now() };
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
