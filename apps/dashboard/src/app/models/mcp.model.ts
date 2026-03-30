export type McpServerStatus = 'active' | 'inactive' | 'error';
export type McpTransportType = 'stdio' | 'HTTP';
export type McpBadgeType = 'Built-in' | 'User';
export type McpTeamAccess = 'All teams' | 'Engineering' | 'Design';

export interface McpServer {
  readonly name: string;
  readonly icon: string;
  readonly iconClass: string;
  readonly status: McpServerStatus;
  readonly badgeType: McpBadgeType;
  readonly transport: McpTransportType;
  readonly toolCount: string;
  readonly teams: readonly McpTeamAccess[];
  readonly connectionInfo?: string;
  readonly connectionStatus?: 'ok' | 'warn';
  readonly tools: readonly string[];
  readonly moreToolsCount?: number;
}

export interface McpToolAccessRow {
  readonly agent: string;
  readonly access: Record<string, boolean>;
}

export interface McpIntegration {
  readonly name: string;
  readonly icon: string;
  readonly iconClass: string;
  readonly connected: boolean;
  readonly details: readonly { label: string; value: string }[];
  readonly description?: string;
  readonly toggleLabel: string;
  readonly toggleOn: boolean;
}
