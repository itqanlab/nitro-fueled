import { spawn } from 'node:child_process';

export interface SpawnClaudeOptions {
  cwd: string;
  args: string[];
  label: string;
}

export function spawnClaude({ cwd, args, label }: SpawnClaudeOptions): void {
  console.log(`Starting ${label}: claude ${args.join(' ')}`);
  console.log('');

  const child = spawn('claude', args, { cwd, stdio: 'inherit' });

  const forwardSignal = (signal: NodeJS.Signals): void => {
    child.kill(signal);
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('close', (code) => {
    process.off('SIGINT', forwardSignal);
    process.off('SIGTERM', forwardSignal);

    if (code !== 0) {
      console.error(`${label} exited with code ${String(code ?? 'unknown')}`);
      process.exitCode = 1;
    }
  });

  child.on('error', (err) => {
    process.off('SIGINT', forwardSignal);
    process.off('SIGTERM', forwardSignal);

    console.error(`Failed to start ${label}: ${err.message}`);
    process.exitCode = 1;
  });
}
