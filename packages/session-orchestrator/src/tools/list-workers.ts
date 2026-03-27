import type { WorkerRegistry } from '../core/worker-registry.js';

export function listWorkersTool(registry: WorkerRegistry) {
  return {
    name: 'list_workers',
    description: 'List all tracked worker sessions with status, tokens, cost, and health.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status_filter: {
          type: 'string',
          enum: ['active', 'completed', 'failed', 'all'],
          description: 'Filter by status (default: all)',
        },
      },
    },
    handler: async (args: { status_filter?: 'active' | 'completed' | 'failed' | 'all' }) => {
      const workers = registry.list(args.status_filter ?? 'all');

      if (workers.length === 0) {
        return { content: [{ type: 'text', text: 'No workers tracked.' }] };
      }

      const lines = workers.map((w) => {
        const elapsed = Math.round((Date.now() - w.started_at) / 60000);
        return [
          `[${w.status.toUpperCase()}] ${w.label}`,
          `  ID: ${w.worker_id}`,
          `  PID: ${w.pid} | Elapsed: ${elapsed}m`,
          `  Tokens: ${formatK(w.tokens.total_combined)} total | Ctx: ${w.tokens.context_percent}% (${w.tokens.context_current_k}k)`,
          `  Cost: $${w.cost.total_usd} | Compactions: ${w.tokens.compaction_count}`,
          `  Last: ${w.progress.last_action}`,
        ].join('\n');
      });

      return { content: [{ type: 'text', text: lines.join('\n\n') }] };
    },
  };
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return `${n}`;
}
