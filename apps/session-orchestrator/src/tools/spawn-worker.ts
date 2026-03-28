import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { WorkerRegistry } from '../core/worker-registry.js';
import type { JsonlWatcher } from '../core/jsonl-watcher.js';
import { launchInIterm } from '../core/iterm-launcher.js';
import { launchWithPrint } from '../core/print-launcher.js';
import { launchWithOpenCode } from '../core/opencode-launcher.js';
import { resolveSessionId, resolveJsonlPath } from '../core/jsonl-watcher.js';
import type { JsonlMessage, Provider } from '../types.js';

const DEFAULT_MODEL = process.env['DEFAULT_MODEL'] ?? 'claude-sonnet-4-6';

export const spawnWorkerSchema = {
  prompt: z.string().describe('Full prompt to send to the worker session'),
  working_directory: z.string().describe('Project directory to run in'),
  label: z.string().describe('Label for the worker (e.g., "TASK_2026_003-FEATURE-BUILD")'),
  model: z.string().optional().describe(`Model to use (default: ${DEFAULT_MODEL})`),
  provider: z.enum(['claude', 'glm', 'opencode']).optional().describe(
    'Provider to use: claude (default), glm (Z.AI via claude CLI), or opencode (single-shot CLI)',
  ),
  auto_close: z.boolean().optional().describe('Auto-kill and close when the worker finishes (default: false)'),
  use_iterm: z.boolean().optional().describe('Launch in a visible iTerm window instead of headless mode (default: false)'),
};

export async function handleSpawnWorker(
  args: {
    prompt: string;
    working_directory: string;
    label: string;
    model?: string;
    provider?: 'claude' | 'glm' | 'opencode';
    auto_close?: boolean;
    use_iterm?: boolean;
  },
  registry: WorkerRegistry,
  watcher: JsonlWatcher,
) {
  const p: Provider = args.provider ?? 'claude';
  const m = args.model ?? DEFAULT_MODEL;

  // Reject incompatible flag combination
  if (args.use_iterm && p === 'opencode') {
    throw new Error('use_iterm=true is incompatible with provider=opencode. OpenCode runs headless only.');
  }

  if (args.use_iterm) {
    // iTerm mode (legacy — visible window)
    const { pid, itermSessionId } = await launchInIterm({
      prompt: args.prompt,
      workingDirectory: args.working_directory,
      label: args.label,
      model: m,
    });

    let sessionId: string | null = null;
    let jsonlPath: string | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      sessionId = resolveSessionId(pid);
      if (sessionId) {
        jsonlPath = resolveJsonlPath(sessionId, args.working_directory);
        if (jsonlPath) break;
      }
    }

    const worker = registry.register({
      label: args.label,
      pid,
      session_id: sessionId ?? `pending-${pid}`,
      jsonl_path: jsonlPath ?? '',
      working_directory: args.working_directory,
      model: m,
      provider: p,
      iterm_session_id: itermSessionId,
      auto_close: args.auto_close ?? false,
      launcher: 'iterm',
    });

    return {
      content: [{
        type: 'text' as const,
        text: [
          'Worker spawned (iTerm):',
          `  ID: ${worker.worker_id}`,
          `  Label: ${args.label}`,
          `  PID: ${pid}`,
          `  Provider: ${p}`,
          `  Session: ${sessionId ?? 'pending'}`,
          `  JSONL: ${jsonlPath ?? 'pending'}`,
          `  Auto-close: ${worker.auto_close ? 'yes' : 'no'}`,
        ].join('\n'),
      }],
    };
  }

  if (p === 'opencode') {
    // OpenCode mode — single-shot headless subprocess
    const workerRef: { id: string } = { id: '' };

    const { pid, logPath } = launchWithOpenCode({
      prompt: args.prompt,
      workingDirectory: args.working_directory,
      label: args.label,
      model: m,
      onMessage: (msg) => {
        if (workerRef.id) watcher.feedMessage(workerRef.id, msg as JsonlMessage);
      },
    });

    const worker = registry.register({
      label: args.label,
      pid,
      session_id: `opencode-${randomUUID()}`,
      jsonl_path: '',
      working_directory: args.working_directory,
      model: m,
      provider: p,
      iterm_session_id: '',
      auto_close: args.auto_close ?? false,
      launcher: 'opencode',
      log_path: logPath,
    });
    workerRef.id = worker.worker_id;

    return {
      content: [{
        type: 'text' as const,
        text: [
          'Worker spawned (opencode):',
          `  ID: ${worker.worker_id}`,
          `  Label: ${args.label}`,
          `  PID: ${pid}`,
          `  Provider: opencode`,
          `  Model: ${m}`,
          `  Log: ${logPath}`,
        ].join('\n'),
      }],
    };
  }

  // Print mode — claude or glm (headless subprocess using claude CLI)
  const printSessionId = `print-${randomUUID()}`;
  const workerRef: { id: string } = { id: '' };

  const { pid, logPath } = launchWithPrint({
    prompt: args.prompt,
    workingDirectory: args.working_directory,
    label: args.label,
    model: m,
    provider: p,
    onMessage: (msg) => {
      if (workerRef.id) watcher.feedMessage(workerRef.id, msg as JsonlMessage);
    },
  });

  const worker = registry.register({
    label: args.label,
    pid,
    session_id: printSessionId,
    jsonl_path: '',
    working_directory: args.working_directory,
    model: m,
    provider: p,
    iterm_session_id: '',
    auto_close: args.auto_close ?? false,
    launcher: 'print',
    log_path: logPath,
  });
  workerRef.id = worker.worker_id;

  return {
    content: [{
      type: 'text' as const,
      text: [
        `Worker spawned (${p}):`,
        `  ID: ${worker.worker_id}`,
        `  Label: ${args.label}`,
        `  PID: ${pid}`,
        `  Provider: ${p}`,
        `  Log: ${logPath}`,
      ].join('\n'),
    }],
  };
}
