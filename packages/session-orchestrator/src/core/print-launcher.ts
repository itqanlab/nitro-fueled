import type { ChildProcess } from 'node:child_process';
import { spawnTrackedProcess, killTrackedProcess } from './process-launcher.js';
import type { Provider } from '../types.js';

export interface PrintLaunchOptions {
  prompt: string;
  workingDirectory: string;
  label: string;
  model: string;
  provider?: Provider;
  onMessage?: (msg: Record<string, unknown>) => void;
}

export interface PrintLaunchResult {
  pid: number;
  process: ChildProcess;
  logPath: string;
}

export function launchWithPrint(opts: PrintLaunchOptions): PrintLaunchResult {
  if (opts.provider === 'glm' && !process.env['ZAI_API_KEY']) {
    throw new Error('ZAI_API_KEY is not set. Cannot spawn GLM worker.');
  }

  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--model', opts.model,
    '--output-format', 'stream-json',
    '--verbose',
    opts.prompt,
  ];

  const env = opts.provider === 'glm' ? buildGlmEnv() : process.env;

  return spawnTrackedProcess({
    binary: 'claude',
    args,
    workingDirectory: opts.workingDirectory,
    label: opts.label,
    env,
    onMessage: opts.onMessage,
  });
}

function buildGlmEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: process.env['ZAI_API_KEY'],
    ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
    API_TIMEOUT_MS: '3000000',
  };
}

export function killPrintProcess(pid: number): boolean {
  return killTrackedProcess(pid);
}
