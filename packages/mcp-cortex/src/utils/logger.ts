/**
 * MCP Cortex structured logger.
 * ALWAYS writes to stderr — stdout is reserved for the MCP stdio protocol (JSON-RPC).
 * Using console.log in an MCP stdio server corrupts the protocol channel.
 */

export const mcpLogger = {
  info: (msg: string, ...args: unknown[]): void => {
    process.stderr.write(`[nitro-cortex] ${msg}${args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : ''}\n`);
  },
  warn: (msg: string, ...args: unknown[]): void => {
    process.stderr.write(`[nitro-cortex] WARN ${msg}${args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : ''}\n`);
  },
  error: (msg: string, ...args: unknown[]): void => {
    process.stderr.write(`[nitro-cortex] ERROR ${msg}${args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : ''}\n`);
  },
  debug: (msg: string, ...args: unknown[]): void => {
    if (process.env['DEBUG']) {
      process.stderr.write(`[nitro-cortex] DEBUG ${msg}${args.length ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : ''}\n`);
    }
  },
};
