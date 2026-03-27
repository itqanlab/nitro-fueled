import type { WorkerRegistry } from '../core/worker-registry.js';
import type { HealthStatus } from '../types.js';
import { isProcessAlive } from '../core/iterm-launcher.js';

export function getWorkerStatsTool(registry: WorkerRegistry) {
  return {
    name: 'get_worker_stats',
    description: 'Get detailed token usage, cost, progress, and health for a specific worker.',
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

      const health = assessHealth(w.pid, w.tokens.context_percent, w.tokens.compaction_count, w.progress.last_action_at, w.progress.message_count, w.started_at);
      const elapsed = Math.round((Date.now() - w.started_at) / 60000);

      const report = [
        `# Worker: ${w.label}`,
        `Status: ${w.status} | Health: ${health}`,
        `Model: ${w.model}`,
        `Elapsed: ${elapsed}m | PID: ${w.pid}`,
        ``,
        `## Tokens`,
        `  Input:          ${w.tokens.total_input.toLocaleString()}`,
        `  Output:         ${w.tokens.total_output.toLocaleString()}`,
        `  Cache Creation: ${w.tokens.total_cache_creation.toLocaleString()}`,
        `  Cache Read:     ${w.tokens.total_cache_read.toLocaleString()}`,
        `  Total:          ${w.tokens.total_combined.toLocaleString()}`,
        `  Context:        ${w.tokens.context_current_k}k (${w.tokens.context_percent}%)`,
        `  Compactions:    ${w.tokens.compaction_count}`,
        ``,
        `## Cost`,
        `  Input:  $${w.cost.input_usd}`,
        `  Output: $${w.cost.output_usd}`,
        `  Cache:  $${w.cost.cache_usd}`,
        `  Total:  $${w.cost.total_usd}`,
        ``,
        `## Progress`,
        `  Messages:    ${w.progress.message_count}`,
        `  Tool Calls:  ${w.progress.tool_calls}`,
        `  Files Read:  ${w.progress.files_read.length}`,
        `  Files Written: ${w.progress.files_written.length}`,
        `  Last Action: ${w.progress.last_action}`,
      ];

      return { content: [{ type: 'text', text: report.join('\n') }] };
    },
  };
}

function assessHealth(pid: number, contextPercent: number, compactions: number, lastActionAt: number, messageCount: number, startedAt: number): HealthStatus {
  const STARTUP_GRACE_MS = 300_000;

  if (!isProcessAlive(pid)) return 'finished';
  if (compactions >= 2) return 'compacting';
  if (contextPercent > 80) return 'high_context';
  if (messageCount === 0 && Date.now() - startedAt < STARTUP_GRACE_MS) return 'starting';
  if (Date.now() - lastActionAt > 120_000) return 'stuck';
  return 'healthy';
}
