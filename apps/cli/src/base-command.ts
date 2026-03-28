import { Command } from '@oclif/core';

/**
 * BaseCommand extends @oclif/core's Command with shared configuration
 * for all nitro-fueled CLI commands.
 */
export abstract class BaseCommand extends Command {
  protected override async catch(err: Error & { exitCode?: number }): Promise<void> {
    await super.catch(err);
  }

  protected override async finally(err: Error | undefined): Promise<void> {
    await super.finally(err);
  }
}
