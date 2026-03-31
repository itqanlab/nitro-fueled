import { BaseCommand } from '../base-command.js';
import { logger } from '../utils/logger.js';
import { runCortexStep } from '../utils/cortex-hydrate.js';

export default class DbRebuild extends BaseCommand {
  public static override description = 'Drop and re-hydrate cortex DB from task-tracking files';

  public async run(): Promise<void> {
    const cwd = process.cwd();
    logger.log('');
    logger.log('nitro-fueled db:rebuild');
    logger.log('=======================');
    logger.log('');
    logger.log('Rebuilding cortex database from files...');
    logger.log('(sessions and workers tables are preserved)');
    logger.log('');

    const result = runCortexStep(cwd, 'rebuild');
    if (result === null) {
      logger.error('Error: Could not open cortex database.');
      process.exitCode = 1;
      return;
    }

    if (result.migrationsApplied > 0) {
      logger.log(`Applied:  ${result.migrationsApplied} schema migration${result.migrationsApplied !== 1 ? 's' : ''}`);
    }
    logger.log(`Imported: ${result.tasks.imported} tasks, ${result.sessions.imported} sessions, ${result.handoffs.imported} handoffs`);
    if (result.tasks.skipped > 0) {
      logger.log(`Skipped:  ${result.tasks.skipped} task folders (missing task.md)`);
    }
    if (result.tasks.errors.length > 0) {
      logger.log('Warnings:');
      for (const e of result.tasks.errors) {
        logger.warn(`  ${e}`);
      }
    }
    logger.log('');
    logger.log('Rebuild complete.');
  }
}
