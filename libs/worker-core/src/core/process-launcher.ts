import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';

export interface SpawnTrackedOptions {
  binary: string;
  args: string[];
  workingDirectory: string;
  label: string;
  env?: NodeJS.ProcessEnv;
  onMessage?: (msg: Record<string, unknown>) => void;
  onExit?: (code: number | null, signal: string | null, pid: number) => void;
}

export interface SpawnTrackedResult {
  pid: number;
  process: ChildProcess;
  logPath: string;
}

const childProcesses = new Map<number, ChildProcess>();

export function spawnTrackedProcess(opts: SpawnTrackedOptions): SpawnTrackedResult {
  const logDir = join(opts.workingDirectory, '.worker-logs');
  mkdirSync(logDir, { recursive: true, mode: 0o700 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = opts.label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const logPath = join(logDir, `${safeLabel}_${timestamp}.log`);

  let stdoutBuffer = '';

  const child = spawn(opts.binary, opts.args, {
    cwd: opts.workingDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: opts.env ?? process.env,
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
          const msg = JSON.parse(trimmed) as Record<string, unknown>;
          opts.onMessage(msg);
        } catch { /* Not valid JSON — skip */ }
      }
    }
  });

  child.stdout?.on('close', () => {
    if (opts.onMessage && stdoutBuffer.trim()) {
      try {
        const msg = JSON.parse(stdoutBuffer.trim()) as Record<string, unknown>;
        opts.onMessage(msg);
      } catch { /* Not valid JSON — ignore */ }
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
      `Failed to spawn '${opts.binary}' process for worker "${opts.label}". Is ${opts.binary} on PATH?`,
    );
  }

  childProcesses.set(child.pid, child);

  return { pid: child.pid, process: child, logPath };
}

export function killTrackedProcess(pid: number): boolean {
  try {
    const child = childProcesses.get(pid);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (!child.killed) child.kill('SIGKILL');
        } catch { /* already dead */ }
      }, 5000);
      childProcesses.delete(pid);
      return true;
    }
    // Fallback: direct process signal
    process.kill(pid, 'SIGTERM');
    setTimeout(() => {
      try {
        process.kill(pid, 0); // check alive
        process.kill(pid, 'SIGKILL');
      } catch { /* already dead */ }
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

// Cleanup all child processes on exit
process.once('exit', () => {
  for (const [, child] of childProcesses) {
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
  }
});
