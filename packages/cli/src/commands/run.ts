import type { Command } from 'commander';

export function registerRunCommand(program: Command): void {
  program
    .command('run [taskId]')
    .description('Start the Supervisor loop, or run a specific task')
    .action((taskId?: string) => {
      if (taskId !== undefined) {
        console.log(`nitro-fueled run ${taskId}: not yet implemented`);
      } else {
        console.log('nitro-fueled run: not yet implemented');
      }
      process.exitCode = 1;
    });
}
