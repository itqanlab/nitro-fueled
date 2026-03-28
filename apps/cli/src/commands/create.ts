import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { basicPreflightChecks } from '../utils/preflight.js';
import { spawnClaude } from '../utils/spawn-claude.js';
import { estimateComplexity } from '../utils/complexity-estimator.js';

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

    let claudePrompt: string;
    if (flags.quick) {
      if (description.length > 0) {
        const estimate = estimateComplexity(description);
        const tierNote = `\n\nAuto-estimated preferred_tier: ${estimate.preferredTier} (confidence: ${estimate.confidence}${estimate.signals.length > 0 ? `, signals: ${estimate.signals.join(', ')}` : ''}). Include \`| preferred_tier | ${estimate.preferredTier} |\` in the task.md Metadata table — do not prompt the user for this value.`;
        claudePrompt = `/create-task ${description}${tierNote}`;
      } else {
        claudePrompt = '/create-task';
      }
    } else {
      claudePrompt = description.length > 0 ? `/plan ${description}` : '/plan';
    }

    spawnClaude({ cwd, args: ['-p', claudePrompt], label: 'Claude session' });
  }
}
