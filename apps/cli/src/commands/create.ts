import type { Command } from 'commander';
import { basicPreflightChecks } from '../utils/preflight.js';
import { spawnClaude } from '../utils/spawn-claude.js';

interface CreateOptions {
  quick: boolean;
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

      if (!basicPreflightChecks(cwd)) {
        process.exitCode = 1;
        return;
      }

      const description = descriptionParts.join(' ');
      const command = opts.quick ? '/create-task' : '/plan';
      const prompt = description.length > 0 ? `${command} ${description}` : command;

      // create runs interactively (no --dangerously-skip-permissions)
      spawnClaude({ cwd, args: ['-p', prompt], label: 'Claude session' });
    });
}
