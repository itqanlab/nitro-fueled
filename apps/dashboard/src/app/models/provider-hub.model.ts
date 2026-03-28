export type ApiType = 'api' | 'cli' | 'oauth';
export type ConnectionStatus = 'connected' | 'disconnected' | 'not-configured';
export type ModelCapability = 'high' | 'medium' | 'fast';

export interface ProviderModel {
  readonly name: string;
  readonly id: string;
  readonly capability: ModelCapability;
  readonly capabilityLabel: string;
  readonly context: string;
  readonly inputPrice: string;
  readonly outputPrice: string;
  readonly enabled: boolean;
}

export interface ProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly iconLetter: string;
  readonly iconClass: string;
  readonly apiType: ApiType;
  readonly connectionStatus: ConnectionStatus;
  readonly connectionLabel: string;
  readonly monthlyCost: number | null;
  readonly authType: 'api-key' | 'oauth' | 'cli';
  readonly maskedKey?: string;
  readonly baseUrl?: string;
  readonly cliPath?: string;
  readonly cliVersion?: string;
  readonly cliInstallMethod?: string;
  readonly oauthExpiryDays?: number;
  readonly testResult?: string;
  readonly noKeyMessage?: string;
  readonly models: readonly ProviderModel[];
}

export interface CostBarEntry {
  readonly provider: string;
  readonly amount: number;
  readonly percent: number;
  readonly colorClass: string;
}

export interface ProviderCostSummary {
  readonly totalCost: number;
  readonly budget: number;
  readonly costBars: readonly CostBarEntry[];
}

export interface ProviderHubData {
  readonly costSummary: ProviderCostSummary;
  readonly providers: readonly ProviderConfig[];
  readonly bottomPanel: {
    readonly totalProviders: number;
    readonly connected: number;
    readonly expired: number;
    readonly notConfigured: number;
  };
}
