import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Provider = 'claude' | 'glm' | 'opencode';

export interface SpawnOptions {
  prompt: string;
  workingDirectory: string;
  label: string;
  model: string;
  provider: Provider;
  glmApiKey?: string;
  onMessage?: (msg: Record<string, unknown>) => void;
  onExit?: (code: number | null, signal: string | null, pid: number) => void;
}

export interface SpawnResult {
  pid: number;
  logPath: string;
}

const childProcesses = new Map<number, ChildProcess>();

export function spawnWorkerProcess(opts: SpawnOptions): SpawnResult {
  const logDir = join(opts.workingDirectory, '.worker-logs');
  mkdirSync(logDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = opts.label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const logPath = join(logDir, `${safeLabel}_${timestamp}.log`);

  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--model', opts.model,
    '--output-format', 'stream-json',
    '--verbose',
    opts.prompt,
  ];

  const env = opts.provider === 'glm'
    ? buildGlmEnv(opts.glmApiKey ?? '')
    : process.env;

  let stdoutBuffer = '';

  const child = spawn('claude', args, {
    cwd: opts.workingDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env,
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    appendFileSync(logPath, chunk);
    if (opts.onMessage) {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          opts.onMessage(JSON.parse(trimmed) as Record<string, unknown>);
        } catch { /* not valid JSON */ }
      }
    }
  });

  child.stdout?.on('close', () => {
    if (opts.onMessage && stdoutBuffer.trim()) {
      try {
        opts.onMessage(JSON.parse(stdoutBuffer.trim()) as Record<string, unknown>);
      } catch { /* not valid JSON */ }
      stdoutBuffer = '';
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    appendFileSync(logPath, `[STDERR] ${chunk}`);
  });

  child.on('error', (err) => {
    appendFileSync(logPath, `[ERROR] ${err.message}\n`);
  });

  child.on('exit', (code, signal) => {
    appendFileSync(logPath, `\n[EXIT] code=${code} signal=${signal}\n`);
    const pid = child.pid;
    if (pid !== undefined) childProcesses.delete(pid);
    opts.onExit?.(code, signal, pid ?? 0);
  });

  if (!child.pid) {
    throw new Error(
      `Failed to spawn 'claude' process for worker "${opts.label}". Is claude on PATH?`,
    );
  }

  childProcesses.set(child.pid, child);
  return { pid: child.pid, logPath };
}

export function killWorkerProcess(pid: number): boolean {
  try {
    const child = childProcesses.get(pid);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        try { if (!child.killed) child.kill('SIGKILL'); } catch { /* dead */ }
      }, 5000);
      childProcesses.delete(pid);
      return true;
    }
    process.kill(pid, 'SIGTERM');
    setTimeout(() => {
      try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* dead */ }
    }, 5000);
    return true;
  } catch {
    return false;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function resolveGlmApiKey(workingDirectory: string): string | undefined {
  if (process.env['ZAI_API_KEY']) return process.env['ZAI_API_KEY'];

  const configPath = resolve(workingDirectory, '.nitro-fueled', 'config.json');
  if (!existsSync(configPath)) return undefined;

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return undefined;
    const providers = (raw as Record<string, unknown>)['providers'];
    if (typeof providers !== 'object' || providers === null) return undefined;
    const glm = (providers as Record<string, unknown>)['glm'];
    if (typeof glm !== 'object' || glm === null) return undefined;
    const apiKey = (glm as Record<string, unknown>)['apiKey'];
    if (typeof apiKey !== 'string' || apiKey === '') return undefined;

    if (apiKey.startsWith('$')) {
      return process.env[apiKey.slice(1)] ?? undefined;
    }
    return apiKey;
  } catch {
    console.error(`[nitro-cortex] failed to parse ${configPath} for GLM key`);
    return undefined;
  }
}

function buildGlmEnv(apiKey: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
    API_TIMEOUT_MS: '3000000',
  };
}

process.once('exit', () => {
  for (const [, child] of childProcesses) {
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
  }
});
