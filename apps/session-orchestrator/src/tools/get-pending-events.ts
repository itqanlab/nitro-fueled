import type { FileWatcher } from '../core/file-watcher.js';
import type { EventQueue } from '../core/event-queue.js';
import type { WatchEvent, EmittedEvent } from '../types.js';

export const getPendingEventsSchema = {};

/**
 * Drain all pending events from both sources:
 *   - file-watcher events (subscribe_worker conditions)
 *   - emitted events (worker-side emit_event calls)
 *
 * Returns them in a single merged array, oldest first.
 * The `source` field on each event distinguishes origin:
 *   - WatchEvent: source is absent (file-watcher)
 *   - EmittedEvent: source === 'emit_event'
 */
export function handleGetPendingEvents(
  fileWatcher: FileWatcher,
  eventQueue: EventQueue,
): { content: Array<{ type: 'text'; text: string }> } {
  const watchEvents: WatchEvent[] = fileWatcher.drainEvents();
  const emittedEvents: EmittedEvent[] = eventQueue.drain();

  // Merge: file-watcher events first (they represent terminal conditions),
  // then emitted phase events. Supervisor handles duplicates gracefully.
  const events = [...watchEvents, ...emittedEvents];

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ events }),
    }],
  };
}
