#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerRunCommand } from './commands/run.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCreateCommand } from './commands/create.js';

const program = new Command();

program
  .name('nitro-fueled')
  .description('AI development orchestration — full PM -> Architect -> Dev -> QA pipeline')
  .version('0.1.0');

registerInitCommand(program);
registerRunCommand(program);
registerStatusCommand(program);
registerCreateCommand(program);

program.parse();
