import type { Command } from 'commander';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold .claude/ and task-tracking/ into the current project')
    .action(() => {
      console.log('nitro-fueled init: not yet implemented');
      process.exitCode = 1;
    });
}
