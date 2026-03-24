import type { Command } from 'commander';

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Interactive task creation')
    .action(() => {
      console.log('nitro-fueled create: not yet implemented');
    });
}
