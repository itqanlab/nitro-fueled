import { spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';

export type Provider = 'claude' | 'glm' | 'opencode' | 'codex';

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

  const spawnOpts = {
    ...opts,
    prompt: sanitizePromptForProvider(opts.prompt, opts.provider),
  };
  const { binary, args, env } = buildSpawnCommand(spawnOpts);

  let stdoutBuffer = '';

  const child = spawn(binary, args, {
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
      `Failed to spawn '${binary}' process for worker "${opts.label}". Is ${binary} on PATH?`,
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
    // PID is not in our managed process map — do NOT send OS-level signals to
    // unregistered PIDs. The process is already gone or was not spawned by this
    // server instance. Return false to indicate we did not kill anything.
    return false;
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

interface SpawnCommand {
  binary: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export function sanitizePromptForProvider(prompt: string, provider: Provider): string {
  if (provider === 'claude' || provider === 'glm') return prompt;

  return prompt
    .replaceAll('Agent tool', 'launcher-supported sub-agent tool')
    .replaceAll('Agent sub-agents', 'sub-agents')
    .replaceAll('reviewer Agents', 'reviewer sub-agents')
    .replaceAll('All 3 Agents', 'All 3 sub-agents')
    .replaceAll('Spawn a test Agent', 'Spawn a test sub-agent')
    .replaceAll('spawn Agent sub-agents', 'spawn review sub-agents')
    .replaceAll('Use the Agent tool for parallel sub-agents.', 'Use the available sub-agent tool for parallel sub-agents.')
    .replaceAll('Spawn 3 reviewer Agents IN PARALLEL using the Agent tool (NOT MCP spawn_worker):',
      'Spawn 3 reviewer sub-agents in parallel using the available sub-agent tool (NOT MCP spawn_worker):')
    .replaceAll('All 3 Agents run in parallel (single message with 3 Agent tool calls).',
      'All 3 sub-agents run in parallel (single message with 3 sub-agent tool calls).')
    .replaceAll('a. Spawn a test Agent (subagent_type: nitro-senior-tester):',
      'a. Spawn a test sub-agent (use the launcher-supported sub-agent mechanism):')
    .replaceAll('artifacts written by Agent sub-agents in Phase 2,',
      'artifacts written by sub-agents in Phase 2,')
    .replaceAll('3. For any review type not yet complete, spawn Agent sub-agents',
      '3. For any review type not yet complete, spawn review sub-agents')
    .replaceAll('(same as First-Run Phase 2, step 4). Use the Agent tool, NOT MCP.',
      '(same as First-Run Phase 2, step 4). Use the launcher-supported sub-agent mechanism, NOT MCP.')
    .replaceAll('Use the Skill tool', 'Read the referenced instructions directly')
    .replaceAll('using the Skill tool', 'by reading the referenced instructions directly');
}

function buildSpawnCommand(opts: SpawnOptions): SpawnCommand {
  switch (opts.provider) {
    case 'claude':
      return {
        binary: 'claude',
        args: [
          '--print',
          '--dangerously-skip-permissions',
          '--model', opts.model,
          '--output-format', 'stream-json',
          '--verbose',
          opts.prompt,
        ],
        env: buildClaudeEnv(),
      };

    case 'glm':
      return {
        binary: 'claude',
        args: [
          '--print',
          '--dangerously-skip-permissions',
          '--model', opts.model,
          '--output-format', 'stream-json',
          '--verbose',
          opts.prompt,
        ],
        env: buildGlmEnv(opts.glmApiKey ?? ''),
      };

    case 'opencode':
      return {
        binary: 'opencode',
        args: [
          'run',
          '--model', opts.model,
          '--format', 'json',
          '--dir', opts.workingDirectory,
          opts.prompt,
        ],
        env: buildOpenEnv(),
      };

    case 'codex':
      return {
        binary: 'codex',
        args: [
          'exec',
          '--model', opts.model,
          '--json',
          '--dangerously-bypass-approvals-and-sandbox',
          '-C', opts.workingDirectory,
          opts.prompt,
        ],
        env: buildOpenEnv(),
      };
  }
}

/**
 * Builds a minimal environment for the claude CLI.
 * Only forwards essential vars to avoid leaking sensitive environment variables
 * to child processes. Do NOT pass process.env wholesale.
 */
function buildClaudeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const allow = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'ANTHROPIC_API_KEY'];
  for (const key of allow) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

/**
 * Builds environment for opencode/codex CLIs.
 * These read their own config files for API keys, so we forward broader env.
 */
function buildOpenEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const allow = [
    'PATH', 'HOME', 'USER', 'SHELL', 'TERM',
    'OPENAI_API_KEY', 'OPENCODE_SERVER_PASSWORD',
    'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  ];
  for (const key of allow) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
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
