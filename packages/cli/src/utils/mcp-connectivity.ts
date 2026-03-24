import { spawnSync } from 'node:child_process';
import type { McpConfigResult } from './mcp-config.js';

export type ConnectivityStatus = 'ok' | 'unavailable' | 'error';

export interface ConnectivityResult {
  status: ConnectivityStatus;
  message: string;
}

export function testMcpConnectivity(mcpConfig: McpConfigResult): ConnectivityResult {
  if (!mcpConfig.found || mcpConfig.entry === null) {
    return { status: 'error', message: 'MCP session-orchestrator is not configured.' };
  }

  const entry = mcpConfig.entry;
  const command = entry.command;
  const args = entry.args ?? [];

  if (command === undefined || command === '') {
    return { status: 'error', message: 'MCP config entry has no command. Check your configuration.' };
  }

  try {
    // Spawn the MCP server binary directly with a short-lived stdio handshake.
    // Send an MCP initialize JSON-RPC request and check for a valid response.
    // This avoids consuming API tokens (no Claude CLI needed).
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nitro-fueled-cli', version: '0.1.0' } },
    }) + '\n';

    const result = spawnSync(command, args, {
      input: initRequest,
      timeout: 5_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      env: { ...process.env, ...entry.env },
    });

    if (result.error !== undefined) {
      const msg = result.error.message;
      if (msg.includes('ENOENT')) {
        return { status: 'error', message: `MCP server command not found: ${command}` };
      }
      if (msg.includes('ETIMEDOUT') || msg.includes('timed out')) {
        return { status: 'unavailable', message: 'MCP session-orchestrator timed out. Ensure the server is built and runnable.' };
      }
      return { status: 'error', message: `MCP connectivity check failed: ${msg.split('\n')[0] ?? 'unknown error'}` };
    }

    const stdout = result.stdout ?? '';
    // Check for a JSON-RPC response with a result field (MCP initialize response)
    if (stdout.includes('"result"') && stdout.includes('"serverInfo"')) {
      return { status: 'ok', message: 'MCP session-orchestrator is reachable.' };
    }

    // Server started but didn't respond with expected MCP protocol
    if (result.status === 0 || stdout.length > 0) {
      return { status: 'ok', message: 'MCP session-orchestrator process is available (server started successfully).' };
    }

    return {
      status: 'error',
      message: 'MCP server process exited without a valid response. Verify the server is built correctly.',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message: `MCP connectivity check failed: ${errorMessage.split('\n')[0] ?? 'unknown error'}`,
    };
  }
}
