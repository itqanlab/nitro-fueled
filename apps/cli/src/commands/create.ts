import { resolve } from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { basicPreflightChecks } from '../utils/preflight.js';
import { spawnClaude } from '../utils/spawn-claude.js';
import { estimateComplexity, resolveProviderForTier } from '../utils/complexity-estimator.js';
import type { LauncherName } from '../utils/provider-config.js';
import { readConfig } from '../utils/provider-config.js';

function getNextTaskId(db: import('better-sqlite3').Database): string {
  const row = db.prepare("SELECT id FROM tasks ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
  if (row === undefined) return 'TASK_2026_001';
  const match = row.id.match(/^TASK_(\d{4})_(\d{3})$/);
  if (match === null) return 'TASK_2026_001';
  const year = parseInt(match[1]!, 10);
  const seq = parseInt(match[2]!, 10) + 1;
  if (seq > 999) return `TASK_${year + 1}_001`;
  return `TASK_${year}_${seq.toString().padStart(3, '0')}`;
}

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

    if (flags.quick && description.length > 0) {
      const dbPath = resolve(cwd, '.nitro', 'cortex.db');
      try {
        const { initCortexDatabase } = await import('../utils/cortex-db-init.js');
        const { db } = initCortexDatabase(dbPath);
        try {
          const taskId = getNextTaskId(db);
          const now = new Date().toISOString();
          db.prepare(
            `INSERT INTO tasks (id, title, type, priority, status, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(taskId, description, 'FEATURE', 'P2-Medium', 'CREATED', description, now, now);
          this.log(`CREATED ${taskId} — ${description}`);
          this.log(`  Run \`npx nitro-fueled run ${taskId}\` to start implementation.`);
        } finally {
          db.close();
        }
        return Promise.resolve();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
        this.warn(`DB unavailable (${msg}). Falling back to Claude session.`);
      }
    }

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
