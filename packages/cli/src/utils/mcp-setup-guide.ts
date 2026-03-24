import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function displayMcpSetupGuide(): void {
  const globalConfigPath = resolve(homedir(), '.claude.json');

  console.error('');
  console.error('MCP Session Orchestrator is not configured.');
  console.error('The Supervisor requires this MCP server to spawn and manage worker sessions.');
  console.error('');
  console.error('Setup Instructions:');
  console.error('-------------------');
  console.error('');
  console.error('1. Install session-orchestrator:');
  console.error('   Obtain the session-orchestrator package and place it in a local directory.');
  console.error('   cd <session-orchestrator-dir> && npm install && npm run build');
  console.error('');
  console.error('2. Add to your Claude Code MCP config.');
  console.error('');
  console.error('   Option A: Project-level (.mcp.json in project root):');
  console.error('');
  console.error('   {');
  console.error('     "mcpServers": {');
  console.error('       "session-orchestrator": {');
  console.error('         "type": "stdio",');
  console.error('         "command": "node",');
  console.error('         "args": ["/path/to/session-orchestrator/dist/index.js"]');
  console.error('       }');
  console.error('     }');
  console.error('   }');
  console.error('');
  console.error(`   Option B: Global (${globalConfigPath}):`);
  console.error('');
  console.error('   Add "session-orchestrator" to the "mcpServers" object.');
  console.error('');
  console.error('3. Verify it works:');
  console.error('   Restart Claude Code, then check that session-orchestrator');
  console.error('   tools (list_workers, spawn_worker) are available.');
  console.error('');
  console.error('Run `npx nitro-fueled init` to configure this interactively.');
}

export function buildMcpConfigEntry(serverPath: string): Record<string, unknown> {
  return {
    mcpServers: {
      'session-orchestrator': {
        type: 'stdio',
        command: 'node',
        args: [resolve(serverPath, 'dist', 'index.js')],
      },
    },
  };
}
