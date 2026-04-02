import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { logger } from './logger.js';

export function displayMcpSetupGuide(): void {
  const globalConfigPath = resolve(homedir(), '.claude.json');

  logger.log('');
  logger.log('MCP nitro-cortex is not configured.');
  logger.log('The Supervisor requires this MCP server to spawn and manage worker sessions.');
  logger.log('');
  logger.log('Setup Instructions:');
  logger.log('-------------------');
  logger.log('');
  logger.log('1. Build nitro-cortex:');
  logger.log('   cd packages/mcp-cortex && npm install && npm run build');
  logger.log('');
  logger.log('2. Add to your Claude Code MCP config.');
  logger.log('');
  logger.log('   Option A: Project-level (.mcp.json in project root):');
  logger.log('');
  logger.log('   {');
  logger.log('     "mcpServers": {');
  logger.log('       "nitro-cortex": {');
  logger.log('         "type": "stdio",');
  logger.log('         "command": "node",');
  logger.log('         "args": ["packages/mcp-cortex/dist/index.js"]');
  logger.log('       }');
  logger.log('     }');
  logger.log('   }');
  logger.log('');
  logger.log(`   Option B: Global (${globalConfigPath}):`);
  logger.log('');
  logger.log('   Add "nitro-cortex" to the "mcpServers" object.');
  logger.log('');
  logger.log('3. Verify it works:');
  logger.log('   Restart Claude Code, then check that nitro-cortex');
  logger.log('   tools (list_workers, spawn_worker, get_tasks) are available.');
  logger.log('');
  logger.log('Run `npx nitro-fueled init` to configure this interactively.');
}

export function buildMcpConfigEntry(serverPath: string): Record<string, unknown> {
  return {
    mcpServers: {
      'nitro-cortex': {
        type: 'stdio',
        command: 'node',
        args: [resolve(serverPath, 'dist', 'index.js')],
      },
    },
  };
}
