import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function displayMcpSetupGuide(): void {
  const globalConfigPath = resolve(homedir(), '.claude.json');

  console.log('');
  console.log('MCP nitro-cortex is not configured.');
  console.log('The Supervisor requires this MCP server to spawn and manage worker sessions.');
  console.log('');
  console.log('Setup Instructions:');
  console.log('-------------------');
  console.log('');
  console.log('1. Build nitro-cortex:');
  console.log('   cd packages/mcp-cortex && npm install && npm run build');
  console.log('');
  console.log('2. Add to your Claude Code MCP config.');
  console.log('');
  console.log('   Option A: Project-level (.mcp.json in project root):');
  console.log('');
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "nitro-cortex": {');
  console.log('         "type": "stdio",');
  console.log('         "command": "node",');
  console.log('         "args": ["packages/mcp-cortex/dist/index.js"]');
  console.log('       }');
  console.log('     }');
  console.log('   }');
  console.log('');
  console.log(`   Option B: Global (${globalConfigPath}):`);
  console.log('');
  console.log('   Add "nitro-cortex" to the "mcpServers" object.');
  console.log('');
  console.log('3. Verify it works:');
  console.log('   Restart Claude Code, then check that nitro-cortex');
  console.log('   tools (list_workers, spawn_worker, get_tasks) are available.');
  console.log('');
  console.log('Run `npx nitro-fueled init` to configure this interactively.');
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
