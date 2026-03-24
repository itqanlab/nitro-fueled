import type { Command } from 'commander';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show task statuses, active workers, and costs')
    .action(() => {
      console.log('nitro-fueled status: not yet implemented');
      process.exitCode = 1;
    });
}
