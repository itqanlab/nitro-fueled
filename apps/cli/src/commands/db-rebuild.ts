import { BaseCommand } from '../base-command.js';
import { runCortexStep } from '../utils/cortex-hydrate.js';

export default class DbRebuild extends BaseCommand {
  public static override description = 'Drop and re-hydrate cortex DB from task-tracking files';

  public async run(): Promise<void> {
    const cwd = process.cwd();
    console.log('');
    console.log('nitro-fueled db:rebuild');
    console.log('=======================');
    console.log('');
    console.log('Rebuilding cortex database from files...');
    console.log('(sessions and workers tables are preserved)');
    console.log('');

    const result = runCortexStep(cwd, 'rebuild');
    if (result === null) {
      console.error('Error: Could not open cortex database.');
      process.exitCode = 1;
      return;
    }

    console.log(`Imported: ${result.tasks.imported} tasks, ${result.sessions.imported} sessions, ${result.handoffs.imported} handoffs`);
    if (result.tasks.skipped > 0) {
      console.log(`Skipped:  ${result.tasks.skipped} task folders (missing task.md)`);
    }
    if (result.tasks.errors.length > 0) {
      console.log('Warnings:');
      for (const e of result.tasks.errors) {
        console.warn(`  ${e}`);
      }
    }
    console.log('');
    console.log('Rebuild complete.');
  }
}
