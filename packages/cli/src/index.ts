#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerRunCommand } from './commands/run.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCreateCommand } from './commands/create.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerConfigCommand } from './commands/config.js';

const require = createRequire(import.meta.url);
const { version, description } = require('../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('nitro-fueled')
  .description(description)
  .version(version);

registerInitCommand(program);
registerRunCommand(program);
registerStatusCommand(program);
registerCreateCommand(program);
registerDashboardCommand(program);
registerConfigCommand(program);

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
