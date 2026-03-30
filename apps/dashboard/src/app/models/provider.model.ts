export type ProviderStatusType = 'ok' | 'busy' | 'off';

export interface StatusIndicator {
  readonly label: string;
  readonly status: ProviderStatusType;
  readonly detail?: string;
  readonly progressPercent?: number;
}

export interface Provider {
  readonly name: string;
  readonly connected: boolean;
}
