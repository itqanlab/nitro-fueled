import type { FileWatcher } from '../core/file-watcher.js';
import type { WatchEvent } from '../types.js';

export const getPendingEventsSchema = {};

export function handleGetPendingEvents(
  fileWatcher: FileWatcher,
): { content: Array<{ type: 'text'; text: string }> } {
  const events: WatchEvent[] = fileWatcher.drainEvents();

  if (events.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ events: [] }),
      }],
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ events }, null, 2),
    }],
  };
}
