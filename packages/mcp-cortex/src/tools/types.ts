/**
 * Standard MCP tool result type.
 * `isError: true` signals to the MCP host that the tool call failed;
 * hosts surface this as an error even when `content` contains a human-readable message.
 */
export type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
