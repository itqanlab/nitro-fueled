import type { DashboardEvent } from './event-types.js';

export interface DashboardEventBus {
  emit(event: DashboardEvent): void;
  subscribe(handler: (event: DashboardEvent) => void): () => void;
}

export function createEventBus(): DashboardEventBus {
  const handlers = new Set<(event: DashboardEvent) => void>();

  return {
    emit(event: DashboardEvent): void {
      for (const handler of handlers) {
        handler(event);
      }
    },
    subscribe(handler: (event: DashboardEvent) => void): () => void {
      handlers.add(handler);
      return () => { handlers.delete(handler); };
    },
  };
}
