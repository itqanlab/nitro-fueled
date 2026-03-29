import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { WorkerRegistry, JsonlWatcher, JsonlMessage, Provider } from '@nitro-fueled/worker-core';
import {
  launchInIterm,
  launchWithPrint,
  launchWithOpenCode,
  launchWithCodex,
  resolveSessionId,
  resolveJsonlPath,
  readProviderConfig,
  resolveProviderForSpawn,
} from '@nitro-fueled/worker-core';

const DEFAULT_MODEL = process.env['DEFAULT_MODEL'] ?? 'claude-sonnet-4-6';

export const spawnWorkerSchema = {
  prompt: z.string().describe('Full prompt to send to the worker session'),
  working_directory: z.string().describe('Project directory to run in'),
  label: z.string().describe('Label for the worker (e.g., "TASK_2026_003-FEATURE-BUILD")'),
  model: z.string().max(256).optional().describe(`Model to use (default: ${DEFAULT_MODEL})`),
  provider: z.enum(['claude', 'glm', 'opencode', 'codex']).optional().describe(
    'Provider to use: claude (default), glm (Z.AI via claude CLI), opencode (single-shot CLI), or codex',
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
    provider?: 'claude' | 'glm' | 'opencode' | 'codex';
    auto_close?: boolean;
    use_iterm?: boolean;
  },
  registry: WorkerRegistry,
  watcher: JsonlWatcher,
) {
  let p: Provider = args.provider ?? 'claude';
  let m = args.model ?? DEFAULT_MODEL;

  // Phase 2 re-validation: check launcher availability and run fallback chain if needed.
  // Runs whenever provider is specified (model is optional — DEFAULT_MODEL is used as the check input).
  if (args.provider !== undefined) {
    const modelToCheck = args.model ?? DEFAULT_MODEL;
    const config = readProviderConfig(args.working_directory);
    if (config !== null) {
      const resolved = resolveProviderForSpawn(args.provider, modelToCheck, config);
      if (resolved === null) {
        throw new Error(
          `SPAWN ABORTED — ${args.label.slice(0, 100)}: provider ${args.provider} unavailable and no fallback could be resolved.`,
        );
      }
      const providerChanged = resolved.providerName !== args.provider;
      const modelChanged = resolved.model !== modelToCheck;
      if (providerChanged || modelChanged) {
        console.log(
          `SPAWN FALLBACK — ${args.label.slice(0, 100)}: ${args.provider}/${modelToCheck.slice(0, 100)} unavailable, trying ${resolved.providerName.slice(0, 100)}/${resolved.model.slice(0, 100)}`,
        );
      }
      if (providerChanged) {
        // Provider changed (fallback) — map resolved launcher to Provider type
        if (resolved.launcher === 'opencode') {
          p = 'opencode';
        } else if (resolved.launcher === 'codex') {
          p = 'codex';
        } else {
          // launcher === 'claude' — use generic claude (anthropic or any claude-launcher provider)
          p = 'claude';
        }
      }
      // If provider did not change, preserve original p (important for 'glm' — uses claude launcher
      // but needs distinct provider type for GLM env var injection in launchWithPrint)
      m = resolved.model;
    }
  }

  // Reject incompatible flag combination
  if (args.use_iterm && (p === 'opencode' || p === 'codex')) {
    throw new Error(`use_iterm=true is incompatible with provider=${p}. ${p} runs headless only.`);
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

  if (p === 'codex') {
    // Codex mode — single-shot headless subprocess
    const workerRef: { id: string } = { id: '' };

    const { pid, logPath } = launchWithCodex({
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
      session_id: `codex-${randomUUID()}`,
      jsonl_path: '',
      working_directory: args.working_directory,
      model: m,
      provider: p,
      iterm_session_id: '',
      auto_close: args.auto_close ?? false,
      launcher: 'codex',
      log_path: logPath,
    });
    workerRef.id = worker.worker_id;

    return {
      content: [{
        type: 'text' as const,
        text: [
          'Worker spawned (codex):',
          `  ID: ${worker.worker_id}`,
          `  Label: ${args.label}`,
          `  PID: ${pid}`,
          `  Provider: codex`,
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
