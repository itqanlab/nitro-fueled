import type { WorkerRegistry } from '../core/worker-registry.js';
import { isProcessAlive } from '../core/iterm-launcher.js';

export function getWorkerActivityTool(registry: WorkerRegistry) {
  return {
    name: 'get_worker_activity',
    description: 'Get a compact, context-efficient summary of a worker session. Designed to minimize token usage in the orchestrator.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        worker_id: { type: 'string', description: 'Worker ID returned by spawn_worker' },
      },
      required: ['worker_id'],
    },
    handler: async (args: { worker_id: string }) => {
      const w = registry.get(args.worker_id);
      if (!w) {
        return { content: [{ type: 'text', text: `Worker ${args.worker_id} not found.` }] };
      }

      const alive = isProcessAlive(w.pid);
      const elapsed = Math.round((Date.now() - w.started_at) / 60000);
      const STARTUP_GRACE_MS = 300_000;

      const health = !alive ? 'finished'
        : w.tokens.compaction_count >= 2 ? 'COMPACTING'
        : w.tokens.context_percent > 80 ? 'HIGH_CONTEXT'
        : (w.progress.message_count === 0 && Date.now() - w.started_at < STARTUP_GRACE_MS) ? 'STARTING'
        : Date.now() - w.progress.last_action_at > 120_000 ? 'STUCK'
        : 'healthy';

      const recentWrites = w.progress.files_written.slice(-5).map(shortenPath);

      const summary = [
        `${w.label} (${w.status}, ${elapsed}m, ${w.tokens.context_percent}% ctx, $${w.cost.total_usd})`,
        `  Model: ${w.model}`,
        `  Msgs: ${w.progress.message_count} | Tools: ${w.progress.tool_calls} | Compactions: ${w.tokens.compaction_count}`,
        `  Health: ${health}`,
        recentWrites.length > 0 ? `  Recent writes: ${recentWrites.join(', ')}` : '  No files written yet',
        `  Last: ${w.progress.last_action}`,
      ].join('\n');

      return { content: [{ type: 'text', text: summary }] };
    },
  };
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `.../${parts.slice(-2).join('/')}`;
}
