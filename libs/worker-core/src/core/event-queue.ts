import type { EmittedEvent } from '../types.js';

const MAX_QUEUE_SIZE = 1_000;

/**
 * In-memory queue for worker-emitted phase-transition events.
 * Events are produced by workers calling the `emit_event` MCP tool
 * and consumed by the supervisor via `get_pending_events`.
 */
export class EventQueue {
  private queue: EmittedEvent[] = [];

  public enqueue(event: EmittedEvent): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      const safeLabel = event.event_label.replace(/[\r\n\x1b]/g, '<LF>');
      const safeId = event.worker_id.replace(/[\r\n\x1b]/g, '<LF>');
      process.stderr.write(
        `[event-queue] queue full (${MAX_QUEUE_SIZE}), dropping event ${safeLabel} for ${safeId}\n`,
      );
      return;
    }
    this.queue.push(event);
  }

  /**
   * Drain and return all pending emitted events.
   * Each call removes the returned events from the queue.
   */
  public drain(): EmittedEvent[] {
    return this.queue.splice(0);
  }
}
