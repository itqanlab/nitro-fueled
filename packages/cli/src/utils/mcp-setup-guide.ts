import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function displayMcpSetupGuide(): void {
  const globalConfigPath = resolve(homedir(), '.claude.json');

  console.log('');
  console.log('MCP Session Orchestrator is not configured.');
  console.log('The Supervisor requires this MCP server to spawn and manage worker sessions.');
  console.log('');
  console.log('Setup Instructions:');
  console.log('-------------------');
  console.log('');
  console.log('1. Install session-orchestrator:');
  console.log('   Obtain the session-orchestrator package and place it in a local directory.');
  console.log('   cd <session-orchestrator-dir> && npm install && npm run build');
  console.log('');
  console.log('2. Add to your Claude Code MCP config.');
  console.log('');
  console.log('   Option A: Project-level (.mcp.json in project root):');
  console.log('');
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "session-orchestrator": {');
  console.log('         "type": "stdio",');
  console.log('         "command": "node",');
  console.log('         "args": ["/path/to/session-orchestrator/dist/index.js"]');
  console.log('       }');
  console.log('     }');
  console.log('   }');
  console.log('');
  console.log(`   Option B: Global (${globalConfigPath}):`);
  console.log('');
  console.log('   Add "session-orchestrator" to the "mcpServers" object.');
  console.log('');
  console.log('3. Verify it works:');
  console.log('   Restart Claude Code, then check that session-orchestrator');
  console.log('   tools (list_workers, spawn_worker) are available.');
  console.log('');
  console.log('Run `npx nitro-fueled init` to configure this interactively.');
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
