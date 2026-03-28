import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { basicPreflightChecks } from '../utils/preflight.js';
import { spawnClaude } from '../utils/spawn-claude.js';

export default class Create extends BaseCommand {
  public static override description = 'Interactive task creation via Planner or quick form';

  public static override strict = false;

  public static override flags = {
    quick: Flags.boolean({
      description: 'Use /create-task form-based creation instead of Planner discussion',
      default: false,
    }),
  };

  public static override usage = [
    '',
    '"add payment processing"',
    '--quick',
    '--quick "fix login bug"',
  ];

  public static override examples = [
    { description: 'Start Planner discussion', command: '<%= config.bin %> <%= command.id %>' },
    { description: 'Planner with pre-filled intent', command: '<%= config.bin %> <%= command.id %> "add payment processing"' },
    { description: 'Form-based creation', command: '<%= config.bin %> <%= command.id %> --quick' },
    { description: 'Quick creation with description', command: '<%= config.bin %> <%= command.id %> --quick "fix login bug"' },
  ];

  public async run(): Promise<void> {
    const { argv, flags } = await this.parse(Create);
    const cwd = process.cwd();

    if (!basicPreflightChecks(cwd)) {
      process.exitCode = 1;
      return Promise.resolve();
    }

    const description = argv.join(' ');
    const command = flags.quick ? '/create-task' : '/plan';
    const claudePrompt = description.length > 0 ? `${command} ${description}` : command;

    // create runs interactively (no --dangerously-skip-permissions)
    spawnClaude({ cwd, args: ['-p', claudePrompt], label: 'Claude session' });
  }
}
