import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Command } from 'commander';

interface CreateOptions {
  quick: boolean;
}

function isClaudeAvailable(): boolean {
  try {
    execSync('command -v claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isWorkspaceInitialized(cwd: string): boolean {
  const claudeDir = resolve(cwd, '.claude');
  const taskTrackingDir = resolve(cwd, 'task-tracking');

  if (!existsSync(claudeDir)) {
    console.error('Error: .claude/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return false;
  }

  if (!existsSync(taskTrackingDir)) {
    console.error('Error: task-tracking/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return false;
  }

  return true;
}

function spawnClaudeSession(cwd: string, prompt: string): void {
  console.log(`Starting Claude session: claude -p "${prompt}"`);
  console.log('');

  const child = spawn(
    'claude',
    ['-p', prompt],
    {
      cwd,
      stdio: 'inherit',
    }
  );

  const forwardSignal = (signal: NodeJS.Signals): void => {
    child.kill(signal);
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('close', (code) => {
    process.off('SIGINT', forwardSignal);
    process.off('SIGTERM', forwardSignal);

    if (code !== 0) {
      console.error(`Claude session exited with code ${String(code ?? 'unknown')}`);
      process.exitCode = 1;
    }
  });

  child.on('error', (err) => {
    process.off('SIGINT', forwardSignal);
    process.off('SIGTERM', forwardSignal);

    console.error(`Failed to start Claude session: ${err.message}`);
    process.exitCode = 1;
  });
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create [description...]')
    .description('Interactive task creation via Planner or quick form')
    .option('--quick', 'Use /create-task form-based creation instead of Planner discussion', false)
    .addHelpText('after', `
Examples:
  npx nitro-fueled create                              Start Planner discussion
  npx nitro-fueled create "add payment processing"     Planner with pre-filled intent
  npx nitro-fueled create --quick                      Form-based creation
  npx nitro-fueled create --quick "fix login bug"      Quick creation with description`)
    .action((descriptionParts: string[], opts: CreateOptions) => {
      const cwd = process.cwd();

      if (!isWorkspaceInitialized(cwd)) {
        process.exitCode = 1;
        return;
      }

      if (!isClaudeAvailable()) {
        console.error('Error: Claude Code CLI not found on PATH.');
        console.error('Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code');
        process.exitCode = 1;
        return;
      }

      const description = descriptionParts.join(' ');
      const command = opts.quick ? '/create-task' : '/plan';
      const prompt = description.length > 0 ? `${command} ${description}` : command;

      spawnClaudeSession(cwd, prompt);
    });
}
