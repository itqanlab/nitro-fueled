import type { WorkerRegistry } from '../core/worker-registry.js';
import { killProcess, closeItermSession } from '../core/iterm-launcher.js';

export function killWorkerTool(registry: WorkerRegistry) {
  return {
    name: 'kill_worker',
    description: 'Terminate a worker session and close its iTerm pane. Sends SIGTERM, then SIGKILL after 5s if needed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        worker_id: { type: 'string', description: 'Worker ID to terminate' },
        reason: { type: 'string', description: 'Reason for termination (logged)' },
      },
      required: ['worker_id'],
    },
    handler: async (args: { worker_id: string; reason?: string }) => {
      const w = registry.get(args.worker_id);
      if (!w) {
        return { content: [{ type: 'text', text: `Worker ${args.worker_id} not found.` }] };
      }

      const killed = await killProcess(w.pid);
      registry.updateStatus(w.worker_id, 'killed');
      const paneClosed = await closeItermSession(w.iterm_session_id);

      const report = [
        `Worker ${w.label} ${killed ? 'terminated' : 'could not be terminated'}.`,
        `  PID: ${w.pid}`,
        `  Reason: ${args.reason ?? 'manual kill'}`,
        `  Pane closed: ${paneClosed ? 'yes' : 'no'}`,
        `  Final cost: $${w.cost.total_usd}`,
        `  Final tokens: ${w.tokens.total_combined.toLocaleString()}`,
        `  Context was: ${w.tokens.context_percent}%`,
        `  Compactions: ${w.tokens.compaction_count}`,
      ].join('\n');

      return { content: [{ type: 'text', text: report }] };
    },
  };
}
