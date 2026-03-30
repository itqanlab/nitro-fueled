import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { basicPreflightChecks } from '../utils/preflight.js';
import { spawnClaude } from '../utils/spawn-claude.js';
import { estimateComplexity, resolveProviderForTier } from '../utils/complexity-estimator.js';
import type { LauncherName } from '../utils/provider-config.js';
import { readConfig } from '../utils/provider-config.js';

// Allowlist guards — config values embedded in Claude prompt must be safe strings
const PROVIDER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MODEL_RE = /^[a-zA-Z0-9._/-]{1,128}$/;
const VALID_LAUNCHERS = new Set<LauncherName>(['claude', 'opencode', 'codex']);

function isSafeProviderValue(providerName: string, model: string, launcher: LauncherName): boolean {
  return PROVIDER_NAME_RE.test(providerName) && MODEL_RE.test(model) && VALID_LAUNCHERS.has(launcher);
}

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
        let tierNote = `\n\nAuto-estimated preferred_tier: ${estimate.preferredTier} (confidence: ${estimate.confidence}${estimate.signals.length > 0 ? `, signals: ${estimate.signals.join(', ')}` : ''}). Include \`| preferred_tier | ${estimate.preferredTier} |\` in the task.md Metadata table — do not prompt the user for this value.`;

        const config = readConfig(cwd);
        if (config !== null) {
          const resolved = resolveProviderForTier(estimate.preferredTier, config);
          if (resolved !== null && isSafeProviderValue(resolved.providerName, resolved.model, resolved.launcher)) {
            tierNote += `\n\nProvider suggestion: ${resolved.providerName} / ${resolved.model} (launcher: ${resolved.launcher}). Include \`| Provider | ${resolved.providerName} |\` and \`| Model | ${resolved.model} |\` in the task.md Metadata table.`;
          }
        }

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
