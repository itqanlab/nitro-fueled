import { z } from 'zod';
import type { FileWatcher } from '../core/file-watcher.js';
import type { WorkerRegistry } from '../core/worker-registry.js';

const watchConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file_value'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory'),
    value: z.string().max(500).describe('File content (trimmed) must equal this value'),
    event_label: z.string().regex(/^[A-Z0-9_]{1,64}$/).describe('Label included in the emitted event — uppercase alphanumeric and underscores only'),
  }),
  z.object({
    type: z.literal('file_contains'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory'),
    contains: z.string().min(1).max(500).describe('File content must contain this substring'),
    event_label: z.string().regex(/^[A-Z0-9_]{1,64}$/).describe('Label included in the emitted event — uppercase alphanumeric and underscores only'),
  }),
  z.object({
    type: z.literal('file_exists'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory — fires when file is created or modified'),
    event_label: z.string().regex(/^[A-Z0-9_]{1,64}$/).describe('Label included in the emitted event — uppercase alphanumeric and underscores only'),
  }),
]);

export const subscribeWorkerSchema = {
  worker_id: z.string().describe('Worker ID returned by spawn_worker'),
  conditions: z.array(watchConditionSchema).min(1).max(20).describe(
    'One or more watch conditions — first condition satisfied triggers completion. Paths are relative to the worker\'s registered working_directory.',
  ),
};

export async function handleSubscribeWorker(
  args: {
    worker_id: string;
    conditions: z.infer<typeof watchConditionSchema>[];
  },
  fileWatcher: FileWatcher,
  registry: WorkerRegistry,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const worker = registry.get(args.worker_id);
  if (!worker) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ subscribed: false, error: `Worker ${args.worker_id} not found in registry.`, watched_paths: [] }),
      }],
    };
  }

  let watchedPaths: string[];
  try {
    // Always use the worker's registered working_directory — never the caller's input.
    watchedPaths = fileWatcher.subscribe(args.worker_id, worker.working_directory, args.conditions);
  } catch (err) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ subscribed: false, error: String(err), watched_paths: [] }),
      }],
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ subscribed: true, watched_paths: watchedPaths }),
    }],
  };
}
