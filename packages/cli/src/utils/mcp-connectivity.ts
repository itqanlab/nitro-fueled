import { execSync } from 'node:child_process';

export type ConnectivityStatus = 'ok' | 'unavailable' | 'error';

export interface ConnectivityResult {
  status: ConnectivityStatus;
  message: string;
}

export function testMcpConnectivity(): ConnectivityResult {
  try {
    // Use claude CLI to call list_workers via the MCP server.
    // If the MCP server is running and reachable, this returns a JSON response.
    // We use a short prompt that just invokes the tool and exits.
    const output = execSync(
      'claude --dangerously-skip-permissions -p "Call the list_workers MCP tool with status_filter all and return ONLY the raw JSON result, nothing else" --max-turns 2',
      {
        timeout: 30_000,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }
    );

    // If we got any output that looks like it contains worker data, connectivity is OK
    if (output.includes('workers') || output.includes('[]') || output.includes('list_workers')) {
      return { status: 'ok', message: 'MCP session-orchestrator is reachable.' };
    }

    // Got output but it doesn't look like a valid response
    return {
      status: 'error',
      message: 'MCP server responded but returned unexpected output. Verify the server is running correctly.',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timed out')) {
      return {
        status: 'unavailable',
        message: 'MCP session-orchestrator connection timed out. Ensure the server is running.',
      };
    }

    return {
      status: 'error',
      message: `MCP connectivity check failed: ${errorMessage.split('\n')[0] ?? 'unknown error'}`,
    };
  }
}
