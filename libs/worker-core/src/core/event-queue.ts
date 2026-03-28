import type { EmittedEvent } from '../types.js';

const MAX_QUEUE_SIZE = 1_000;

/**
 * In-memory queue for worker-emitted phase-transition events.
 * Events are produced by workers calling the `emit_event` MCP tool
 * and consumed by the supervisor via `get_pending_events`.
 */
export class EventQueue {
  private queue: EmittedEvent[] = [];

  enqueue(event: EmittedEvent): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      process.stderr.write(
        `[event-queue] queue full (${MAX_QUEUE_SIZE}), dropping event ${event.event_label} for ${event.worker_id}\n`,
      );
      return;
    }
    this.queue.push(event);
  }

  /**
   * Drain and return all pending emitted events.
   * Each call removes the returned events from the queue.
   */
  drain(): EmittedEvent[] {
    return this.queue.splice(0);
  }
}
