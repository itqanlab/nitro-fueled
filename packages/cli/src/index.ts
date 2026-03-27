#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerRunCommand } from './commands/run.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCreateCommand } from './commands/create.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerConfigCommand } from './commands/config.js';
import { registerUpdateCommand } from './commands/update.js';

const require = createRequire(import.meta.url);

function readStringField(obj: unknown, field: string, fallback: string): string {
  if (typeof obj !== 'object' || obj === null || !(field in obj)) return fallback;
  const value = (obj as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : fallback;
}

const pkg: unknown = require('../package.json');
const version = readStringField(pkg, 'version', '0.0.0');
const description = readStringField(pkg, 'description', '');

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
registerUpdateCommand(program);

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
