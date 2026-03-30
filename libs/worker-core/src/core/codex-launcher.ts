import type { ChildProcess } from 'node:child_process';
import { spawnTrackedProcess, killTrackedProcess } from './process-launcher.js';

export interface CodexLaunchOptions {
  prompt: string;
  workingDirectory: string;
  label: string;
  model: string;
  onMessage?: (msg: Record<string, unknown>) => void;
}

export interface CodexLaunchResult {
  pid: number;
  process: ChildProcess;
  logPath: string;
}

// Track exit codes to distinguish successful completion from process failure
const exitCodes = new Map<number, number>();

export function launchWithCodex(opts: CodexLaunchOptions): CodexLaunchResult {
  const args = ['exec', '--model', opts.model, '--output-format', 'json', opts.prompt];

  return spawnTrackedProcess({
    binary: 'codex',
    args,
    workingDirectory: opts.workingDirectory,
    label: opts.label,
    onMessage: opts.onMessage,
    onExit: (code, _signal, pid) => {
      if (code !== null && pid !== 0) {
        exitCodes.set(pid, code);
        // Prune after 60 s — long enough for callers to read, prevents unbounded growth
        setTimeout(() => exitCodes.delete(pid), 60_000);
      }
    },
  });
}

/**
 * Returns the exit code of a completed codex worker, or null if still running
 * or exit code was not captured. A non-zero exit code indicates failure.
 */
export function getCodexExitCode(pid: number): number | null {
  return exitCodes.get(pid) ?? null;
}

export function killCodexProcess(pid: number): boolean {
  return killTrackedProcess(pid);
}
